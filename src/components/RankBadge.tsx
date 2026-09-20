import { accountRank, accountRanks, type AccountRank } from "@/data/testers";
import { useAppStore } from "@/store/useAppStore";
import { useMemo } from "react";

export function useAccountRank(discordId: string | undefined): AccountRank | null {
  const testers = useAppStore((s) => s.testers);
  return accountRank(discordId, testers);
}

export function useAccountRanks(discordId: string | undefined): AccountRank[] {
  const testers = useAppStore((s) => s.testers);
  return useMemo(() => accountRanks(discordId, testers), [discordId, testers]);
}

export function RankBadge({
  rank,
  size = "sm",
}: {
  rank: AccountRank | null;
  size?: "xs" | "sm" | "md";
}) {
  if (!rank) return null;
  const labels = {
    "main-developer": { xs: "M-DEV", full: "MAIN DEVELOPER" },
    developer: { xs: "Dev", full: "Developer" },
    vip: { xs: "VIP", full: "VIP" },
    beta: { xs: "Beta", full: "Beta tester" },
  } as const;
  const label = size === "xs" ? labels[rank].xs : labels[rank].full;
  return <span className={`rank-badge rank-${rank} rank-${size}`}>{label}</span>;
}

export function RankBadges({
  ranks,
  size = "sm",
}: {
  ranks: AccountRank[];
  size?: "xs" | "sm" | "md";
}) {
  if (!ranks.length) return null;
  return (
    <span className="rank-badges">
      {ranks.map((rank) => (
        <RankBadge key={rank} rank={rank} size={size} />
      ))}
    </span>
  );
}
