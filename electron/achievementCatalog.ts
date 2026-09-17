export const PROMO_CASH = 30_000;

export type AchievementStat = "reports" | "events" | "onlineHours" | "nightReports" | "activeDays" | "referrals";
export type AchievementStats = Record<AchievementStat, number>;

export type CatalogTask = { id: string; stat: AchievementStat; need: number; points: number };

export const TASKS: CatalogTask[] = [
  { id: "rep-100", stat: "reports", need: 100, points: 30 },
  { id: "rep-200", stat: "reports", need: 200, points: 50 },
  { id: "rep-500", stat: "reports", need: 500, points: 90 },
  { id: "rep-1000", stat: "reports", need: 1000, points: 150 },
  { id: "rep-2000", stat: "reports", need: 2000, points: 260 },
  { id: "rep-3500", stat: "reports", need: 3500, points: 420 },
  { id: "rep-5000", stat: "reports", need: 5000, points: 200 },
  { id: "duty-40", stat: "onlineHours", need: 40, points: 20 },
  { id: "duty-100", stat: "onlineHours", need: 100, points: 45 },
  { id: "duty-200", stat: "onlineHours", need: 200, points: 90 },
  { id: "duty-400", stat: "onlineHours", need: 400, points: 150 },
  { id: "duty-700", stat: "onlineHours", need: 700, points: 240 },
  { id: "duty-1000", stat: "onlineHours", need: 1000, points: 180 },
  { id: "ev-80", stat: "events", need: 80, points: 40 },
  { id: "ev-200", stat: "events", need: 200, points: 80 },
  { id: "ev-500", stat: "events", need: 500, points: 150 },
  { id: "ev-1000", stat: "events", need: 1000, points: 250 },
  { id: "ref-1", stat: "referrals", need: 1, points: 100 },
  { id: "ref-2", stat: "referrals", need: 2, points: 160 },
  { id: "ref-5", stat: "referrals", need: 5, points: 280 },
  { id: "ref-10", stat: "referrals", need: 10, points: 450 },
  { id: "day-14", stat: "activeDays", need: 14, points: 25 },
  { id: "day-30", stat: "activeDays", need: 30, points: 50 },
  { id: "day-60", stat: "activeDays", need: 60, points: 90 },
  { id: "day-120", stat: "activeDays", need: 120, points: 160 },
  { id: "night-30", stat: "nightReports", need: 30, points: 70 },
  { id: "night-80", stat: "nightReports", need: 80, points: 140 },
  { id: "night-180", stat: "nightReports", need: 180, points: 250 },
  { id: "night-300", stat: "nightReports", need: 300, points: 160 },
];

export const MONEY_TIERS = [
  { id: "rank-500", points: 500, amount: 0, prize: "vip" as const },
  { id: "cash-1500", points: 1500, amount: 15_000, prize: "cash" as const },
  { id: "cash-2400", points: 2400, amount: 25_000, prize: "cash" as const },
  { id: "cash-3300", points: 3300, amount: 70_000, prize: "cash" as const },
  { id: "cash-4300", points: 4300, amount: 100_000, prize: "cash" as const },
];

export function findCatalogTask(id: string, extra: CatalogTask[] = []) {
  return [...TASKS, ...extra].find((task) => task.id === id);
}

export function totalAchievementPoints(stats: AchievementStats, extra: CatalogTask[] = []) {
  return [...TASKS, ...extra]
    .filter((task) => (stats[task.stat] || 0) >= task.need)
    .reduce((sum, task) => sum + task.points, 0);
}
