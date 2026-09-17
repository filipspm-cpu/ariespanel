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
    const chat =
      Boolean(step.pressT || step.enterEachLine) ||
      (step.type === "multiline-text" && step.pressT == null && step.enterEachLine == null);
    await withInjecting(async () => {
      await sendTextForeground(step.text, {
        pressEnter: Boolean(step.pressEnter) || chat,
        enterEachLine: chat,
        pressT: chat,
        skipFirstT: true,
        fastPaste: !chat,
      });
    });
    if (chat) ctx.inChat = false;
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

async function executeMacro(macroId: string, eraseCount: number) {
  const macros = loadState().macros;
  const macro = macros.find((m) => m.id === macroId);
  if (!macro || !macro.enabled) return;
  runningId = macroId;
  setMacroInjecting(true);
  try {
    if (eraseCount > 0) {
      await sleep(12);
      await pressBackspace(eraseCount);
      await sleep(40);
    }
    await runSteps(macro.steps, macros, { inChat: true });
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
    setMacroInjecting(false);
    draining = false;
    if (queue.length) void drainMacroQueue();
  }
}

export async function runMacroById(macroId: string, eraseCount: number): Promise<void> {
  if (runningId === macroId || queue.some((job) => job.id === macroId)) return;
  queue.push({ id: macroId, eraseCount });
  await drainMacroQueue();
}
