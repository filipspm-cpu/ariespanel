import { Card } from "@/components/ui/Card";
import { formatDuration } from "@/services/api";
import { counterPeriodTotals, startOfDay, startOfWeek } from "@/services/counterStats";
import { useAppStore } from "@/store/useAppStore";
import type { SpotifyTrack } from "@/types";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

function StatCard({
  title,
  value,
  unit,
  hint,
  accent,
  trend,
}: {
  title: string;
  value: string | number;
  unit?: string;
  hint?: string;
  accent: string;
  trend?: number;
}) {
  const TrendIcon = (trend ?? 0) >= 0 ? TrendingUp : TrendingDown;
  return (
    <Card className="relative overflow-hidden p-4">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <div className="text-[12px] text-zinc-500">{title}</div>
      <div className="mt-3 flex items-end gap-2">
        <div className="text-[28px] font-semibold leading-none tracking-tight text-white tabular-nums">{value}</div>
        {unit ? <div className="mb-0.5 text-[12px] text-zinc-500">{unit}</div> : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {hint ? <div className="text-[11px] leading-snug text-zinc-600">{hint}</div> : <span />}
        {typeof trend === "number" ? (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            <TrendIcon size={12} />
            {trend > 0 ? "+" : ""}
            {trend}%
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function NowPlayingTicker({
  track,
  reportsToday,
  specsToday,
}: {
  track: SpotifyTrack | null;
  reportsToday: number;
  specsToday: number;
}) {
  const playing = Boolean(track?.title && !/^spotify(?:\s+premium)?$/i.test(track.title));
  const song = playing ? `${track?.title} — ${track?.artist || "Spotify"}` : "Oczekiwanie na utwór ze Spotify";
  const bits = [
    song,
    `Reporty dziś ${reportsToday}`,
    `Event Specs dziś ${specsToday}`,
    track?.playing ? "Odtwarzanie" : playing ? "Pauza" : "Spotify",
  ];
  const line = bits.join("   ·   ");
  const loop = `${line}   ·   ${line}   ·   `;

  return (
    <Card className="flex h-14 shrink-0 items-center gap-3 overflow-hidden px-2">
      {track?.artwork ? (
        <img src={track.artwork} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#1db954] text-black">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.18c-.3.42-.84.6-1.26.3-3.22-1.98-8.14-2.56-11.94-1.4-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.42.24.54.84.24 1.22zm.12-3.3C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-.96 15.72 1.62.54.3.72 1.02.42 1.56-.3.54-1.02.72-1.56.42z" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="aries-ticker flex w-max whitespace-nowrap text-[13px] text-zinc-200">
          <span>{loop}</span>
          <span>{loop}</span>
        </div>
      </div>
    </Card>
  );
}

export function HomePage() {
  const stats = useAppStore((s) => s.stats);
  const counters = useAppStore((s) => s.counters);
  const [tick, setTick] = useState(0);
  const [track, setTrack] = useState<SpotifyTrack | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const pull = () => {
      void window.synvity?.spotifyNow().then((next) => {
        if (alive) setTrack(next ?? null);
      });
    };
    pull();
    const t = setInterval(pull, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const onlineMs = stats.appOnlineMs + (Date.now() - stats.sessionStartedAt) + tick * 0;
  const ticket = counters.find((c) => c.id === "ticket");
  const specs = counters.find((c) => c.id === "event-specs");
  const todayStart = startOfDay().getTime();
  const weekStart = startOfWeek().getTime();
  const ticketToday = counterPeriodTotals(ticket, todayStart, todayStart + 86400000);
  const specsToday = counterPeriodTotals(specs, todayStart, todayStart + 86400000);
  const ticketWeek = counterPeriodTotals(ticket, weekStart, weekStart + 7 * 86400000);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-4 xl:p-5">
      <NowPlayingTicker track={track} reportsToday={ticketToday.inPeriod} specsToday={specsToday.inPeriod} />
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Reporty dziś"
          value={ticketToday.inPeriod}
          unit="Ticket"
          accent="bg-violet-500"
          hint={`Łącznie ${ticketToday.total} · wczoraj ${ticketToday.previous}`}
          trend={ticketToday.change}
        />
        <StatCard
          title="Reporty w tym tygodniu"
          value={ticketWeek.inPeriod}
          unit="Ticket"
          accent="bg-violet-400"
          hint={`Śr. ${ticketWeek.avg.toFixed(1)} / dzień · ${ticketWeek.activeDays} dni aktywności`}
          trend={ticketWeek.change}
        />
        <StatCard
          title="Event Specs dziś"
          value={specsToday.inPeriod}
          unit="Event Specs"
          accent="bg-emerald-500"
          hint={`Łącznie ${specsToday.total} · seria ${specsToday.streak} dni`}
          trend={specsToday.change}
        />
        <StatCard
          title="Czas w aplikacji"
          value={formatDuration(onlineMs)}
          accent="bg-zinc-500"
          hint="Czas pracy tej instalacji, bez przerw między sesjami."
        />
      </div>
    </div>
  );
}
