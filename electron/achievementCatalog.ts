export const PROMO_CASH = 30_000;

export type AchievementStat = "reports" | "events" | "onlineHours" | "nightReports" | "activeDays" | "referrals";
export type AchievementStats = Record<AchievementStat, number>;

type Task = { stat: AchievementStat; need: number; points: number };

const TASKS: Task[] = [
  { stat: "reports", need: 100, points: 30 },
  { stat: "reports", need: 200, points: 50 },
  { stat: "reports", need: 500, points: 90 },
  { stat: "reports", need: 1000, points: 150 },
  { stat: "reports", need: 2000, points: 260 },
  { stat: "reports", need: 3500, points: 420 },
  { stat: "reports", need: 5000, points: 200 },
  { stat: "onlineHours", need: 40, points: 20 },
  { stat: "onlineHours", need: 100, points: 45 },
  { stat: "onlineHours", need: 200, points: 90 },
  { stat: "onlineHours", need: 400, points: 150 },
  { stat: "onlineHours", need: 700, points: 240 },
  { stat: "onlineHours", need: 1000, points: 180 },
  { stat: "events", need: 80, points: 40 },
  { stat: "events", need: 200, points: 80 },
  { stat: "events", need: 500, points: 150 },
  { stat: "events", need: 1000, points: 250 },
  { stat: "referrals", need: 1, points: 100 },
  { stat: "referrals", need: 2, points: 160 },
  { stat: "referrals", need: 5, points: 280 },
  { stat: "referrals", need: 10, points: 450 },
  { stat: "activeDays", need: 14, points: 25 },
  { stat: "activeDays", need: 30, points: 50 },
  { stat: "activeDays", need: 60, points: 90 },
  { stat: "activeDays", need: 120, points: 160 },
  { stat: "nightReports", need: 30, points: 70 },
  { stat: "nightReports", need: 80, points: 140 },
  { stat: "nightReports", need: 180, points: 250 },
  { stat: "nightReports", need: 300, points: 160 },
];

export const MONEY_TIERS = [
  { id: "cash-1500", points: 1500, amount: 10_000 },
  { id: "cash-2400", points: 2400, amount: 20_000 },
  { id: "cash-3300", points: 3300, amount: 30_000 },
  { id: "cash-4300", points: 4300, amount: 50_000 },
];

export function totalAchievementPoints(stats: AchievementStats) {
  return TASKS.filter((task) => (stats[task.stat] || 0) >= task.need).reduce((sum, task) => sum + task.points, 0);
}
