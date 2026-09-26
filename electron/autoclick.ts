import type koffiDefault from "koffi";
import { virtualKeyFromName } from "./keys";
import { clickMouse, tapVirtualKey } from "./windows";

let GetAsyncKeyState: (key: number) => number;
let nativeReady = false;

function ensureNative() {
  if (nativeReady) return;
  const koffi = require("koffi") as typeof koffiDefault;
  const user32 = koffi.load("user32.dll");
  GetAsyncKeyState = user32.func("short __stdcall GetAsyncKeyState(int vKey)") as (key: number) => number;
  nativeReady = true;
}

export type ClickerPhase = "off" | "armed" | "clicking";

let armed = false;
let button = "mouse-left";
let intervalMs = 150;
let clicking = false;
let wasDown = false;
let suppressUntil = 0;
let ignoreEdgeUntil = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let clickTimer: ReturnType<typeof setInterval> | null = null;
let panelFocused: () => boolean = () => false;
let onPhase: (phase: ClickerPhase) => void = () => {};

function phase(): ClickerPhase {
  if (!armed) return "off";
  return clicking ? "clicking" : "armed";
}

function emit() {
  onPhase(phase());
}

function pressBound() {
  if (button === "mouse-right") clickMouse("right");
  else if (button === "mouse-middle") clickMouse("middle");
  else if (button === "mouse-left") clickMouse("left");
  else {
    const vk = virtualKeyFromName(button);
    if (vk) tapVirtualKey(vk);
  }
}

function stopClicking() {
  clicking = false;
  if (clickTimer) clearInterval(clickTimer);
  clickTimer = null;
  ignoreEdgeUntil = Date.now() + 220;
}

function startClicking() {
  if (clicking) return;
  clicking = true;
  ignoreEdgeUntil = Date.now() + 220;
  const tick = () => {
    suppressUntil = Date.now() + Math.min(90, Math.max(30, intervalMs - 4));
    pressBound();
  };
  tick();
  clickTimer = setInterval(tick, Math.max(40, intervalMs));
}

function poll() {
  if (process.platform !== "win32") return;
  ensureNative();
  const vk = virtualKeyFromName(button);
  if (!vk) return;
  const down = (GetAsyncKeyState(vk) & 0x8000) !== 0;
  if (Date.now() < suppressUntil || Date.now() < ignoreEdgeUntil || panelFocused()) {
    wasDown = down;
    return;
  }
  if (armed && down && !wasDown) {
    if (clicking) stopClicking();
    else startClicking();
    emit();
  }
  wasDown = down;
}

export function startAutoclick(opts: { panelFocused: () => boolean; onPhase: (phase: ClickerPhase) => void }) {
  panelFocused = opts.panelFocused;
  onPhase = opts.onPhase;
  if (pollTimer) return;
  pollTimer = setInterval(poll, 12);
}

export function configureAutoclick(next: { armed: boolean; button?: string; intervalMs?: number }) {
  const wasArmed = armed;
  armed = Boolean(next.armed);
  if (next.button) button = next.button.trim() || button;
  if (next.intervalMs) {
    intervalMs = Math.max(40, Math.min(5000, Math.floor(Number(next.intervalMs) || intervalMs)));
  }
  if (!armed) stopClicking();
  else if (clicking && clickTimer) {
    clearInterval(clickTimer);
    clickTimer = setInterval(() => {
      suppressUntil = Date.now() + Math.min(90, Math.max(30, intervalMs - 4));
      pressBound();
    }, Math.max(40, intervalMs));
  }
  if (!wasArmed) wasDown = false;
  emit();
  return { ok: true, running: clicking, armed, intervalMs, platform: process.platform, phase: phase() };
}

export function stopAutoclick() {
  stopClicking();
  armed = false;
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  emit();
}
