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

let watchedNow = watchedKeys;

function rebuildWatchedKeys() {
  const need = new Set<string>(["\b", " "]);
  for (const trigger of triggers) {
    for (const ch of trigger.sequence) need.add(ch);
  }
  watchedNow = watchedKeys.filter(([, character]) => need.has(character) || need.has(character.toLowerCase()));
}

export function updateMacroTriggers(next: Trigger[]) {
  triggers = next
    .map((trigger) => ({ id: trigger.id, sequence: trigger.sequence.trim().toLowerCase() }))
    .filter((trigger) => trigger.sequence.length > 0)
    .sort((a, b) => b.sequence.length - a.sequence.length);
  rebuildWatchedKeys();
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
  const typed = `${hit.sequence} `;
  buffer = buffer.slice(0, Math.max(0, buffer.length - typed.length));
  onFire?.(hit.id, typed.length);
}

function pollKeyboard() {
  if (!triggers.length) return;
  ensureNative();
  const shifted = shiftDown();
  for (const [virtualKey, character] of watchedNow) {
    const down = (GetAsyncKeyState(virtualKey) & 0x8000) !== 0;
    const wasDown = keyDown.get(virtualKey) ?? false;
    keyDown.set(virtualKey, down);
    if (isMacroInjecting() || !down || wasDown) continue;
    recordCharacter(virtualKey === VK_5 && shifted ? "%" : character);
  }
}

export function startMacroHook(handler: (id: string, eraseCount: number) => void) {
  ensureNative();
  onFire = handler;
  if (timer) return;
  keyDown.clear();
  buffer = "";
  timer = setInterval(pollKeyboard, 12);
}

export function stopMacroHook() {
  if (timer) clearInterval(timer);
  timer = null;
  onFire = null;
  keyDown.clear();
  buffer = "";
}
