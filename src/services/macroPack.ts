import { migrateMacro, macroUid, parseTrigger } from "@/data/defaultMacros";
import type { Macro, MacroFolder, MacroStep } from "@/types";

export const MACRO_PACK_KIND = "aries-macros";

export interface MacroPack {
  kind: typeof MACRO_PACK_KIND;
  version: 1;
  macros: Macro[];
  folders?: MacroFolder[];
}

function textStep(text: string, pressEnter = false): MacroStep {
  return { id: macroUid("step"), type: "insert-text", text, pressEnter };
}

function multilineStep(text: string): MacroStep {
  return {
    id: macroUid("step"),
    type: "multiline-text",
    text,
    pressEnter: true,
    enterEachLine: true,
    pressT: true,
  };
}

function randomStep(options: string[]): MacroStep {
  return {
    id: macroUid("step"),
    type: "random",
    text: "",
    pressEnter: false,
    children: options.map((p) => textStep(p)),
  };
}

function counterStep(counterId: string): MacroStep {
  return { id: macroUid("step"), type: "counter", text: "", pressEnter: false, counterId };
}

function waitStep(ms: number): MacroStep {
  return { id: macroUid("step"), type: "wait", text: "", pressEnter: false, waitMs: ms };
}

function keyStep(key: string): MacroStep {
  return { id: macroUid("step"), type: "key-press", text: key, pressEnter: false, key };
}

function fromPhrases(trigger: string, phrases: string[]): Macro {
  const t = parseTrigger(trigger);
  const random = phrases.length > 1;
  return migrateMacro({
    id: macroUid("macro"),
    name: trigger,
    folderId: null,
    trigger,
    triggers: [t],
    random,
    enabled: true,
    steps: random ? [randomStep(phrases)] : [textStep(phrases[0] ?? "")],
  });
}

function fromLine(trigger: string, body: string): Macro {
  const phrases = body
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  return fromPhrases(trigger, phrases.length ? phrases : [""]);
}

function fromSteps(trigger: string, steps: MacroStep[]): Macro {
  const t = parseTrigger(trigger);
  return migrateMacro({
    id: macroUid("macro"),
    name: trigger,
    folderId: null,
    trigger,
    triggers: [t],
    random: steps.some((s) => s.type === "random"),
    enabled: true,
    steps,
  });
}

function splitPhrases(body: string): string[] {
  return body
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
}

function parseTag(raw: string): { tag: string; arg: string } | null {
  const m = raw.trim().match(/^\[([^\]]+)\]$/);
  if (!m) return null;
  const inner = m[1].trim();
  const colon = inner.indexOf(":");
  if (colon <= 0) return { tag: inner.toLowerCase(), arg: "" };
  return { tag: inner.slice(0, colon).trim().toLowerCase(), arg: inner.slice(colon + 1).trim() };
}

function tagKind(tag: string): "random" | "text" | "counter" | "wait" | "key" | "macro" | null {
  if (tag === "losowe" || tag === "random" || tag === "losowo") return "random";
  if (tag === "tekst" || tag === "text" || tag === "dlugi" || tag === "multiline") return "text";
  if (tag === "licznik" || tag === "counter") return "counter";
  if (tag === "czekaj" || tag === "wait") return "wait";
  if (tag === "klawisz" || tag === "key") return "key";
  if (tag === "makro" || tag === "macro") return "macro";
  return null;
}

function isBlankOrComment(line: string) {
  const t = line.trim();
  return !t || t.startsWith("#");
}

function isTriggerLine(line: string) {
  if (/^\s/.test(line)) return false;
  const t = line.trim();
  if (!t || t.startsWith("#") || t.startsWith("[")) return false;
  return /^\S+\s*(=|:)/.test(t);
}

function collectQuoted(lines: string[], start: number, firstRest: string): { text: string; next: number } {
  const chunks: string[] = [];
  let rest = firstRest.replace(/^"""/, "");
  if (rest.includes('"""')) {
    return { text: rest.slice(0, rest.indexOf('"""')).replace(/\n$/, ""), next: start };
  }
  if (rest.length) chunks.push(rest);
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    const end = line.indexOf('"""');
    if (end >= 0) {
      chunks.push(line.slice(0, end));
      return { text: chunks.join("\n").replace(/^\n/, "").replace(/\n$/, ""), next: i + 1 };
    }
    chunks.push(line);
    i += 1;
  }
  return { text: chunks.join("\n"), next: i };
}

function flushSection(kind: ReturnType<typeof tagKind>, arg: string, bodyLines: string[]): MacroStep | null {
  if (!kind) return null;
  const body = bodyLines.join("\n").trim();
  if (kind === "random") {
    const options = bodyLines
      .flatMap((line) => (line.includes("|") ? splitPhrases(line) : [line.trim()]))
      .filter(Boolean);
    if (!options.length && arg) options.push(...splitPhrases(arg));
    if (!options.length) return null;
    return randomStep(options);
  }
  if (kind === "text") {
    const text = (body || arg).replace(/\n+$/, "");
    if (!text) return null;
    return text.includes("\n") ? multilineStep(text) : textStep(text);
  }
  if (kind === "counter") return counterStep(arg || body || "ticket");
  if (kind === "wait") return waitStep(Number(arg || body) || 500);
  if (kind === "key") return keyStep(arg || body || "Enter");
  if (kind === "macro") {
    return { id: macroUid("step"), type: "call-function", text: arg || body, pressEnter: false };
  }
  return null;
}

function parseBlockBody(lines: string[], start: number): { steps: MacroStep[]; next: number } {
  const steps: MacroStep[] = [];
  let i = start;
  let currentKind: ReturnType<typeof tagKind> = null;
  let currentArg = "";
  let currentBody: string[] = [];

  const dump = () => {
    const step = flushSection(currentKind, currentArg, currentBody);
    if (step) steps.push(step);
    currentKind = null;
    currentArg = "";
    currentBody = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    if (isTriggerLine(line)) break;
    if (!line.trim()) {
      if (currentKind === "text" && currentBody.length) currentBody.push("");
      i += 1;
      continue;
    }
    if (line.trim().startsWith("#")) {
      i += 1;
      continue;
    }
    const trimmed = line.trim();
    const tag = parseTag(trimmed);
    if (tag) {
      dump();
      currentKind = tagKind(tag.tag);
      currentArg = tag.arg;
      currentBody = [];
      i += 1;
      continue;
    }
    if (!currentKind) {
      currentKind = trimmed.includes("|") ? "random" : "text";
    }
    currentBody.push(line.replace(/^\s+/, ""));
    i += 1;
  }
  dump();
  return { steps, next: i };
}

function parseScript(raw: string): Macro[] {
  const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
  const macros: Macro[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlankOrComment(line) || !isTriggerLine(line)) {
      i += 1;
      continue;
    }
    const trimmed = line.trim();
    const eq = trimmed.indexOf("=");
    const colon = trimmed.indexOf(":");
    const useEq = eq > 0 && (colon < 0 || eq < colon);

    if (useEq) {
      const trigger = trimmed.slice(0, eq).trim();
      const rest = trimmed.slice(eq + 1).trim();
      if (rest.startsWith('"""')) {
        const quoted = collectQuoted(lines, i + 1, rest);
        const text = quoted.text.trim();
        macros.push(
          fromSteps(trigger, [text.includes("\n") ? multilineStep(text) : textStep(text)]),
        );
        i = quoted.next;
        continue;
      }
      if (trigger && rest) macros.push(fromLine(trigger, rest));
      i += 1;
      continue;
    }

    const colonAt = trimmed.indexOf(":");
    const trigger = trimmed.slice(0, colonAt).trim();
    const after = trimmed.slice(colonAt + 1).trim();
    if (!trigger) {
      i += 1;
      continue;
    }
    if (after.startsWith('"""')) {
      const quoted = collectQuoted(lines, i + 1, after);
      const text = quoted.text.trim();
      macros.push(fromSteps(trigger, [text.includes("\n") ? multilineStep(text) : textStep(text)]));
      i = quoted.next;
      continue;
    }
    if (after && !after.startsWith("[")) {
      macros.push(fromLine(trigger, after));
      i += 1;
      continue;
    }
    const extra = after ? [`  ${after}`] : [];
    const parsed = parseBlockBody([...extra, ...lines.slice(i + 1)], 0);
    macros.push(fromSteps(trigger, parsed.steps.length ? parsed.steps : [textStep("")]));
    const consumed = Math.max(0, parsed.next - extra.length);
    i = i + 1 + consumed;
  }
  return macros;
}

export function parseMacroFile(raw: string): { macros: Macro[]; folders: MacroFolder[] } {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { macros: [], folders: [] };

  if (text.startsWith("{") || text.startsWith("[")) {
    const parsed = JSON.parse(text) as Partial<MacroPack> & { macros?: unknown };
    const list = Array.isArray(parsed) ? parsed : parsed.macros;
    if (!Array.isArray(list)) throw new Error("Plik JSON nie zawiera listy makr.");
    const folders = Array.isArray((parsed as MacroPack).folders) ? (parsed as MacroPack).folders! : [];
    const macros = list.map((m) => {
      const item = m as Macro;
      return migrateMacro({
        ...item,
        id: macroUid("macro"),
        name: item.name || item.trigger || ".",
      });
    });
    return { macros, folders: folders.map((f) => ({ ...f, id: macroUid("folder") })) };
  }

  return { macros: parseScript(raw), folders: [] };
}

export function exportMacroPack(macros: Macro[], folders: MacroFolder[]): string {
  const pack: MacroPack = { kind: MACRO_PACK_KIND, version: 1, macros, folders };
  return JSON.stringify(pack, null, 2);
}

function indentBlock(text: string, pad = "    ") {
  return text
    .split(/\r?\n/)
    .map((line) => `${pad}${line}`)
    .join("\n");
}

function exportSteps(steps: MacroStep[]): string[] {
  const out: string[] = [];
  for (const step of steps) {
    if (step.type === "random") {
      const options = (step.children ?? []).map((c) => c.text).filter(Boolean);
      out.push("  [losowe]");
      for (const option of options) out.push(`    ${option}`);
      continue;
    }
    if (step.type === "counter") {
      out.push(`  [licznik:${step.counterId || "ticket"}]`);
      continue;
    }
    if (step.type === "wait") {
      out.push(`  [czekaj:${step.waitMs ?? 500}]`);
      continue;
    }
    if (step.type === "key-press") {
      out.push(`  [klawisz:${step.key || step.text || "Enter"}]`);
      continue;
    }
    if (step.type === "call-function") {
      out.push(`  [makro:${step.text}]`);
      continue;
    }
    if (step.type === "multiline-text" || (step.text || "").includes("\n")) {
      out.push("  [tekst]");
      out.push(indentBlock(step.text || ""));
      continue;
    }
    if (step.text) {
      out.push("  [tekst]");
      out.push(`    ${step.text}`);
    }
  }
  return out;
}

export function exportMacroTxt(macros: Macro[]): string {
  const lines = [
    "# Pakiet makr ARIES",
    "#",
    "# Krótki tekst (stary zapis nadal działa):",
    "#   .p = Poczekaj chwilę.",
    "#",
    "# Losowe odpowiedzi — każda opcja w osobnej linii:",
    "#   .w:",
    "#     [losowe]",
    "#       Witam",
    "#       Hejka",
    "#       Cześć",
    "#",
    "# Długi tekst (wiele linii, Enter po każdej):",
    "#   .ogloszenie:",
    "#     [tekst]",
    "#       Szanowni Państwo,",
    "#       Proszę o spokój na kanale.",
    "#",
    "# Licznik, czekanie, klawisz można łączyć w jednym makrze:",
    "#   .ticket:",
    "#     [licznik:ticket]",
    "#     [tekst]",
    "#       Przyjąłem zgłoszenie.",
    "#",
    "# Alternatywnie długi tekst w cudzysłowach:",
    '#   .ogloszenie = """',
    "#   linia 1",
    "#   linia 2",
    '#   """',
    "",
  ];
  for (const m of macros) {
    const trigger = m.trigger || m.name;
    if (!trigger) continue;
    const block = exportSteps(m.steps);
    if (!block.length) continue;
    lines.push(`${trigger}:`);
    lines.push(...block);
    lines.push("");
  }
  return lines.join("\n");
}

export function mergeImportedMacros(
  current: Macro[],
  incoming: Macro[],
): { next: Macro[]; added: number; skipped: number } {
  const used = new Set(current.map((m) => (m.trigger || m.name).toLowerCase()));
  const extra: Macro[] = [];
  let skipped = 0;
  for (const m of incoming) {
    const key = (m.trigger || m.name).toLowerCase();
    if (used.has(key)) {
      skipped += 1;
      continue;
    }
    used.add(key);
    extra.push(m);
  }
  return { next: [...current, ...extra], added: extra.length, skipped };
}
