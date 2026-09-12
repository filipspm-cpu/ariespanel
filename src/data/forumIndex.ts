import { FORUM_RULES } from "@/data/forumRules";

export type ForumHit = {
  ruleId: string;
  ruleTitle: string;
  point: string | null;
  section: string | null;
  lineIndex: number;
  text: string;
  penalty: string | null;
  score: number;
};

const POINT_RE = /^(\d+(?:\.\d+)*)(?:[.)]\s*|\s+)/;
const HEADING_RE =
  /^(zasady\b|postanowienia\b|obowiązki lidera\b|warunki dotyczące\b|organizacje kryminalne\b|rodziny i klany\b|dyplomacja\b|dyplomacje\b|działalność\b|liderom zabrania\b|awanse\s*\/\s*zwolnienia\b|wspólne zasady\b|zadania i obowiązki\b)/i;
const STOP = new Set(
  "i w na do z ze a o u sie nie czy jak za od po lub oraz to jest byc tym tej tego ten ta te przy bez nad pod we ale czyli jezeli jesli gdy gdyz przez dla juz tylko tez moze moga ktos kogo czego czym jaki jaka jakie jacy jakiej jakim jakich punkt punkcie kara karze regulamin regulaminu".split(
    " ",
  ),
);

const SYNONYMS: Record<string, string[]> = {
  rdm: ["rdm", "random", "deathmatch", "zabicie", "zabijanie", "atak"],
  vdm: ["vdm", "vehicle", "przejechanie", "pojazd"],
  pg: ["pg", "power", "gaming"],
  nlr: ["nlr", "new", "life", "szpital", "respawn"],
  nrp: ["nrp", "nonrp", "nierealistyczne"],
  ck: ["ck", "character", "kill"],
  sk: ["sk", "spawn"],
  metagaming: ["metagaming", "mg", "ooc"],
  zielona: ["zielona", "zielonej", "greenzone", "bezpieczna"],
  czerwona: ["czerwona", "czerwonej", "redzone"],
  ghetto: ["ghetto", "getto"],
  nalot: ["nalot", "nalotu"],
  kraft: ["kraft", "craft", "crafting"],
  airdrop: ["airdrop", "zrzut"],
  capture: ["capture", "captures", "turf", "turfs"],
  permban: ["permban", "ban", "blokada"],
  lider: ["lider", "lidera", "kadencja"],
  skarga: ["skarga", "skargi", "ticket", "zgloszenie"],
  napad: ["napad", "bank", "biznes"],
  fort: ["fort", "zancudo", "cayo"],
  airdrop2: ["magazyn", "dealer", "dealerow"],
  wojenny: ["wojenny", "wojennego"],
  dostawy: ["dostawy", "dostaw"],
};

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ł/g, "l");
}

function tokens(value: string) {
  return fold(value)
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function expandQuery(query: string) {
  const raw = tokens(query);
  const extra: string[] = [];
  for (const t of raw) {
    extra.push(...(SYNONYMS[t] ?? []));
  }
  return [...new Set([...raw, ...extra])];
}

function splitPenalty(line: string) {
  const pipe = line.lastIndexOf(" | ");
  if (pipe < 0) return { text: line.trim(), penalty: null as string | null };
  return { text: line.slice(0, pipe).trim(), penalty: line.slice(pipe + 3).trim() };
}

type IndexedLine = {
  ruleId: string;
  ruleTitle: string;
  point: string | null;
  section: string | null;
  lineIndex: number;
  raw: string;
  text: string;
  penalty: string | null;
  hay: string;
};

function buildIndex(): IndexedLine[] {
  const rows: IndexedLine[] = [];
  for (const rule of FORUM_RULES) {
    const lines = rule.body.replace(/\u200B/g, "").replace(/\r\n/g, "\n").split("\n");
    let point: string | null = null;
    let section: string | null = rule.title;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const heading = HEADING_RE.test(trimmed.replace(/:$/, "")) && trimmed.length <= 90 && !trimmed.includes("|");
      if (heading) section = trimmed.replace(/:$/, "");
      const pointMatch = trimmed.match(POINT_RE);
      if (pointMatch) point = pointMatch[1];
      const { text, penalty } = splitPenalty(trimmed);
      rows.push({
        ruleId: rule.id,
        ruleTitle: rule.title,
        point,
        section,
        lineIndex: i,
        raw,
        text,
        penalty,
        hay: fold(`${rule.title} ${section ?? ""} ${point ?? ""} ${trimmed}`),
      });
    }
  }
  return rows;
}

const INDEX = buildIndex();

function scoreLine(row: IndexedLine, query: string, qTokens: string[], preferPoints: boolean) {
  const q = fold(query).trim();
  if (!q) return 0;
  let score = 0;
  if (row.hay.includes(q)) score += 80;
  const pointInQuery = query.match(/\b(\d+(?:\.\d+)+)\b/);
  if (pointInQuery && row.point === pointInQuery[1]) score += 200;
  for (const t of qTokens) {
    if (!t) continue;
    if (row.point === t) score += 120;
    if (row.hay.includes(t)) score += t.length >= 4 ? 14 : 7;
  }
  if (preferPoints && row.point && POINT_RE.test(row.raw.trim())) score += 18;
  if (row.penalty) score += 4;
  return score;
}

function uniqueHits(hits: ForumHit[]) {
  const seen = new Set<string>();
  const out: ForumHit[] = [];
  for (const hit of hits) {
    const key = `${hit.ruleId}:${hit.point ?? hit.lineIndex}:${hit.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function toHit(row: IndexedLine, score: number): ForumHit {
  return {
    ruleId: row.ruleId,
    ruleTitle: row.ruleTitle,
    point: row.point,
    section: row.section,
    lineIndex: row.lineIndex,
    text: row.text,
    penalty: row.penalty,
    score,
  };
}

export function searchForum(query: string, limit = 24): ForumHit[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const qTokens = expandQuery(q);
  return uniqueHits(
    INDEX.map((row) => toHit(row, scoreLine(row, q, qTokens, false)))
      .filter((hit) => hit.score >= 14)
      .sort((a, b) => b.score - a.score),
  ).slice(0, limit);
}

export function askForum(question: string, limit = 5): ForumHit[] {
  const q = question.trim();
  if (q.length < 2) return [];
  const qTokens = expandQuery(q);
  const ranked = INDEX.map((row) => toHit(row, scoreLine(row, q, qTokens, true)))
    .filter((hit) => hit.score >= 18)
    .sort((a, b) => b.score - a.score);
  const numbered = ranked.filter((hit) => Boolean(hit.point));
  const rest = ranked.filter((hit) => !hit.point);
  return uniqueHits([...numbered, ...rest]).slice(0, limit);
}
