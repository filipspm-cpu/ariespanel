import { execFile } from "child_process";
import fs from "fs";
import https from "https";
import path from "path";
import { app } from "electron";
import { listWindows } from "./windows";

export interface SpotifyTrack {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  playing: boolean;
  position?: number;
  duration?: number;
}

const SMTC_SCRIPT = `
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
$ErrorActionPreference = "SilentlyContinue"
$artFile = "ART_FILE_PLACEHOLDER"

function Wait-Async($op) {
  if ($null -eq $op) { return $null }
  $n = 0
  while ($op.Status -eq 0) {
    Start-Sleep -Milliseconds 15
    $n++
    if ($n -gt 160) { return $null }
  }
  if ($op.Status -ne 1) { return $null }
  try { return $op.GetResults() } catch { return $null }
}

function Save-Thumb($props) {
  try {
    if (-not $props -or -not $props.Thumbnail) { return "" }
    $ras = Wait-Async ($props.Thumbnail.OpenReadAsync())
    if (-not $ras) { return "" }
    $copied = $false
    try {
      $methods = [System.IO.WindowsRuntimeStreamExtensions].GetMethods() | Where-Object { $_.Name -eq "AsStreamForRead" }
      foreach ($m in @($methods)) {
        try {
          $net = $m.Invoke($null, @($ras))
          $fs = [System.IO.File]::Open($artFile, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
          $net.CopyTo($fs)
          $fs.Dispose()
          $net.Dispose()
          $copied = $true
          break
        } catch {}
      }
    } catch {}
    if (-not $copied) {
      $null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
      $reader = [Windows.Storage.Streams.DataReader]::Create($ras)
      $size = [uint32]$ras.Size
      if ($size -le 0 -or $size -gt 2500000) { return "" }
      $load = $reader.LoadAsync($size)
      $n = 0
      while ($load.Status -eq 0) {
        Start-Sleep -Milliseconds 15
        $n++
        if ($n -gt 160) { return "" }
      }
      $bytes = New-Object byte[] $size
      $reader.ReadBytes($bytes)
      [System.IO.File]::WriteAllBytes($artFile, $bytes)
    }
    if ((Test-Path $artFile) -and ((Get-Item $artFile).Length -gt 32)) { return $artFile }
  } catch {}
  return ""
}

function Emit($obj) {
  if (-not $obj) { Write-Output "null"; return }
  $obj | ConvertTo-Json -Compress
}

try {
  Add-Type -Path "$env:WINDIR\\Microsoft.NET\\Framework64\\v4.0.30319\\System.Runtime.WindowsRuntime.dll" -ErrorAction SilentlyContinue
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
        artworkPath = (Save-Thumb $props)
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
      $parts = @($raw -split "\\s+-\\s+", 2)
      $out = [ordered]@{
        title = $parts[0].Trim()
        artist = $(if ($parts.Count -gt 1) { $parts[1].Trim() } else { "" })
        album = ""
        artworkPath = ""
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

function artFilePath() {
  return path.join(app.getPath("userData"), "spotify-art.bin");
}

function scriptPath() {
  const dest = path.join(app.getPath("userData"), "smtc.ps1");
  const art = artFilePath().replace(/\\/g, "\\\\");
  fs.writeFileSync(dest, SMTC_SCRIPT.replace("ART_FILE_PLACEHOLDER", art), "utf8");
  return dest;
}

function parseTitle(raw: string): SpotifyTrack | null {
  const cleaned = raw.replace(/\s+[-–—]\s+Spotify(?:\s+Premium)?\s*$/i, "").trim();
  if (!cleaned || /^spotify(?:\s+premium)?$/i.test(cleaned)) return null;
  const parts = cleaned.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { title: parts.slice(0, -1).join(" - "), artist: parts[parts.length - 1], playing: true };
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
  } catch {
    /* ignore */
  }
  return null;
}

function artworkMime(buf: Buffer) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49) return "image/gif";
  if (buf[0] === 0x52 && buf[8] === 0x57) return "image/webp";
  return "image/jpeg";
}

function loadArtwork(filePath?: string): string | undefined {
  const file = filePath || artFilePath();
  try {
    if (!file || !fs.existsSync(file)) return undefined;
    const buf = fs.readFileSync(file);
    if (buf.length < 32) return undefined;
    return `data:${artworkMime(buf)};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

function getJson(url: string): Promise<unknown> {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 2500 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk as Buffer));
      res.on("end", () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

function norm(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

const metaCache = new Map<string, { title: string; artist: string; artwork?: string }>();

async function lookupCover(title: string, artist: string) {
  const key = `${norm(title)}|${norm(artist)}`;
  const hit = metaCache.get(key);
  if (hit) return hit;
  const query = [title, artist].filter(Boolean).join(" ").trim();
  if (!query) return null;
  const data = (await getJson(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=5`,
  )) as { results?: { trackName?: string; artistName?: string; artworkUrl100?: string }[] } | null;
  const rows = data?.results ?? [];
  if (!rows.length) return null;
  const scored = rows
    .map((row) => {
      const trackName = row.trackName || "";
      const artistName = row.artistName || "";
      const nTitle = norm(title);
      const nArtist = norm(artist);
      const nTrack = norm(trackName);
      const nRowArtist = norm(artistName);
      let score = 0;
      if (nTrack === nTitle || nTrack === nArtist) score += 3;
      if (nRowArtist === nArtist || nRowArtist === nTitle) score += 3;
      if (nTitle && nTrack.includes(nTitle)) score += 1;
      if (nArtist && nRowArtist.includes(nArtist)) score += 1;
      return { trackName, artistName, artwork: row.artworkUrl100?.replace("100x100bb", "300x300bb"), score };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best?.trackName) return null;
  const resolved = { title: best.trackName, artist: best.artistName, artwork: best.artwork };
  metaCache.set(key, resolved);
  metaCache.set(`${norm(best.trackName)}|${norm(best.artistName)}`, resolved);
  return resolved;
}

async function enrichTrack(track: SpotifyTrack): Promise<SpotifyTrack> {
  const info = (await lookupCover(track.title, track.artist)) ?? (await lookupCover(track.artist, track.title));
  if (!info) return track;
  return {
    ...track,
    title: info.title || track.title,
    artist: info.artist || track.artist,
    artwork: track.artwork || info.artwork,
  };
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
      artworkPath?: string;
      playing?: boolean;
      position?: number;
      duration?: number;
    } | null;
    if (!parsed?.title || /^spotify(?:\s+premium)?$/i.test(parsed.title)) return null;
    return {
      title: parsed.title,
      artist: parsed.artist || "",
      album: parsed.album,
      artwork: loadArtwork(parsed.artworkPath),
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
      { windowsHide: true, timeout: 7000, windowsVerbatimArguments: false },
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

function sameSong(a?: SpotifyTrack | null, b?: SpotifyTrack | null) {
  if (!a || !b) return false;
  const left = new Set([norm(a.title), norm(a.artist)]);
  return left.has(norm(b.title)) && left.has(norm(b.artist));
}

function mergeTracks(smtc: SpotifyTrack | null, titled: SpotifyTrack | null, prev: SpotifyTrack | null): SpotifyTrack | null {
  const base = smtc ?? titled ?? prev;
  if (!base) return null;
  const title = smtc?.title || titled?.title || base.title;
  const artist = smtc?.artist || titled?.artist || base.artist;
  const artwork =
    smtc?.artwork ||
    (sameSong({ title, artist, playing: true }, prev) ? prev?.artwork : undefined) ||
    prev?.artwork;
  return {
    title,
    artist,
    album: smtc?.album || prev?.album,
    artwork,
    playing: smtc?.playing ?? titled?.playing ?? Boolean(base.playing),
    position: smtc?.position ?? prev?.position,
    duration: smtc?.duration ?? prev?.duration,
  };
}

export async function getSpotifyTrack(): Promise<SpotifyTrack | null> {
  if (inflight) return inflight;
  if (cache.track && Date.now() - cache.at < 800) return cache.track;
  inflight = (async () => {
    const titled = fromWindowTitle();
    const smtc = await fromSmtc();
    let track = mergeTracks(smtc, titled, cache.track);
    if (track) track = await enrichTrack(track);
    cache = { at: Date.now(), track };
    return track;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}
