import { loadState, saveState, type Counter, type Macro, type MacroStep } from "./storage";
import { pressBackspace, pressKeyForeground, sendTextForeground, setMacroInjecting } from "./windows";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let refreshOverlay = () => {};
let notifyCounters = (_counters: Counter[]) => {};

export function setOverlayRefresh(fn: () => void) {
  refreshOverlay = fn;
}

export function setCountersListener(fn: (counters: Counter[]) => void) {
  notifyCounters = fn;
}

function bumpCounter(id: string) {
  const counters = loadState().counters.map((c) => {
    if (c.id !== id) return c;
    const value = Math.max(0, c.value + 1);
    return {
      ...c,
      value,
      history: [...(c.history ?? []), { timestamp: Date.now(), delta: 1 }].slice(-2000),
    };
  });
  saveState({ counters });
  notifyCounters(counters);
  refreshOverlay();
}

async function withInjecting(fn: () => Promise<void> | void) {
  setMacroInjecting(true);
  try {
    await fn();
  } finally {
    setMacroInjecting(false);
  }
}

async function runStep(step: MacroStep, macros: Macro[], ctx: { inChat: boolean }): Promise<void> {
  if (step.type === "random") {
    const kids = step.children?.filter(Boolean) ?? [];
    if (!kids.length) return;
    await runStep(kids[Math.floor(Math.random() * kids.length)], macros, ctx);
    return;
  }
  if (step.type === "if" || step.type === "if-else") {
    await runSteps(step.children ?? [], macros, ctx);
    return;
  }
  if (step.type === "wait") {
    await sleep(Math.max(0, step.waitMs ?? 500));
    return;
  }
  if (step.type === "counter") {
    bumpCounter(step.counterId || "ticket");
    return;
  }
  if (step.type === "call-function") {
    const target = macros.find((m) => m.name === step.text || m.id === step.text);
    if (target && target.enabled) await executeMacro(target.id, 0);
    return;
  }
  if (step.type === "key-press") {
    await withInjecting(async () => {
      pressKeyForeground(step.key || step.text || "Enter");
      await sleep(12);
    });
    return;
  }
  if (step.text) {
    const eachLine = Boolean(step.enterEachLine) || (step.type === "multiline-text" && Boolean(step.pressT));
    const openChat = Boolean(step.pressT);
    await withInjecting(async () => {
      await sendTextForeground(step.text, {
        pressEnter: Boolean(step.pressEnter) || eachLine,
        enterEachLine: eachLine,
        pressT: openChat,
        skipFirstT: true,
        fastPaste: !eachLine && !openChat,
      });
    });
    if (eachLine || openChat) ctx.inChat = false;
    await sleep(8);
  }
}

async function runSteps(steps: MacroStep[], macros: Macro[], ctx: { inChat: boolean }) {
  for (const step of steps.filter(Boolean)) {
    await runStep(step, macros, ctx);
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

let draining = false;
const queue: Array<{ id: string; eraseCount: number }> = [];

let runningId: string | null = null;

function stepWillOutput(step: MacroStep | undefined): boolean {
  if (!step) return false;
  if (step.type === "random") return (step.children ?? []).some(stepWillOutput);
  if (step.type === "if" || step.type === "if-else") {
    return [...(step.children ?? []), ...(step.elseChildren ?? [])].some(stepWillOutput);
  }
  if (step.type === "wait") return false;
  if (step.type === "counter") return Boolean(step.counterId);
  if (step.type === "call-function") return Boolean(step.text);
  if (step.type === "key-press") return Boolean(step.key || step.text);
  return Boolean(step.text);
}

async function executeMacro(macroId: string, eraseCount: number) {
  const macros = loadState().macros;
  const macro = macros.find((m) => m.id === macroId);
  if (!macro || !macro.enabled) return;
  const willOutput = (macro.steps ?? []).some(stepWillOutput);
  if (eraseCount > 0 && !willOutput) return;
  runningId = macroId;
  setMacroInjecting(true);
  try {
    if (eraseCount > 0) {
      await pressBackspace(eraseCount);
    }
    await runSteps(macro.steps, macros, { inChat: eraseCount > 0 });
    // Finish every triggered macro with the requested mark command.
    if (eraseCount > 0) {
      await sendTextForeground("tn mark", { pressEnter: true, fastPaste: true });
    }
  } finally {
    runningId = null;
    setMacroInjecting(false);
  }
}

async function drainMacroQueue() {
  if (draining) return;
  draining = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      if (!job) break;
      try {
        await executeMacro(job.id, job.eraseCount);
      } catch (err) {
        console.warn("Macro failed", err);
      }
    }
  } finally {
    draining = false;
    if (queue.length) void drainMacroQueue();
  }
}

export async function runMacroById(macroId: string, eraseCount: number): Promise<void> {
  queue.push({ id: macroId, eraseCount });
  void drainMacroQueue();
}
