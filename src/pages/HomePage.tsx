import { Card } from "@/components/ui/Card";
import { MajesticServersPanel } from "@/components/MajesticServersPanel";
import { formatDuration } from "@/services/api";
import { counterPeriodTotals, startOfDay, startOfWeek } from "@/services/counterStats";
import { useAppStore } from "@/store/useAppStore";
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

export function HomePage() {
  const stats = useAppStore((s) => s.stats);
  const counters = useAppStore((s) => s.counters);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
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
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-4 xl:p-5">
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

      <MajesticServersPanel />
    </div>
  );
}
