import testersFile from "@/data/testers.txt?raw";
import { accountRank, parseTesters, type AccountRank } from "@/data/testers";

const testers = parseTesters(testersFile);

export function useAccountRank(discordId: string | undefined): AccountRank | null {
  return accountRank(discordId, testers);
}

export function RankBadge({
  rank,
  size = "sm",
}: {
  rank: AccountRank | null;
  size?: "sm" | "md";
}) {
  if (!rank) return null;
  const label = rank === "developer" ? "Developer" : "Beta tester";
  return <span className={`rank-badge rank-${rank} rank-${size}`}>{label}</span>;
}
