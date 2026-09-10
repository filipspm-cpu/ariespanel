import koffi from "koffi";
import { isMacroInjecting } from "./windows";

/* Electron may delay callbacks from WH_KEYBOARD_LL. Reading the global key
 * state on a short interval works regardless of which program has focus. */
const user32 = koffi.load("user32.dll");
const GetAsyncKeyState = user32.func("short __stdcall GetAsyncKeyState(int vKey)") as (key: number) => number;

type Trigger = { id: string; sequence: string };

let timer: ReturnType<typeof setInterval> | null = null;
let buffer = "";
let lastInputAt = 0;
let triggers: Trigger[] = [];
let onFire: ((id: string, eraseCount: number) => void) | null = null;
const keyDown = new Map<number, boolean>();

const watchedKeys: Array<[number, string]> = [
  [0x08, "\b"], [0x20, " "], [0xbe, "."], [0x6e, "."], [0xbd, "-"], [0xbc, ","],
  ...Array.from({ length: 10 }, (_, i) => [0x30 + i, String(i)] as [number, string]),
  ...Array.from({ length: 26 }, (_, i) => [0x41 + i, String.fromCharCode(0x61 + i)] as [number, string]),
];

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
  buffer = "";
  // The space is already present in the game input, so remove it too.
  onFire?.(hit.id, hit.sequence.length + 1);
}

function pollKeyboard() {
  for (const [virtualKey, character] of watchedKeys) {
    const down = (GetAsyncKeyState(virtualKey) & 0x8000) !== 0;
    const wasDown = keyDown.get(virtualKey) ?? false;
    keyDown.set(virtualKey, down);
    if (isMacroInjecting() || !down || wasDown) continue;
    recordCharacter(character);
  }
}

export function startMacroHook(handler: (id: string, eraseCount: number) => void) {
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
