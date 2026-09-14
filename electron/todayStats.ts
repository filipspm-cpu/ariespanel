export function startOfLocalDayMs(d: Date = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function todayCount(history: { timestamp: number; delta: number }[] | undefined, now = Date.now()) {
  const start = startOfLocalDayMs(new Date(now));
  const end = start + 86_400_000;
  return (history ?? []).reduce((sum, entry) => {
    if (entry.timestamp < start || entry.timestamp >= end) return sum;
    return sum + entry.delta;
  }, 0);
}
