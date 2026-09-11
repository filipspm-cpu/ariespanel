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

export function isBetaTester(discordId: string | undefined, testers: Tester[]) {
  if (!discordId) return false;
  return testers.some((t) => t.id === discordId && /beta/i.test(t.role));
}
