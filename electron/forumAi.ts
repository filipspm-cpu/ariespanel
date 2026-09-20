import { panelLog } from "./panelLog";

const GROQ_KEY = process.env.GROQ_API_KEY || "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";
const OPENAI_KEY =
  process.env.OPENAI_API_KEY ||
  "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";

export type ForumPassage = {
  ruleId?: string;
  ruleTitle?: string;
  point?: string | null;
  section?: string | null;
  excerpt?: string;
  penalty?: string | null;
};

export type ForumAskResult = {
  ok: boolean;
  answer: string;
  source?: string;
  error?: string;
};

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const SYSTEM = `Jesteś asystentem regulaminu Majestic GTA RP w panelu ARIES.
Odpowiadasz po polsku, konkretnie i krótko.
Korzystasz WYŁĄCZNIE z podanych fragmentów regulaminu. Nie zmyślaj kar ani punktów.
Jeśli jest numer punktu, podaj go. Jeśli jest kara, podaj ją.
Jeśli fragmenty nie odpowiadają na pytanie, napisz że w regulaminie tego nie ma.`;

const PROVIDERS: {
  name: string;
  url: string;
  key: string;
  models: string[];
}[] = [
  {
    name: "Groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    key: GROQ_KEY,
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"],
  },
  {
    name: "OpenAI",
    url: "https://api.openai.com/v1/chat/completions",
    key: OPENAI_KEY,
    models: ["gpt-4o-mini", "gpt-4.1-mini"],
  },
];

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildUserPrompt(question: string, passages: ForumPassage[]) {
  const blocks = passages
    .map((row, i) => {
      const head = [row.ruleTitle, row.section, row.point ? `pkt ${row.point}` : ""]
        .filter(Boolean)
        .join(" · ");
      const body = clip(String(row.excerpt || ""), 1400);
      const penalty = row.penalty ? `\nKara: ${clip(String(row.penalty), 200)}` : "";
      return `[${i + 1}] ${head}\n${body}${penalty}`;
    })
    .filter((block) => block.trim().length > 8)
    .slice(0, 8);
  const context = blocks.length ? blocks.join("\n\n") : "(brak pasujących fragmentów)";
  return `Pytanie administratora:\n${clip(question, 500)}\n\nFragmenty regulaminu:\n${context}`;
}

function readAnswer(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choice = (payload as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message;
  const content = choice?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" && "text" in part ? String((part as { text?: unknown }).text || "") : ""))
      .join("")
      .trim();
  }
  return "";
}

function sanitizeError(raw: unknown) {
  const text = raw instanceof Error ? raw.message : String(raw || "ai");
  return text.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").replace(/gsk_[A-Za-z0-9]+/g, "gsk_***").slice(0, 220);
}

async function chatOnce(url: string, key: string, model: string, messages: ChatMessage[]): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 22000);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
    ...(url.includes("groq.com") ? { max_completion_tokens: 700 } : { max_tokens: 700 }),
      }),
    });
    const data = (await res.json()) as { error?: { message?: string } };
    if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
    const answer = readAnswer(data);
    if (!answer) throw new Error("empty");
    return answer;
  } finally {
    clearTimeout(timer);
  }
}

export async function askForumAi(input: { question?: string; passages?: ForumPassage[] }): Promise<ForumAskResult> {
  const question = String(input?.question || "").trim();
  if (question.length < 2) return { ok: false, answer: "", error: "invalid" };
  const passages = Array.isArray(input.passages) ? input.passages.slice(0, 8) : [];
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: buildUserPrompt(question, passages) },
  ];

  let last = "ai";
  for (const provider of PROVIDERS) {
    if (!provider.key) continue;
    for (const model of provider.models) {
      try {
        const answer = await chatOnce(provider.url, provider.key, model, messages);
        return { ok: true, answer, source: `${provider.name} · ${model}` };
      } catch (err) {
        last = sanitizeError(err);
      }
    }
  }

  panelLog({
    level: "warn",
    source: "forum",
    message: "Asystent forum nie odpowiedział",
    detail: last,
  });
  return { ok: false, answer: "", error: last };
}
