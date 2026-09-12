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
const ACRONYM_DEF_RE = /^(RDM|VDM|NRP|NLR|PG|CK|SK|MG|GBS)\b/i;
const NOTE_RE = /^(wyjaśnienie|uwaga|wyjątek|przykład)\b/i;
const HEADING_RE =
  /^(zasady\b|postanowienia\b|obowiązki lidera\b|warunki dotyczące\b|organizacje kryminalne\b|rodziny i klany\b|dyplomacja\b|dyplomacje\b|działalność\b|liderom zabrania\b|awanse\s*\/\s*zwolnienia\b|wspólne zasady\b|zadania i obowiązki\b)/i;

const STOP = new Set(
  "i w na do z ze a o u sie nie czy jak za od po lub oraz to jest byc tym tej tego ten ta te przy bez nad pod we ale czyli jezeli jesli gdy gdyz przez dla juz tylko tez moze moga ktos kogo czego czym jaki jaka jakie dac daje pytam pytanie".split(
    " ",
  ),
);

const WEAK = new Set(
  "jedna jeden jednym jednej jedno osobe osoba osoby osob osobami uczestnik uczestnicy liczba podczas musi byc obecna przynajmniej tego tej",
);

const ACRONYMS = new Set(["rdm", "vdm", "nlr", "nrp", "pg", "ck", "sk", "gbs"]);

const DOC_HINTS: { keys: string[]; ruleId: string }[] = [
  { keys: ["bank", "biznes", "napad", "zakladnik"], ruleId: "napad" },
  { keys: ["rdm", "vdm", "nlr", "nrp", "metagaming"], ruleId: "ogolne" },
  { keys: ["nalot"], ruleId: "nalot" },
  { keys: ["airdrop", "zrzut", "magazyn", "dealer"], ruleId: "airdrop" },
  { keys: ["capture", "turf"], ruleId: "captures" },
  { keys: ["zancudo", "cayo", "fort"], ruleId: "fort" },
  { keys: ["lider", "kadencja"], ruleId: "lider" },
  { keys: ["kraft", "dostaw", "dostawy"], ruleId: "dostawy" },
];

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/ł/g, "l");
}

function stem(token: string) {
  let t = token;
  t = t.replace(/osci$/, "osc").replace(/osc$/, "osc");
  t = t.replace(/(ami|ach|owi|owie|ego|ej|ych|ymi)$/, "");
  t = t.replace(/(ow|om|em|ie|ia|ie|a|e|y|i|e)$/, "");
  if (t.startsWith("osob")) return "osob";
  if (t.startsWith("jedn")) return "jedn";
  if (t.startsWith("bank")) return "bank";
  if (t.startsWith("napad")) return "napad";
  return t.length >= 3 ? t : token;
}

function tokens(value: string) {
  return fold(value)
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t))
    .map(stem)
    .filter((t) => t.length >= 2);
}

function splitPenalty(line: string) {
  const pipe = line.search(/\s*\|\s*/);
  if (pipe < 0) return { text: line.trim(), penalty: null as string | null };
  return {
    text: line.slice(0, pipe).trim(),
    penalty: line.slice(pipe).replace(/^\s*\|\s*/, "").trim(),
  };
}

type Chunk = {
  ruleId: string;
  ruleTitle: string;
  point: string | null;
  section: string | null;
  lineIndex: number;
  lead: string;
  penalty: string | null;
  hay: string;
  body: string;
  isDef: boolean;
  isNumbered: boolean;
};

function buildChunks(): Chunk[] {
  const chunks: Chunk[] = [];
  for (const rule of FORUM_RULES) {
    const lines = rule.body.replace(/\u200B/g, "").replace(/\r\n/g, "\n").split("\n");
    let section = rule.title;
    let current: Chunk | null = null;
    const push = () => {
      if (current) chunks.push(current);
      current = null;
    };
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) {
        if (current && current.hay.length > 80) push();
        continue;
      }
      const heading = HEADING_RE.test(trimmed.replace(/:$/, "")) && trimmed.length <= 90 && !trimmed.includes("|");
      if (heading) {
        section = trimmed.replace(/:$/, "");
        push();
        continue;
      }
      const numbered = trimmed.match(POINT_RE);
      const def = trimmed.match(ACRONYM_DEF_RE);
      const note = NOTE_RE.test(trimmed);
      if (numbered || def) {
        push();
        const { text, penalty } = splitPenalty(trimmed);
        const point = numbered ? numbered[1] : def ? def[1].toUpperCase() : null;
        current = {
          ruleId: rule.id,
          ruleTitle: rule.title,
          point,
          section,
          lineIndex: i,
          lead: text,
          penalty,
          body: fold(trimmed),
          hay: fold(`${rule.title} ${section} ${point ?? ""} ${trimmed}`),
          isDef: Boolean(def),
          isNumbered: Boolean(numbered),
        };
        continue;
      }
      if (current && note) {
        current.body += ` ${fold(trimmed)}`;
        current.hay += ` ${fold(trimmed)}`;
        if (!current.penalty) current.penalty = splitPenalty(trimmed).penalty;
        continue;
      }
      push();
      const { text, penalty } = splitPenalty(trimmed);
      current = {
        ruleId: rule.id,
        ruleTitle: rule.title,
        point: null,
        section,
        lineIndex: i,
        lead: text,
        penalty,
        body: fold(trimmed),
        hay: fold(`${rule.title} ${section} ${trimmed}`),
        isDef: false,
        isNumbered: false,
      };
    }
    push();
  }
  return chunks;
}

const CHUNKS = buildChunks();

function wholeWord(hay: string, token: string) {
  return new RegExp(`(?:^|[^a-z0-9])${token}(?:$|[^a-z0-9])`).test(hay);
}

function scoreChunk(chunk: Chunk, query: string) {
  const qFold = fold(query);
  const qTokens = [...new Set(tokens(query))];
  if (!qTokens.length) return 0;

  const acronyms = qTokens.filter((t) => ACRONYMS.has(t));
  if (acronyms.length) {
    const ok = acronyms.every((a) => wholeWord(chunk.hay, a) || chunk.hay.includes(a));
    if (!ok) return 0;
  }

  const keyTokens = qTokens.filter((t) => !WEAK.has(t) && t.length >= 4);
  if (keyTokens.length) {
    const missing = keyTokens.filter((t) => !chunk.body.includes(t) && !chunk.hay.includes(t));
    if (keyTokens.some((t) => ["bank", "rdm", "vdm", "nlr", "nrp", "nalot", "airdrop"].includes(t) && !chunk.body.includes(t))) {
      return 0;
    }
    if (missing.length === keyTokens.length) return 0;
  }

  let matched = 0;
  let score = 0;
  for (const t of qTokens) {
    const hit = chunk.hay.includes(t);
    if (hit) {
      matched += 1;
      score += WEAK.has(t) ? 6 : t.length >= 4 ? 22 : 12;
      if (wholeWord(chunk.hay, t)) score += 10;
    }
  }
  const coverage = matched / qTokens.length;
  if (coverage < (qTokens.length >= 2 ? 0.5 : 1)) return 0;
  score += Math.round(coverage * 40);

  if (chunk.hay.includes(qFold)) score += 90;
  if (acronyms.length && chunk.isDef) score += 120;
  if (chunk.isNumbered) score += 12;

  const countAsk = /\b(1|jedn[aąey]|solo|samemu|pojedyncz|w\s+jedn)/i.test(query);
  if (countAsk && chunk.body.includes("osob") && /\b(\d+|co najmniej|wymagan|od\s+\d+|do\s+\d+)\b/.test(chunk.body)) {
    score += 70;
    if (/uczestnik|wymagan|liczba/.test(chunk.body)) score += 80;
    if (/reagow/.test(chunk.body)) score -= 45;
  }

  for (const hint of DOC_HINTS) {
    if (hint.keys.some((k) => qFold.includes(k) || qTokens.includes(k))) {
      if (chunk.ruleId === hint.ruleId) score += 50;
      else score -= 25;
    }
  }

  return score;
}

function toHit(chunk: Chunk, score: number): ForumHit & { isDef: boolean } {
  return {
    ruleId: chunk.ruleId,
    ruleTitle: chunk.ruleTitle,
    point: chunk.point,
    section: chunk.section,
    lineIndex: chunk.lineIndex,
    text: chunk.lead,
    penalty: chunk.penalty,
    score,
    isDef: chunk.isDef,
  };
}

function rank(query: string, limit: number, minScore: number) {
  const q = query.trim();
  if (q.length < 2) return [];
  return CHUNKS.map((chunk) => toHit(chunk, scoreChunk(chunk, q)))
    .filter((hit) => hit.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function searchForum(query: string, limit = 12): ForumHit[] {
  return rank(query, limit, 28);
}

export function askForum(question: string, limit = 3): ForumHit[] {
  const hits = rank(question, 8, 40);
  if (!hits.length) return [];
  const qTokens = [...new Set(tokens(question))];
  const acronymOnly = qTokens.length > 0 && qTokens.every((t) => ACRONYMS.has(t) || WEAK.has(t));
  if (acronymOnly) {
    const defs = hits.filter((hit) => hit.isDef);
    if (defs.length) return defs.slice(0, Math.min(2, limit));
  }
  const best = hits[0].score;
  return hits.filter((hit) => hit.score >= best * 0.78).slice(0, limit);
}
