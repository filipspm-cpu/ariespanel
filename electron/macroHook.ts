import { isMacroInjecting } from "./windows";

import type koffiDefault from "koffi";

let GetAsyncKeyState: (key: number) => number;
let nativeReady = false;

function ensureNative() {
  if (nativeReady) return;
  const koffi = require("koffi") as typeof koffiDefault;
  const user32 = koffi.load("user32.dll");
  GetAsyncKeyState = user32.func("short __stdcall GetAsyncKeyState(int vKey)") as (key: number) => number;
  nativeReady = true;
}

type Trigger = { id: string; sequence: string };

let timer: ReturnType<typeof setInterval> | null = null;
let buffer = "";
let lastInputAt = 0;
let lastFireAt = 0;
let triggers: Trigger[] = [];
let onFire: ((id: string, eraseCount: number) => void) | null = null;
const keyDown = new Map<number, boolean>();

const VK_SHIFT = 0x10;
const VK_LSHIFT = 0xa0;
const VK_RSHIFT = 0xa1;
const VK_5 = 0x35;

const watchedKeys: Array<[number, string]> = [
  [0x08, "\b"], [0x20, " "], [0xbe, "."], [0x6e, "."], [0xbd, "-"], [0xbc, ","],
  [0xbf, "/"],
  ...Array.from({ length: 10 }, (_, i) => [0x30 + i, String(i)] as [number, string]),
  ...Array.from({ length: 26 }, (_, i) => [0x41 + i, String.fromCharCode(0x61 + i)] as [number, string]),
];

function shiftDown() {
  return (
    (GetAsyncKeyState(VK_SHIFT) & 0x8000) !== 0 ||
    (GetAsyncKeyState(VK_LSHIFT) & 0x8000) !== 0 ||
    (GetAsyncKeyState(VK_RSHIFT) & 0x8000) !== 0
  );
}

function mappedCharacter(virtualKey: number, fallback: string) {
  if (virtualKey === VK_5 && shiftDown()) return "%";
  return fallback;
}

export function updateMacroTriggers(next: Trigger[]) {
  triggers = next
    .map((trigger) => ({ id: trigger.id, sequence: trigger.sequence.trim().toLowerCase() }))
    .filter((trigger) => trigger.sequence.length > 0)
    .sort((a, b) => b.sequence.length - a.sequence.length);
}

function recordCharacter(character: string) {
  const now = Date.now();
  if (now - lastInputAt > 2500) buffer = "";
  lastInputAt = now;
  if (character === "\b") {
    buffer = buffer.slice(0, -1);
    return;
  }
  buffer = (buffer + character).slice(-48);
  const hit = triggers.find((trigger) => buffer.endsWith(`${trigger.sequence} `));
  if (!hit) return;
  if (now - lastFireAt < 350) {
    buffer = "";
    return;
  }
  lastFireAt = now;
  buffer = "";
  onFire?.(hit.id, hit.sequence.length + 1);
}

function pollKeyboard() {
  ensureNative();
  for (const [virtualKey, character] of watchedKeys) {
    const down = (GetAsyncKeyState(virtualKey) & 0x8000) !== 0;
    const wasDown = keyDown.get(virtualKey) ?? false;
    keyDown.set(virtualKey, down);
    if (isMacroInjecting() || !down || wasDown) continue;
    recordCharacter(mappedCharacter(virtualKey, character));
  }
}

export function startMacroHook(handler: (id: string, eraseCount: number) => void) {
  ensureNative();
  onFire = handler;
  if (timer) return;
  keyDown.clear();
  buffer = "";
  timer = setInterval(pollKeyboard, 8);
}

export function stopMacroHook() {
  if (timer) clearInterval(timer);
  timer = null;
  onFire = null;
  keyDown.clear();
  buffer = "";
}
