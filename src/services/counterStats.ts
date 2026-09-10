import type { Counter } from "@/types";

export type HistoryEntry = { timestamp: number; delta: number };
export type SeriesPoint = { label: string; value: number; start: number };

const DAY_LABELS = ["Nd", "Pon", "Wt", "Śr", "Czw", "Pt", "Sob"];

export function startOfDay(d: Date = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date = new Date()) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function startOfMonth(d: Date = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sumInRange(history: HistoryEntry[] | undefined, start: number, end: number, positiveOnly = true) {
  return (history ?? []).reduce((sum, entry) => {
    if (entry.timestamp < start || entry.timestamp >= end) return sum;
    if (positiveOnly && entry.delta <= 0) return sum;
    return sum + entry.delta;
  }, 0);
}

export function rangeForHomePeriod(
  period: "today" | "yesterday" | "week" | "month" | "custom",
  fromStr: string,
  toStr: string,
) {
  const now = new Date();
  if (period === "today") {
    const start = startOfDay(now);
    return { start: start.getTime(), end: start.getTime() + 86400000, hourly: true };
  }
  if (period === "yesterday") {
    const start = startOfDay(addDays(now, -1));
    return { start: start.getTime(), end: start.getTime() + 86400000, hourly: true };
  }
  if (period === "week") {
    const start = startOfWeek(now);
    return { start: start.getTime(), end: addDays(start, 7).getTime(), hourly: false };
  }
  if (period === "month") {
    const start = startOfMonth(now);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: start.getTime(), end: end.getTime(), hourly: false };
  }
  const from = startOfDay(fromStr ? new Date(fromStr + "T00:00:00") : addDays(now, -6));
  const to = startOfDay(toStr ? new Date(toStr + "T00:00:00") : now);
  const start = from <= to ? from : to;
  const end = addDays(from <= to ? to : from, 1);
  return { start: start.getTime(), end: end.getTime(), hourly: false };
}

export function seriesFromHistory(
  history: HistoryEntry[] | undefined,
  start: number,
  end: number,
  hourly: boolean,
) {
  const step = hourly ? 3600000 : 86400000;
  const buckets: SeriesPoint[] = [];
  for (let t = start; t < end; t += step) {
    const d = new Date(t);
    let label: string;
    if (hourly) label = `${String(d.getHours()).padStart(2, "0")}:00`;
    else if (end - start > 14 * 86400000) label = `${d.getDate()}.${d.getMonth() + 1}`;
    else label = `${d.getDate()} ${DAY_LABELS[d.getDay()]}`;
    buckets.push({ label, start: t, value: 0 });
  }
  for (const entry of history ?? []) {
    if (entry.delta <= 0) continue;
    if (entry.timestamp < start || entry.timestamp >= end) continue;
    const i = Math.floor((entry.timestamp - start) / step);
    if (buckets[i]) buckets[i].value += entry.delta;
  }
  return buckets;
}

export function previousRange(start: number, end: number) {
  const span = end - start;
  return { start: start - span, end: start };
}

export function peakDay(history: HistoryEntry[] | undefined, start: number, end: number) {
  const byDay = new Map<number, number>();
  for (const entry of history ?? []) {
    if (entry.delta <= 0 || entry.timestamp < start || entry.timestamp >= end) continue;
    const key = startOfDay(new Date(entry.timestamp)).getTime();
    byDay.set(key, (byDay.get(key) ?? 0) + entry.delta);
  }
  let peak = { value: 0, at: start };
  for (const [at, value] of byDay) {
    if (value > peak.value) peak = { value, at };
  }
  return peak;
}

export function activeDays(history: HistoryEntry[] | undefined, start: number, end: number) {
  const days = new Set<number>();
  for (const entry of history ?? []) {
    if (entry.delta <= 0 || entry.timestamp < start || entry.timestamp >= end) continue;
    days.add(startOfDay(new Date(entry.timestamp)).getTime());
  }
  return days.size;
}

export function streakDays(history: HistoryEntry[] | undefined) {
  const days = new Set<number>();
  for (const entry of history ?? []) {
    if (entry.delta <= 0) continue;
    days.add(startOfDay(new Date(entry.timestamp)).getTime());
  }
  let streak = 0;
  let cursor = startOfDay().getTime();
  if (!days.has(cursor)) cursor -= 86400000;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86400000;
  }
  return streak;
}

export function counterPeriodTotals(counter: Counter | undefined, start: number, end: number) {
  const history = counter?.history ?? [];
  const inPeriod = sumInRange(history, start, end);
  const prev = previousRange(start, end);
  const previous = sumInRange(history, prev.start, prev.end);
  const days = Math.max(1, Math.round((end - start) / 86400000));
  const peak = peakDay(history, start, end);
  const active = activeDays(history, start, end);
  const change = previous === 0 ? (inPeriod > 0 ? 100 : 0) : Math.round(((inPeriod - previous) / previous) * 100);
  return {
    total: counter?.value ?? 0,
    inPeriod,
    previous,
    change,
    avg: inPeriod / days,
    peak,
    activeDays: active,
    streak: streakDays(history),
  };
}
