import { loadState, saveState, type Macro, type MacroStep } from "./storage";
import { pressBackspace, pressKeyForeground, sendTextForeground, setMacroInjecting } from "./windows";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runStep(step: MacroStep, macros: Macro[]): Promise<void> {
  if (step.type === "random") {
    const kids = step.children?.filter(Boolean) ?? [];
    if (!kids.length) return;
    await runStep(kids[Math.floor(Math.random() * kids.length)], macros);
    return;
  }
  if (step.type === "if" || step.type === "if-else") {
    await runSteps(step.children ?? [], macros);
    return;
  }
  if (step.type === "wait") {
    await sleep(Math.max(0, step.waitMs ?? 500));
    return;
  }
  if (step.type === "counter") {
    const id = step.counterId || "ticket";
    const counters = loadState().counters.map((c) => {
      if (c.id !== id) return c;
      const value = Math.max(0, c.value + 1);
      return {
        ...c,
        value,
        history: [...(c.history ?? []), { timestamp: Date.now(), delta: 1 }].slice(-500),
      };
    });
    saveState({ counters });
    return;
  }
  if (step.type === "call-function") {
    const target = macros.find((m) => m.name === step.text || m.id === step.text);
    if (target && target.enabled) await runMacroById(target.id, 0);
    return;
  }
  if (step.type === "key-press") {
    pressKeyForeground(step.key || step.text || "Enter");
    await sleep(12);
    return;
  }
  if (step.text) {
    await sendTextForeground(step.text, {
      pressEnter: Boolean(step.pressEnter),
      enterEachLine: Boolean(step.enterEachLine),
      pressT: Boolean(step.pressT),
    });
    await sleep(12);
  }
}

async function runSteps(steps: MacroStep[], macros: Macro[]) {
  for (const step of steps.filter(Boolean)) {
    await runStep(step, macros);
  }
}

export function triggersFromMacros(macros: Macro[]): { id: string; sequence: string }[] {
  return macros
    .filter((m) => m.enabled)
    .flatMap((m) => {
      const seqs = m.triggers?.length
        ? m.triggers.map((t) => `${t.prefix ?? ""}${t.command ?? ""}`)
        : [m.trigger];
      return seqs
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .map((sequence) => ({
          id: m.id,
          sequence: sequence.endsWith(" ") ? sequence : `${sequence} `,
        }));
    });
}

export async function runMacroById(macroId: string, eraseCount: number): Promise<void> {
  const macros = loadState().macros;
  const macro = macros.find((m) => m.id === macroId);
  if (!macro || !macro.enabled) return;
  setMacroInjecting(true);
  try {
    if (eraseCount > 0) {
      await sleep(8);
      await pressBackspace(eraseCount);
      await sleep(12);
    }
    await runSteps(macro.steps, macros);
  } finally {
    await sleep(20);
    setMacroInjecting(false);
  }
}
