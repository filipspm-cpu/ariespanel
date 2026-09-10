import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { formatDuration } from "@/services/api";
import {
  addDays,
  counterPeriodTotals,
  isoDate,
  rangeForHomePeriod,
  seriesFromHistory,
  startOfDay,
  startOfWeek,
} from "@/services/counterStats";
import { useAppStore } from "@/store/useAppStore";
import { Activity, CalendarRange, Sparkles, Ticket, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Period = "today" | "yesterday" | "week" | "month" | "custom";

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

function StatsChart({
  reports,
  specs,
  hourly,
}: {
  reports: { label: string; value: number }[];
  specs: { label: string; value: number }[];
  hourly: boolean;
}) {
  const max = Math.max(1, ...reports.map((d) => d.value), ...specs.map((d) => d.value));
  const ticks =
    max <= 5 ? Array.from({ length: max + 1 }, (_, i) => i) : [0, Math.round(max / 2), max];
  const w = 1000;
  const h = 260;
  const pad = { l: 44, r: 12, t: 22, b: 32 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const group = reports.length ? innerW / reports.length : innerW;
  const barW = Math.max(4, Math.min(hourly ? 12 : 28, group * 0.32));
  const labelEvery = reports.length > 20 ? 3 : reports.length > 12 ? 2 : 1;
  const showValues = !hourly && reports.length <= 14;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
      <text x={8} y={12} fill="#52525b" fontSize="10">
        szt.
      </text>
      {ticks.map((tick) => {
        const y = pad.t + innerH - (tick / max) * innerH;
        return (
          <g key={tick}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="#222226" strokeWidth="1" />
            <text x={8} y={y + 4} fill="#52525b" fontSize="11">
              {tick}
            </text>
          </g>
        );
      })}
      {reports.map((d, i) => {
        const x = pad.l + i * group + group / 2;
        const rh = (d.value / max) * innerH;
        const specH = ((specs[i]?.value ?? 0) / max) * innerH;
        return (
          <g key={`${d.label}-${i}`}>
            <rect x={x - barW - 2} y={pad.t + innerH - rh} width={barW} height={Math.max(0, rh)} rx="3" fill="#8b5cf6">
              <title>{`${d.label}: ${d.value} reportów`}</title>
            </rect>
            <rect x={x + 2} y={pad.t + innerH - specH} width={barW} height={Math.max(0, specH)} rx="3" fill="#22c55e">
              <title>{`${d.label}: ${specs[i]?.value ?? 0} Event Specs`}</title>
            </rect>
            {showValues && d.value > 0 ? (
              <text x={x - barW / 2 - 2} y={pad.t + innerH - rh - 4} textAnchor="middle" fill="#c4b5fd" fontSize="10">
                {d.value}
              </text>
            ) : null}
            {showValues && (specs[i]?.value ?? 0) > 0 ? (
              <text x={x + barW / 2 + 2} y={pad.t + innerH - specH - 4} textAnchor="middle" fill="#86efac" fontSize="10">
                {specs[i].value}
              </text>
            ) : null}
            <text x={x} y={h - 10} textAnchor="middle" fill="#73737a" fontSize={hourly ? 9 : reports.length > 16 ? 9 : 11}>
              {i % labelEvery === 0 ? d.label : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function periodCaption(period: Period, fromStr: string, toStr: string, hourly: boolean) {
  if (period === "today") return "Dziś — reporty i Event Specs co godzinę";
  if (period === "yesterday") return "Wczoraj — reporty i Event Specs co godzinę";
  if (period === "week") return "Ten tydzień (pon–nd) — dziennie";
  if (period === "month") return "Ten miesiąc — liczba dziennie";
  return `Okres ${fromStr} – ${toStr}${hourly ? "" : " — dziennie"}`;
}

export function HomePage() {
  const stats = useAppStore((s) => s.stats);
  const counters = useAppStore((s) => s.counters);
  const [tick, setTick] = useState(0);
  const [period, setPeriod] = useState<Period>("today");
  const [fromDate, setFromDate] = useState(() => isoDate(addDays(new Date(), -6)));
  const [toDate, setToDate] = useState(() => isoDate(new Date()));

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const onlineMs = stats.appOnlineMs + (Date.now() - stats.sessionStartedAt) + tick * 0;
  const ticket = counters.find((c) => c.id === "ticket");
  const specs = counters.find((c) => c.id === "event-specs");
  const range = useMemo(() => rangeForHomePeriod(period, fromDate, toDate), [period, fromDate, toDate]);

  const reportDays = useMemo(
    () => seriesFromHistory(ticket?.history, range.start, range.end, range.hourly),
    [ticket?.history, range],
  );
  const specDays = useMemo(
    () => seriesFromHistory(specs?.history, range.start, range.end, range.hourly),
    [specs?.history, range],
  );

  const todayStart = startOfDay().getTime();
  const weekStart = startOfWeek().getTime();
  const ticketToday = counterPeriodTotals(ticket, todayStart, todayStart + 86400000);
  const specsToday = counterPeriodTotals(specs, todayStart, todayStart + 86400000);
  const ticketWeek = counterPeriodTotals(ticket, weekStart, weekStart + 7 * 86400000);
  const rangeTicket = counterPeriodTotals(ticket, range.start, range.end);
  const rangeSpecs = counterPeriodTotals(specs, range.start, range.end);
  const periodDays = Math.max(1, Math.round((range.end - range.start) / 86400000));

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

      <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="flex items-center justify-between gap-3 p-3">
          <div>
            <div className="text-[11px] text-zinc-500">W wybranym okresie</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-white">
              {rangeTicket.inPeriod}
              <span className="ml-1 text-[12px] font-normal text-zinc-500">reportów</span>
            </div>
          </div>
          <Ticket size={16} className="text-violet-400" />
        </Card>
        <Card className="flex items-center justify-between gap-3 p-3">
          <div>
            <div className="text-[11px] text-zinc-500">Event Specs w okresie</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-white">
              {rangeSpecs.inPeriod}
              <span className="ml-1 text-[12px] font-normal text-zinc-500">szt.</span>
            </div>
          </div>
          <Sparkles size={16} className="text-emerald-400" />
        </Card>
        <Card className="flex items-center justify-between gap-3 p-3">
          <div>
            <div className="text-[11px] text-zinc-500">Najlepszy dzień</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-white">
              {rangeTicket.peak.value}
              <span className="ml-1 text-[12px] font-normal text-zinc-500">
                {rangeTicket.peak.value ? new Date(rangeTicket.peak.at).toLocaleDateString("pl-PL") : "—"}
              </span>
            </div>
          </div>
          <CalendarRange size={16} className="text-zinc-500" />
        </Card>
        <Card className="flex items-center justify-between gap-3 p-3">
          <div>
            <div className="text-[11px] text-zinc-500">Średnio / dzień</div>
            <div className="mt-1 text-[18px] font-semibold tabular-nums text-white">
              {(rangeTicket.inPeriod / periodDays).toFixed(1)}
              <span className="ml-1 text-[12px] font-normal text-zinc-500">z {periodDays} dni</span>
            </div>
          </div>
          <Activity size={16} className="text-zinc-500" />
        </Card>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[15px] font-medium text-white">Statystyki</div>
            <div className="text-[12px] text-zinc-500">{periodCaption(period, fromDate, toDate, range.hourly)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              className="w-[200px]"
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              options={[
                { value: "today", label: "Dziś (godziny)" },
                { value: "yesterday", label: "Wczoraj (godziny)" },
                { value: "week", label: "Ten tydzień" },
                { value: "month", label: "Cały miesiąc" },
                { value: "custom", label: "Wyznaczony okres" },
              ]}
            />
            {period === "custom" ? (
              <>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9 rounded-md border border-syn-border bg-[#0e0e10] px-2 text-[12px] text-zinc-300 outline-none"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9 rounded-md border border-syn-border bg-[#0e0e10] px-2 text-[12px] text-zinc-300 outline-none"
                />
              </>
            ) : null}
            <span className="flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" /> Reporty
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-sm bg-syn-green" /> Event Specs
            </span>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <StatsChart reports={reportDays} specs={specDays} hourly={range.hourly} />
        </div>
      </Card>
    </div>
  );
}
