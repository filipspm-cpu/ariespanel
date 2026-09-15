import { accountRank, type AccountRank } from "@/data/testers";
import { useAppStore } from "@/store/useAppStore";

export function useAccountRank(discordId: string | undefined): AccountRank | null {
  const testers = useAppStore((s) => s.testers);
  return accountRank(discordId, testers);
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
    developer: { xs: "Dev", full: "Developer" },
    vip: { xs: "VIP", full: "VIP" },
    beta: { xs: "Beta", full: "Beta tester" },
  } as const;
  const label = size === "xs" ? labels[rank].xs : labels[rank].full;
  return <span className={`rank-badge rank-${rank} rank-${size}`}>{label}</span>;
}
