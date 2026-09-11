import { useEffect, useRef, useState, type ReactNode } from "react";
import type { OverlayCounterItem, OverlaySettings, SpotifyTrack } from "@/types";

interface OverlayPayload {
  overlay: OverlaySettings;
  overlayCounters?: OverlayCounterItem[];
  ticket?: number;
  specs?: number;
  track?: SpotifyTrack | null;
}

const fallbackOverlay: OverlaySettings = {
  displayId: null,
  enabled: false,
  editMode: false,
  showReports: true,
  showSpotify: true,
  showClock: true,
  showRadial: false,
  showPush: false,
  positions: {
    reports: { x: 50, y: 8, scale: 1 },
    spotify: { x: 50, y: 91, scale: 1 },
    clock: { x: 1.4, y: 95, scale: 0.75 },
  },
  previousLayout: null,
};

function migratePositions(overlay: OverlaySettings): OverlaySettings {
  return overlay;
}

function useScreenScale() {
  const [scale, setScale] = useState(() => screenScale());
  useEffect(() => {
    const onResize = () => setScale(screenScale());
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return scale;
}

function screenScale() {
  const w = window.innerWidth || 1920;
  const h = window.innerHeight || 1080;
  return Math.max(0.85, Math.min(1.35, Math.min(w / 1920, h / 1080)));
}

export function OverlayApp() {
  const [payload, setPayload] = useState<OverlayPayload>({
    overlay: fallbackOverlay,
    overlayCounters: [],
    track: null,
  });
  const [now, setNow] = useState(() => new Date());
  const uiScale = useScreenScale();

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const root = document.getElementById("root");
    if (root) root.style.background = "transparent";
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { overlay, overlayCounters, ticket, specs, track } = payload;
  const pills =
    overlayCounters ??
    [
      { id: "ticket", name: "Reporty", value: ticket ?? 0, color: "purple" as const },
      { id: "event-specs", name: "Event Specs", value: specs ?? 0, color: "green" as const },
    ];
  const time = now.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const dragging = useRef(false);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  useEffect(() => {
    return window.synvityOverlay?.onState((raw) => {
      const data = raw as OverlayPayload;
      if (!data?.overlay) return;
      const next = migratePositions(data.overlay);
      setPayload((prev) => {
        const merged: OverlayPayload = {
          ...prev,
          ...data,
          overlay: next,
          track: data.track === undefined ? prev.track : data.track,
          overlayCounters: data.overlayCounters ?? prev.overlayCounters,
        };
        if (dragging.current) {
          merged.overlay = { ...next, positions: overlayRef.current.positions };
        }
        return merged;
      });
    });
  }, []);

  useEffect(() => {
    window.synvityOverlay?.setIgnore(true);
    const onMove = (e: MouseEvent) => {
      if (!overlay.editMode) {
        window.synvityOverlay?.setIgnore(true);
        return;
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const hit = Boolean(el?.closest("[data-hud]"));
      window.synvityOverlay?.setIgnore(!hit);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.synvityOverlay?.setIgnore(true);
    };
  }, [overlay.editMode]);

  const commitPos = (key: "reports" | "spotify" | "clock", x: number, y: number) => {
    const positions = {
      ...overlayRef.current.positions,
      [key]: { ...overlayRef.current.positions[key], x, y },
    };
    overlayRef.current = { ...overlayRef.current, positions };
    setPayload((p) => ({ ...p, overlay: { ...p.overlay, positions } }));
    window.synvityOverlay?.saveLayout(positions);
    dragging.current = false;
  };

  return (
    <div className="relative h-screen w-screen overflow-visible" style={{ background: "transparent" }}>
      {overlay.showReports && pills.length ? (
        <Draggable
          enabled={overlay.editMode}
          x={overlay.positions.reports.x}
          y={overlay.positions.reports.y}
          scale={(overlay.positions.reports.scale || 1) * uiScale}
          centerX
          onDragStart={() => {
            dragging.current = true;
          }}
          onCommit={(x, y) => commitPos("reports", x, y)}
        >
          <div className="flex max-w-[720px] flex-wrap justify-center gap-1.5">
            {pills.length
              ? pills.map((item) => <Pill key={item.id} label={item.name} value={item.value} />)
              : null}
          </div>
        </Draggable>
      ) : null}

      {overlay.showClock ? (
        <Draggable
          enabled={overlay.editMode}
          x={overlay.positions.clock.x}
          y={overlay.positions.clock.y}
          scale={(overlay.positions.clock.scale || 1) * uiScale}
          onDragStart={() => {
            dragging.current = true;
          }}
          onCommit={(x, y) => commitPos("clock", x, y)}
        >
          <div className="text-[20px] font-semibold tabular-nums tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            {time}
          </div>
        </Draggable>
      ) : null}

      {overlay.showSpotify ? (
        <Draggable
          enabled={overlay.editMode}
          x={overlay.positions.spotify.x}
          y={overlay.positions.spotify.y}
          scale={(overlay.positions.spotify.scale || 1) * uiScale}
          centerX
          onDragStart={() => {
            dragging.current = true;
          }}
          onCommit={(x, y) => commitPos("spotify", x, y)}
        >
          <SpotifyWidget track={track ?? null} />
        </Draggable>
      ) : null}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-black/85 px-3.5 py-1">
      <span className="text-[13px] font-bold text-white">{label}</span>
      <span className="rounded-md bg-[#F02D5E] px-2 py-0.5 text-[12px] font-bold text-white">{value}</span>
    </div>
  );
}

function formatTime(sec?: number) {
  if (sec == null || Number.isNaN(sec) || sec < 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SpotifyWidget({ track }: { track: SpotifyTrack | null }) {
  const [artFailed, setArtFailed] = useState(false);
  const song =
    track?.title && !/^spotify(?:\s+premium)?$/i.test(track.title) ? track.title : "Spotify";
  const artists =
    track?.artist && track.artist !== "Spotify"
      ? track.artist
      : song !== "Spotify"
        ? ""
        : "Oczekiwanie na utwór";
  const artwork = !artFailed && track?.artwork ? track.artwork : "";
  const progress =
    track?.duration && track.duration > 0 ? Math.min(1, (track.position ?? 0) / track.duration) : track?.playing ? 0.15 : 0;

  useEffect(() => {
    setArtFailed(false);
  }, [track?.artwork, track?.title, track?.artist]);

  return (
    <div className="flex w-[300px] items-center gap-2.5 rounded-xl bg-black/90 px-2 py-1.5">
      {artwork ? (
        <img
          src={artwork}
          alt=""
          className="h-12 w-12 shrink-0 rounded-md object-cover"
          draggable={false}
          onError={() => setArtFailed(true)}
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#1db954] text-black">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.18c-.3.42-.84.6-1.26.3-3.22-1.98-8.14-2.56-11.94-1.4-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.42.24.54.84.24 1.22zm.12-3.3C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-.96 15.72 1.62.54.3.72 1.02.42 1.56-.3.54-1.02.72-1.56.42z" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold leading-tight text-white">{song}</div>
        <div className="truncate text-[11px] leading-tight text-zinc-400">{artists || "\u00a0"}</div>
        <div className="mt-1 h-[2px] overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-[#1db954]" style={{ width: `${progress * 100}%` }} />
        </div>
        {track?.duration ? (
          <div className="mt-0.5 flex justify-between text-[8px] text-zinc-500">
            <span>{formatTime(track.position)}</span>
            <span>{formatTime(track.duration)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Draggable({
  children,
  enabled,
  x,
  y,
  scale,
  centerX,
  onDragStart,
  onCommit,
}: {
  children: ReactNode;
  enabled: boolean;
  x: number;
  y: number;
  scale: number;
  centerX?: boolean;
  onDragStart?: () => void;
  onCommit?: (x: number, y: number) => void;
}) {
  const [pos, setPos] = useState({ x, y });
  useEffect(() => setPos({ x, y }), [x, y]);

  return (
    <div
      className={enabled ? "cursor-move" : "pointer-events-none"}
      data-hud="true"
      style={{
        position: "absolute",
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        transform: `translate(${centerX ? "-50%" : "0"}, 0) scale(${scale})`,
        transformOrigin: centerX ? "top center" : "top left",
      }}
      onMouseDown={(e) => {
        if (!enabled) return;
        onDragStart?.();
        const startX = e.clientX;
        const startY = e.clientY;
        const orig = { ...pos };
        let next = { ...orig };
        const move = (ev: MouseEvent) => {
          const dx = ((ev.clientX - startX) / window.innerWidth) * 100;
          const dy = ((ev.clientY - startY) / window.innerHeight) * 100;
          next = {
            x: Math.min(100, Math.max(-2, orig.x + dx)),
            y: Math.min(100, Math.max(-2, orig.y + dy)),
          };
          setPos(next);
        };
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
          onCommit?.(next.x, next.y);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      }}
    >
      {children}
    </div>
  );
}
