export type Tester = {
  name: string;
  discord: string;
  id: string;
  role: string;
};

export function parseTesterLine(line: string): Tester | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const parts = trimmed.split("|").map((p) => p.trim());
  if (parts.length < 4 || !parts[2]) return null;
  return { name: parts[0], discord: parts[1], id: parts[2], role: parts[3] };
}

export function parseTesters(raw: string): Tester[] {
  return raw.split(/\r?\n/).map(parseTesterLine).filter((row): row is Tester => Boolean(row));
}

export type AccountRank = "main-developer" | "developer" | "vip" | "beta";

export const RANK_ORDER: AccountRank[] = ["main-developer", "developer", "vip", "beta"];
/** Developer / VIP / Beta — MAIN DEVELOPER widać w panelu, ale nie da się go nadać ani zdjąć. */
export const EDITABLE_RANKS: AccountRank[] = ["developer", "vip", "beta"];

function rankFromToken(token: string): AccountRank | null {
  const normalized = token.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (!normalized) return null;
  if (normalized === "m-dev" || normalized === "mdev" || normalized.includes("main-dev")) return "main-developer";
  if (normalized.includes("dev")) return "developer";
  if (normalized.includes("vip")) return "vip";
  if (normalized.includes("beta")) return "beta";
  return null;
}

export function ranksFromRole(role: string): AccountRank[] {
  const found = new Set<AccountRank>();
  for (const part of role.split(/[,|/]+/)) {
    const rank = rankFromToken(part);
    if (rank) found.add(rank);
  }
  if (!found.size) {
    const rank = rankFromToken(role);
    if (rank) found.add(rank);
  }
  return RANK_ORDER.filter((item) => found.has(item));
}

export function rankFromRole(role: string): AccountRank | null {
  return ranksFromRole(role)[0] ?? null;
}

export function encodeRanks(ranks: AccountRank[]): string {
  return RANK_ORDER.filter((rank) => ranks.includes(rank)).join(",");
}

function asRankList(rank: AccountRank | AccountRank[] | null | undefined): AccountRank[] {
  if (Array.isArray(rank)) return RANK_ORDER.filter((item) => rank.includes(item));
  return rank ? [rank] : [];
}

export function accountRanks(discordId: string | undefined, testers: Tester[]): AccountRank[] {
  if (!discordId) return [];
  const row = testers.find((t) => t.id === discordId);
  if (!row) return [];
  return ranksFromRole(row.role);
}

export function accountRank(discordId: string | undefined, testers: Tester[]): AccountRank | null {
  return accountRanks(discordId, testers)[0] ?? null;
}

export function isDeveloper(discordId: string | undefined, testers: Tester[]) {
  return hasDeveloperAccess(accountRanks(discordId, testers));
}

export function isBetaTester(discordId: string | undefined, testers: Tester[]) {
  return hasBetaAccess(accountRanks(discordId, testers));
}

export function hasBetaAccess(rank: AccountRank | AccountRank[] | null | undefined) {
  const ranks = asRankList(rank);
  return ranks.includes("beta") || ranks.includes("developer") || ranks.includes("main-developer");
}

export function hasDeveloperAccess(rank: AccountRank | AccountRank[] | null | undefined) {
  const ranks = asRankList(rank);
  return ranks.includes("main-developer") || ranks.includes("developer");
}
