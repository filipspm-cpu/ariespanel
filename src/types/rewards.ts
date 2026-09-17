import type { AchievementStats } from "@/data/achievements";

export type RewardPayout = {
  id: number;
  kind: string;
  amount: number;
  status: "pending" | "paid";
  createdAt: string;
};

export type RewardsState = {
  ok: boolean;
  error?: string;
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
};

export type AccountRewards = {
  id: string;
  code: string;
  referrals: number;
  redeemed: boolean;
  pendingCash: number;
  paidCash: number;
  points: number;
};
