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
  const label =
    size === "xs"
      ? rank === "developer"
        ? "Dev"
        : "Beta"
      : rank === "developer"
        ? "Developer"
        : "Beta tester";
  return <span className={`rank-badge rank-${rank} rank-${size}`}>{label}</span>;
}
