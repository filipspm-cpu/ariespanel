import type { AchievementStats, AchievementTask } from "@/data/achievements";

export type RewardPayout = {
  id: number;
  kind: string;
  amount: number;
  status: "pending" | "paid";
  createdAt: string;
};

export type AccountRewards = {
  id: string;
  name?: string;
  avatarUrl?: string;
  code: string;
  referrals: number;
  redeemed: boolean;
  pendingCash: number;
  paidCash: number;
  points: number;
};

export type RewardsState = {
  ok: boolean;
  error?: string;
  detail?: string;
  code: string;
  redeemed: boolean;
  redeemedCode: string;
  referrals: number;
  points: number;
  stats: AchievementStats;
  pendingCash: number;
  paidCash: number;
  payouts: RewardPayout[];
  claimedKinds: string[];
  customTasks?: AchievementTask[];
  leaderboard?: AccountRewards[];
  deviceLocked?: boolean;
};

export type CustomAchievementInput = {
  label: string;
  hint?: string;
  category?: string;
  stat: string;
  need: number;
  points: number;
  rarity?: string;
};
