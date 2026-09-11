import type { Macro, MacroStep, MacroTrigger } from "@/types";

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseTrigger(trigger: string): MacroTrigger {
  if (trigger.startsWith("%")) return { prefix: "%", command: trigger.slice(1) };
  if (trigger.startsWith(".")) return { prefix: ".", command: trigger.slice(1) };
  return { prefix: "", command: trigger };
}

function textStep(text: string, pressEnter = false): MacroStep {
  return { id: uid("step"), type: "insert-text", text, pressEnter };
}

function randomMacro(name: string, phrases: string[]): Macro {
  const t = parseTrigger(name);
  return {
    id: uid("macro"),
    name,
    folderId: null,
    trigger: name,
    triggers: [t],
    random: true,
    enabled: true,
    steps: [
      {
        id: uid("step"),
        type: "random",
        text: "",
        pressEnter: false,
        children: phrases.map((p) => textStep(p)),
      },
    ],
  };
}

function simpleMacro(name: string, text: string): Macro {
  const t = parseTrigger(name);
  return {
    id: uid("macro"),
    name,
    folderId: null,
    trigger: name,
    triggers: [t],
    random: false,
    enabled: true,
    steps: [textStep(text)],
  };
}

export function defaultMacros(): Macro[] {
  return [
    randomMacro(".w", ["Witam", "Hejka", "Cześć", "Dzień dobry"]),
    simpleMacro(".p", "Poczekaj chwilę."),
    simpleMacro(".s", "Spokojnie."),
    simpleMacro(".m", "Moment."),
    simpleMacro(".v", "W porządku."),
    simpleMacro(".t", "Tak jest."),
    simpleMacro(".e", "Rozumiem."),
    simpleMacro(".f", "Jasne."),
    simpleMacro(".b", "Dobrze."),
    simpleMacro(".z", "Zaraz wracam."),
    simpleMacro(".l", "Lecę."),
    simpleMacro(".c", "Czekam."),
    simpleMacro(".blad", "Przepraszam, pomyłka."),
  ];
}

export function migrateMacro(raw: Partial<Macro> & Pick<Macro, "id" | "name">): Macro {
  const trigger = raw.trigger || raw.name || "";
  const triggers = raw.triggers && raw.triggers.length > 0 ? raw.triggers : [parseTrigger(trigger)];
  const steps = (raw.steps ?? []).map((s) => ({
    ...s,
    type: s.type || "insert-text",
    children: s.children?.map((c) => ({ ...c, type: c.type || "insert-text" })),
    elseChildren: s.elseChildren?.map((c) => ({ ...c, type: c.type || "insert-text" })),
  }));
  const wrapped =
    raw.random && !steps.some((s) => s.type === "random")
      ? [
          {
            id: uid("step"),
            type: "random" as const,
            text: "",
            pressEnter: false,
            children: steps,
          },
        ]
      : steps;
  return {
    id: raw.id,
    name: raw.name,
    folderId: raw.folderId ?? null,
    trigger: `${triggers[0]?.prefix ?? ""}${triggers[0]?.command ?? ""}` || trigger,
    triggers,
    random: Boolean(raw.random) || wrapped.some((s) => s.type === "random"),
    enabled: raw.enabled !== false,
    steps: wrapped,
  };
}

export { parseTrigger, uid as macroUid };
