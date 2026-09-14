export function calendarDayKey(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function startOfLocalDayMs(d: Date = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function msUntilNextMidnight(now = Date.now()) {
  const d = new Date(now);
  const next = new Date(d);
  next.setHours(24, 0, 0, 0);
  return Math.max(250, next.getTime() - now);
}

export function todayCount(history: { timestamp: number; delta: number }[] | undefined, now = Date.now()) {
  const start = startOfLocalDayMs(new Date(now));
  const end = start + 86_400_000;
  return (history ?? []).reduce((sum, entry) => {
    if (entry.timestamp < start || entry.timestamp >= end) return sum;
    return sum + entry.delta;
  }, 0);
}
