import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { app } from "electron";
import { listWindows } from "./windows";

export interface SpotifyTrack {
  title: string;
  artist: string;
  album?: string;
  playing: boolean;
  position?: number;
  duration?: number;
}

const SMTC_SCRIPT = `
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$ErrorActionPreference = "SilentlyContinue"

function Wait-Async($op) {
  if ($null -eq $op) { return $null }
  $n = 0
  while ($op.Status -eq 0) {
    Start-Sleep -Milliseconds 15
    $n++
    if ($n -gt 120) { return $null }
  }
  if ($op.Status -ne 1) { return $null }
  try { return $op.GetResults() } catch { return $null }
}

function Emit($obj) {
  if (-not $obj) { Write-Output "null"; return }
  $obj | ConvertTo-Json -Compress
}

try {
  $null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
  $mgr = Wait-Async ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync())
  $picked = $null
  $fallback = $null
  if ($mgr) {
    foreach ($s in @($mgr.GetSessions())) {
      $props = Wait-Async ($s.TryGetMediaPropertiesAsync())
      if (-not $props) { continue }
      $title = [string]$props.Title
      if (-not $title) { continue }
      $aumid = [string]$s.SourceAppUserModelId
      $pb = $s.GetPlaybackInfo()
      $tl = $null
      try { $tl = $s.GetTimelineProperties() } catch {}
      $status = ""
      try { $status = [string]$pb.PlaybackStatus } catch {}
      $item = [ordered]@{
        title = $title
        artist = [string]$props.Artist
        album = [string]$props.AlbumTitle
        playing = ($status -match "Playing")
        position = 0
        duration = 0
        aumid = $aumid
      }
      if ($tl) {
        try { $item.position = [math]::Round(([TimeSpan]$tl.Position).TotalSeconds, 1) } catch {}
        try { $item.duration = [math]::Round(([TimeSpan]$tl.EndTime).TotalSeconds, 1) } catch {}
      }
      if ($aumid -match "spotify") { $picked = $item; break }
      if ($item.playing -and -not $fallback) { $fallback = $item }
      elseif (-not $fallback) { $fallback = $item }
    }
  }
  $out = $picked
  if (-not $out) { $out = $fallback }

  if (-not $out) {
    $procs = @(Get-Process | Where-Object {
      $_.ProcessName -match "Spotify" -and $_.MainWindowTitle -and $_.MainWindowTitle -notmatch "^(Spotify(?: Premium)?)$"
    })
    if ($procs.Count -gt 0) {
      $raw = [string]$procs[0].MainWindowTitle
      $raw = $raw -replace "\\s+-\\s+Spotify(?: Premium)?\\s*$", ""
      # Keep this script ASCII-only: Windows PowerShell can misread a UTF-8
      # script without a BOM, which previously stopped all Spotify detection.
      $parts = @($raw -split "\\s+-\\s+", 2)
      $out = [ordered]@{
        title = $parts[0].Trim()
        artist = $(if ($parts.Count -gt 1) { $parts[1].Trim() } else { "" })
        album = ""
        playing = $true
        position = 0
        duration = 0
        aumid = "process"
      }
    }
  }

  Emit $out
} catch {
  Write-Output "null"
}
`;

let cache: { at: number; track: SpotifyTrack | null } = { at: 0, track: null };
let inflight: Promise<SpotifyTrack | null> | null = null;
let scriptReady = "";

function scriptPath() {
  const dest = path.join(app.getPath("userData"), "smtc.ps1");
  if (scriptReady !== dest) {
    fs.writeFileSync(dest, SMTC_SCRIPT, "utf8");
    scriptReady = dest;
  }
  return dest;
}

function parseTitle(raw: string): SpotifyTrack | null {
  const cleaned = raw.replace(/\s+-\s+Spotify(?:\s+Premium)?\s*$/i, "").trim();
  if (!cleaned || /^spotify(?:\s+premium)?$/i.test(cleaned)) return null;
  const parts = cleaned.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) {
    return { title: parts[0].trim(), artist: parts.slice(1).join(" - ").trim(), playing: true };
  }
  return { title: cleaned, artist: "", playing: true };
}

function fromWindowTitle(): SpotifyTrack | null {
  try {
    const windows = listWindows();
    for (const w of windows) {
      const t = w.title.trim();
      if (!/spotify/i.test(t) && !/spotify/i.test(w.name)) continue;
      const parsed = parseTitle(t);
      if (parsed) return parsed;
    }
    for (const w of windows) {
      const parsed = parseTitle(w.title.trim());
      if (parsed && /spotify/i.test(w.title)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function parseSmtcOutput(stdout: string): SpotifyTrack | null {
  const text = stdout.toString().replace(/^\uFEFF/, "").trim();
  if (!text || text === "null") return null;
  const start = text.lastIndexOf("{");
  const json = start >= 0 ? text.slice(start) : text;
  try {
    const parsed = JSON.parse(json) as {
      title?: string;
      artist?: string;
      album?: string;
      playing?: boolean;
      position?: number;
      duration?: number;
    } | null;
    if (!parsed?.title || /^spotify(?:\s+premium)?$/i.test(parsed.title)) return null;
    return {
      title: parsed.title,
      artist: parsed.artist || "",
      album: parsed.album,
      playing: Boolean(parsed.playing),
      position: parsed.position,
      duration: parsed.duration,
    };
  } catch {
    return null;
  }
}

function fromSmtc(): Promise<SpotifyTrack | null> {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-Sta", "-ExecutionPolicy", "Bypass", "-File", scriptPath()],
      { windowsHide: true, timeout: 5000, windowsVerbatimArguments: false },
      (err, stdout) => {
        if (err && !stdout) {
          resolve(null);
          return;
        }
        resolve(parseSmtcOutput(String(stdout ?? "")));
      },
    );
  });
}

export async function getSpotifyTrack(): Promise<SpotifyTrack | null> {
  const titled = fromWindowTitle();
  if (titled?.title) {
    cache = { at: Date.now(), track: titled };
    return titled;
  }
  if (Date.now() - cache.at < 800 && cache.track) {
    return cache.track;
  }
  if (inflight) return inflight;
  inflight = fromSmtc()
    .then((smtc) => {
      const track = smtc ?? titled ?? cache.track;
      if (track) cache = { at: Date.now(), track };
      else cache = { at: Date.now(), track: null };
      return track ?? null;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
