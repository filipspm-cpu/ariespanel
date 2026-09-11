import { Select } from "@/components/ui/Select";
import {
  addDays,
  counterPeriodTotals,
  seriesFromHistory,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "@/services/counterStats";
import { useAppStore } from "@/store/useAppStore";
import type { Counter } from "@/types";
import { Flame, Minus, Plus, RotateCcw, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

function periodBounds(period: string) {
  const now = new Date();
  if (period === "week") {
    const start = startOfWeek(now);
    return { start: start.getTime(), end: addDays(start, 7).getTime() };
  }
  if (period === "month") {
    const start = startOfMonth(now);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: start.getTime(), end: end.getTime() };
  }
  const start = startOfDay(now);
  return { start: start.getTime(), end: start.getTime() + 86400000 };
}

function formatStamp(ts: number) {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
}

function MiniChart({ points, color }: { points: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 520;
  const h = 88;
  const pad = { l: 8, r: 8, t: 10, b: 18 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const group = points.length ? innerW / points.length : innerW;
  const barW = Math.max(3, Math.min(18, group * 0.55));
  const labelEvery = points.length > 16 ? 4 : points.length > 10 ? 2 : 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[88px] w-full">
      {points.map((p, i) => {
        const x = pad.l + i * group + group / 2;
        const bh = (p.value / max) * innerH;
        return (
          <g key={`${p.label}-${i}`}>
            <rect x={x - barW / 2} y={pad.t + innerH - bh} width={barW} height={Math.max(0, bh)} rx="2" fill={color}>
              <title>{`${p.label}: ${p.value}`}</title>
            </rect>
            <text x={x} y={h - 4} textAnchor="middle" fill="#6e6e6e" fontSize="8">
              {i % labelEvery === 0 ? p.label : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function CountersPage() {
  const counters = useAppStore((s) => s.counters);
  const setCounters = useAppStore((s) => s.setCounters);
  const bumpCounter = useAppStore((s) => s.bumpCounter);
  const removeCounterEntry = useAppStore((s) => s.removeCounterEntry);
  const clearCounterToday = useAppStore((s) => s.clearCounterToday);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(counters[0]?.id ?? "");
  const [period, setPeriod] = useState("day");

  const selected = counters.find((c) => c.id === selectedId) ?? counters[0];
  const visible = counters.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  const update = (id: string, patch: Partial<Counter>) => {
    setCounters(counters.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  useEffect(() => {
    if (!selected) return;
    if ((selected.history?.length ?? 0) === 0 && selected.value > 0) {
      update(selected.id, {
        history: [{ timestamp: Date.now(), delta: selected.value }],
      });
    }
  }, [selected?.id]);

  const bounds = periodBounds(period);
  const hourly = period === "day";
  const history = useMemo(() => {
    const rows = (selected?.history ?? []).filter((h) => h.timestamp >= bounds.start && h.timestamp < bounds.end);
    return [...rows].reverse();
  }, [selected?.history, bounds.start, bounds.end]);

  const totals = selected ? counterPeriodTotals(selected, bounds.start, bounds.end) : null;
  const chart = selected
    ? seriesFromHistory(selected.history, bounds.start, bounds.end, hourly)
    : [];

  if (!selected) {
    return (
      <div className="ink-page p-6 text-[13px] text-zinc-500">
        Brak statystyk.
      </div>
    );
  }

  let running = selected.value;
  const historyWithTotal = history.map((entry) => {
    const after = running;
    running -= entry.delta;
    return { ...entry, after };
  });

  const periodLabel = period === "week" ? "Tydzień" : period === "month" ? "Miesiąc" : "Dziś";
  const TrendIcon = (totals?.change ?? 0) >= 0 ? TrendingUp : TrendingDown;
  const barColor = selected.color === "green" ? "#22c55e" : "#8b5cf6";

  return (
    <div className="ink-page flex min-h-0">
      <div className="ink-side flex w-[240px] shrink-0 flex-col">
        <div className="flex items-center justify-between px-3 py-3">
          <div className="text-[14px] font-medium">Statystyki</div>
        </div>
        <div className="px-3 pb-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj"
            className="h-8 w-full rounded-md border px-2 text-[12px]"
          />
        </div>
        <div className="space-y-1 overflow-auto px-2">
          {visible.map((c) => {
            const today = counterPeriodTotals(c, startOfDay().getTime(), startOfDay().getTime() + 86400000);
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left ${
                  c.id === selected.id ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-md ${
                    c.color === "green" ? "bg-emerald-500/15 text-emerald-400" : "bg-violet-500/15 text-violet-400"
                  }`}
                >
                  {c.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] text-white">{c.name}</div>
                  <div className="text-[11px] text-zinc-600">
                    {c.value} łącznie · dziś {today.inPeriod}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-5">
        <div className="flex shrink-0 items-start justify-between">
          <div>
            <div className="text-[20px] font-semibold text-white">{selected.name}</div>
            <div className="text-[12px] text-zinc-500">{selected.description}</div>
          </div>
          <button
            onClick={() => bumpCounter(selected.id, 1)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="mt-4 grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="ink-card p-4">
            <div className="text-[12px] text-zinc-500">W okresie · {periodLabel}</div>
            <div className="mt-2 text-[26px] font-semibold tabular-nums">{totals?.inPeriod ?? 0}</div>
            <div className={`mt-1 flex items-center gap-1 text-[11px] ${(totals?.change ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              <TrendIcon size={12} />
              {totals && totals.change > 0 ? "+" : ""}
              {totals?.change ?? 0}% vs poprzedni okres
            </div>
          </div>
          <div className="ink-card p-4">
            <div className="text-[12px] text-zinc-500">Razem</div>
            <div className="mt-2 text-[26px] font-semibold tabular-nums">{selected.value}</div>
            <div className="text-[11px] text-zinc-600">Poprzedni okres: {totals?.previous ?? 0}</div>
          </div>
          <div className="ink-card p-4">
            <div className="text-[12px] text-zinc-500">Średnio / dzień</div>
            <div className="mt-2 text-[26px] font-semibold tabular-nums">{(totals?.avg ?? 0).toFixed(1)}</div>
            <div className="flex items-center gap-1 text-[11px] text-zinc-600">
              <Flame size={12} className="text-orange-400" />
              Seria {totals?.streak ?? 0} dni
            </div>
          </div>
          <div className="ink-card p-4">
            <div className="text-[12px] text-zinc-500">Okres</div>
            <Select
              className="mt-3"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "day", label: "Dzień" },
                { value: "week", label: "Tydzień" },
                { value: "month", label: "Miesiąc" },
              ]}
            />
          </div>
        </div>

        <div className="ink-card mt-4 shrink-0 p-3">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[12px] text-zinc-500">
              {hourly ? "Rozkład godzinowy" : "Rozkład dzienny"} · szczyt {totals?.peak.value ?? 0}
            </div>
            <div className="text-[11px] text-zinc-600">{totals?.activeDays ?? 0} dni z aktywnością</div>
          </div>
          <MiniChart points={chart} color={barColor} />
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap gap-2">
          <IconBtn onClick={() => bumpCounter(selected.id, 1)} icon={<Plus size={14} />} label="Zwiększ" />
          <IconBtn onClick={() => bumpCounter(selected.id, -1)} icon={<Minus size={14} />} label="Zmniejsz" />
          <IconBtn
            onClick={() => clearCounterToday(selected.id)}
            icon={<Trash2 size={14} />}
            label="Usuń dzisiejsze"
          />
          <IconBtn
            onClick={() => update(selected.id, { value: 0, history: [] })}
            icon={<RotateCcw size={14} />}
            label="Reset"
          />
        </div>

        <div className="ink-card mt-4 flex min-h-0 flex-1 flex-col p-4">
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-white">Historia</div>
              <div className="text-[11px] text-zinc-500">
                {historyWithTotal.length
                  ? `${historyWithTotal.length} wpisów w wybranym okresie`
                  : "Brak wpisów w wybranym okresie"}
              </div>
            </div>
            <div className="text-[12px] text-zinc-500">Stan: {selected.value}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {historyWithTotal.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-zinc-600">
                Użyj + / − albo skrótu, żeby dodać wpis.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {historyWithTotal.map((entry, i) => (
                  <div key={`${entry.timestamp}-${i}`} className="flex items-center justify-between py-2.5">
                    <div className="text-[13px] text-zinc-400">{formatStamp(entry.timestamp)}</div>
                    <div className={`text-[13px] font-medium ${entry.delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 text-right text-[13px] text-white tabular-nums">{entry.after}</div>
                      <button
                        className="text-zinc-600 hover:text-red-400"
                        onClick={() => removeCounterEntry(selected.id, entry.timestamp, entry.delta)}
                        title="Usuń wpis"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ onClick, icon, label }: { onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="ink-btn"
    >
      {icon}
      {label}
    </button>
  );
}
