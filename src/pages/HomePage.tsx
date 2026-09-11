import { MajesticServersPanel } from "@/components/MajesticServersPanel";
import { RollingNumber } from "@/components/RollingNumber";
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
  trend,
  delay = 0,
  format,
}: {
  title: string;
  value: number;
  unit?: string;
  hint?: string;
  trend?: number;
  delay?: number;
  format?: (n: number) => string;
}) {
  const TrendIcon = (trend ?? 0) >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className="home-stat">
      <div className="home-stat-label">{title}</div>
      <div className="home-stat-value">
        <strong className="tabular-nums">
          <RollingNumber value={value} delay={delay} format={format} />
        </strong>
        {unit ? <span>{unit}</span> : null}
      </div>
      <div className="home-stat-foot">
        {hint ? <div className="home-stat-hint">{hint}</div> : <span />}
        {typeof trend === "number" ? (
          <span className={`home-stat-trend ${trend >= 0 ? "up" : "down"}`}>
            <TrendIcon size={12} />
            {trend > 0 ? "+" : ""}
            <RollingNumber value={trend} delay={delay + 80} format={(n) => `${Math.round(n)}`} />%
          </span>
        ) : null}
      </div>
    </div>
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
  const onlineMin = Math.max(0, Math.floor(onlineMs / 60000));
  const ticket = counters.find((c) => c.id === "ticket");
  const specs = counters.find((c) => c.id === "event-specs");
  const todayStart = startOfDay().getTime();
  const weekStart = startOfWeek().getTime();
  const ticketToday = counterPeriodTotals(ticket, todayStart, todayStart + 86400000);
  const specsToday = counterPeriodTotals(specs, todayStart, todayStart + 86400000);
  const ticketWeek = counterPeriodTotals(ticket, weekStart, weekStart + 7 * 86400000);

  return (
    <div className="home-page">
      <div className="home-stats grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Reporty dziś"
          value={ticketToday.inPeriod}
          unit="Reporty"
          hint={`Łącznie ${ticketToday.total} · wczoraj ${ticketToday.previous}`}
          trend={ticketToday.change}
          delay={40}
        />
        <StatCard
          title="Reporty w tym tygodniu"
          value={ticketWeek.inPeriod}
          unit="Reporty"
          hint={`Śr. ${ticketWeek.avg.toFixed(1)} / dzień · ${ticketWeek.activeDays} dni aktywności`}
          trend={ticketWeek.change}
          delay={110}
        />
        <StatCard
          title="Event Specs dziś"
          value={specsToday.inPeriod}
          unit="Event Specs"
          hint={`Łącznie ${specsToday.total} · seria ${specsToday.streak} dni`}
          trend={specsToday.change}
          delay={180}
        />
        <StatCard
          title="Czas w aplikacji"
          value={onlineMin}
          hint="Czas pracy tej instalacji, bez przerw między sesjami."
          delay={250}
          format={(n) => formatDuration(Math.max(0, n) * 60000)}
        />
      </div>

      <MajesticServersPanel />
    </div>
  );
}
