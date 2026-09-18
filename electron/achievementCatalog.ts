export const PROMO_CASH = 30_000;

export type AchievementStat = "reports" | "events" | "onlineHours" | "nightReports" | "activeDays" | "referrals";
export type AchievementStats = Record<AchievementStat, number>;

export type CatalogTask = { id: string; stat: AchievementStat; need: number; points: number };

export const TASKS: CatalogTask[] = [
  { id: "duty-40", stat: "onlineHours", need: 40, points: 20 },
  { id: "duty-100", stat: "onlineHours", need: 100, points: 45 },
  { id: "duty-200", stat: "onlineHours", need: 200, points: 90 },
  { id: "duty-400", stat: "onlineHours", need: 400, points: 150 },
  { id: "duty-700", stat: "onlineHours", need: 700, points: 240 },
  { id: "duty-1000", stat: "onlineHours", need: 1000, points: 180 },
  { id: "ref-1", stat: "referrals", need: 1, points: 100 },
  { id: "ref-2", stat: "referrals", need: 2, points: 160 },
  { id: "ref-5", stat: "referrals", need: 5, points: 280 },
  { id: "ref-10", stat: "referrals", need: 10, points: 450 },
  { id: "day-14", stat: "activeDays", need: 14, points: 25 },
  { id: "day-30", stat: "activeDays", need: 30, points: 50 },
  { id: "day-60", stat: "activeDays", need: 60, points: 90 },
  { id: "day-120", stat: "activeDays", need: 120, points: 160 },
];

export const MONEY_TIERS = [
  { id: "rank-500", points: 400, amount: 0, prize: "vip" as const },
  { id: "cash-1500", points: 800, amount: 15_000, prize: "cash" as const },
  { id: "cash-2400", points: 1200, amount: 25_000, prize: "cash" as const },
  { id: "cash-3300", points: 1600, amount: 70_000, prize: "cash" as const },
  { id: "cash-4300", points: 2000, amount: 100_000, prize: "cash" as const },
];

export function findCatalogTask(id: string, extra: CatalogTask[] = []) {
  return [...TASKS, ...extra].find((task) => task.id === id);
}

export function totalAchievementPoints(stats: AchievementStats, extra: CatalogTask[] = []) {
  return [...TASKS, ...extra]
    .filter((task) => (stats[task.stat] || 0) >= task.need)
    .reduce((sum, task) => sum + task.points, 0);
}
