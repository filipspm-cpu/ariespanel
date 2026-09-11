import { useAppStore } from "@/store/useAppStore";
import type { Macro, MacroStep } from "@/types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
    useAppStore.getState().bumpCounter(step.counterId || "ticket", 1);
    return;
  }
  if (step.type === "call-function") {
    const target = macros.find((m) => m.name === step.text || m.id === step.text);
    if (target && target.enabled) await runMacro(target, macros);
    return;
  }
  if (step.type === "key-press") {
    await window.synvity?.macroPress?.(step.key || step.text || "Enter");
    return;
  }
  if (step.text) {
    await window.synvity?.macroSend(step.text, Boolean(step.pressEnter), {
      pressT: Boolean(step.pressT),
      enterEachLine: Boolean(step.enterEachLine),
    });
    await sleep(12);
  }
}

export async function runSteps(steps: MacroStep[], macros: Macro[]) {
  for (const step of steps.filter(Boolean)) {
    await runStep(step, macros);
  }
}

export async function runMacro(macro: Macro, all = useAppStore.getState().macros) {
  await runSteps(macro.steps, all);
}
