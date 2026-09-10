import { migrateMacro, macroUid, parseTrigger } from "@/data/defaultMacros";
import type { Macro, MacroFolder } from "@/types";

export const MACRO_PACK_KIND = "aries-macros";

export interface MacroPack {
  kind: typeof MACRO_PACK_KIND;
  version: 1;
  macros: Macro[];
  folders?: MacroFolder[];
}

function textStep(text: string): Macro["steps"][number] {
  return { id: macroUid("step"), type: "insert-text", text, pressEnter: false };
}

function fromLine(trigger: string, body: string): Macro {
  const t = parseTrigger(trigger);
  const phrases = body.split("|").map((p) => p.trim()).filter(Boolean);
  const random = phrases.length > 1;
  return migrateMacro({
    id: macroUid("macro"),
    name: trigger,
    folderId: null,
    trigger,
    triggers: [t],
    random,
    enabled: true,
    steps: random
      ? [{ id: macroUid("step"), type: "random", text: "", pressEnter: false, children: phrases.map(textStep) }]
      : [textStep(phrases[0] ?? "")],
  });
}

export function parseMacroFile(raw: string): { macros: Macro[]; folders: MacroFolder[] } {
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return { macros: [], folders: [] };

  if (text.startsWith("{")) {
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

  const macros: Macro[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const trigger = trimmed.slice(0, eq).trim();
    const body = trimmed.slice(eq + 1).trim();
    if (!trigger || !body) continue;
    macros.push(fromLine(trigger, body));
  }
  return { macros, folders: [] };
}

export function exportMacroPack(macros: Macro[], folders: MacroFolder[]): string {
  const pack: MacroPack = { kind: MACRO_PACK_KIND, version: 1, macros, folders };
  return JSON.stringify(pack, null, 2);
}

export function exportMacroTxt(macros: Macro[]): string {
  const lines = [
    "# Pakiet makr ARIES",
    "# Wzor:  .komenda = tekst",
    "# Losowe odpowiedzi rozdziel | ",
    "# Przykład:  .w = Witam | Hejka | Cześć",
    "",
  ];
  for (const m of macros) {
    const trigger = m.trigger || m.name;
    const random = m.steps.find((s) => s.type === "random");
    const phrases = random?.children?.map((c) => c.text).filter(Boolean);
    const text = phrases?.length
      ? phrases.join(" | ")
      : m.steps.map((s) => s.text).filter(Boolean).join(" ");
    if (!trigger || !text) continue;
    lines.push(`${trigger} = ${text}`);
  }
  return lines.join("\n") + "\n";
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
