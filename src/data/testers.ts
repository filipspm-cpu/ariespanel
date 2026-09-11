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

export type AccountRank = "developer" | "beta";

export function rankFromRole(role: string): AccountRank | null {
  if (/dev/i.test(role)) return "developer";
  if (/beta/i.test(role)) return "beta";
  return null;
}

export function accountRank(discordId: string | undefined, testers: Tester[]): AccountRank | null {
  if (!discordId) return null;
  const row = testers.find((t) => t.id === discordId);
  if (!row) return null;
  return rankFromRole(row.role);
}

export function isDeveloper(discordId: string | undefined, testers: Tester[]) {
  return accountRank(discordId, testers) === "developer";
}

export function isBetaTester(discordId: string | undefined, testers: Tester[]) {
  const rank = accountRank(discordId, testers);
  return hasBetaAccess(rank);
}

export function hasBetaAccess(rank: AccountRank | null) {
  return rank === "beta" || rank === "developer";
}
