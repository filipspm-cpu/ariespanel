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

export type AccountRank = "developer" | "vip" | "beta";

export const RANK_ORDER: AccountRank[] = ["developer", "vip", "beta"];

export function ranksFromRole(role: string): AccountRank[] {
  const found = new Set<AccountRank>();
  for (const part of role.split(/[,|/]+/)) {
    const token = part.trim();
    if (!token) continue;
    if (/dev/i.test(token)) found.add("developer");
    else if (/vip/i.test(token)) found.add("vip");
    else if (/beta/i.test(token)) found.add("beta");
  }
  if (!found.size) {
    if (/dev/i.test(role)) found.add("developer");
    if (/vip/i.test(role)) found.add("vip");
    if (/beta/i.test(role)) found.add("beta");
  }
  return RANK_ORDER.filter((rank) => found.has(rank));
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
  return accountRanks(discordId, testers).includes("developer");
}

export function isBetaTester(discordId: string | undefined, testers: Tester[]) {
  return hasBetaAccess(accountRanks(discordId, testers));
}

export function hasBetaAccess(rank: AccountRank | AccountRank[] | null | undefined) {
  const ranks = asRankList(rank);
  return ranks.includes("beta") || ranks.includes("developer");
}

export function hasDeveloperAccess(rank: AccountRank | AccountRank[] | null | undefined) {
  return asRankList(rank).includes("developer");
}
