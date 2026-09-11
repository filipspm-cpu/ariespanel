import { clipboard } from "electron";
import koffi from "koffi";

const user32 = koffi.load("user32.dll");
const kernel32 = koffi.load("kernel32.dll");

const KEYBDINPUT = koffi.struct("KEYBDINPUT", {
  wVk: "uint16",
  wScan: "uint16",
  dwFlags: "uint32",
  time: "uint32",
  dwExtraInfo: "uintptr",
});
const MOUSEINPUT = koffi.struct("MOUSEINPUT", {
  dx: "long",
  dy: "long",
  mouseData: "uint32",
  dwFlags: "uint32",
  time: "uint32",
  dwExtraInfo: "uintptr",
});
const HARDWAREINPUT = koffi.struct("HARDWAREINPUT", {
  uMsg: "uint32",
  wParamL: "uint16",
  wParamH: "uint16",
});
const INPUT = koffi.struct("INPUT", {
  type: "uint32",
  u: koffi.union({
    mi: MOUSEINPUT,
    ki: KEYBDINPUT,
    hi: HARDWAREINPUT,
  }),
});

const SendInput = user32.func(
  "uint32 __stdcall SendInput(uint32 nInputs, INPUT *pInputs, int cbSize)",
) as (n: number, p: unknown, cb: number) => number;
const MapVirtualKeyW = user32.func("uint32 __stdcall MapVirtualKeyW(uint32 uCode, uint32 uMapType)") as (
  code: number,
  type: number,
) => number;
const SetForegroundWindow = user32.func("bool __stdcall SetForegroundWindow(void *hWnd)") as (h: unknown) => boolean;
const ShowWindow = user32.func("bool __stdcall ShowWindow(void *hWnd, int nCmdShow)") as (h: unknown, n: number) => boolean;
const GetForegroundWindow = user32.func("void * __stdcall GetForegroundWindow()") as () => unknown;
const GetWindowThreadProcessId = user32.func(
  "uint32 __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *lpdwProcessId)",
) as (h: unknown, pid: Buffer) => number;
const AttachThreadInput = user32.func(
  "bool __stdcall AttachThreadInput(uint32 idAttach, uint32 idAttachTo, bool fAttach)",
) as (a: number, b: number, f: boolean) => boolean;
const GetCurrentThreadId = kernel32.func("uint32 __stdcall GetCurrentThreadId()") as () => number;
const AllowSetForegroundWindow = user32.func("bool __stdcall AllowSetForegroundWindow(uint32 dwProcessId)") as (
  pid: number,
) => boolean;
const IsWindowVisible = user32.func("bool __stdcall IsWindowVisible(void *hWnd)") as (h: unknown) => boolean;
const GetWindowTextW = user32.func("int __stdcall GetWindowTextW(void *hWnd, _Out_ uint16 *lpString, int nMaxCount)") as (
  h: unknown,
  buf: Buffer,
  n: number,
) => number;
const EnumWindowsProc = koffi.proto("bool __stdcall EnumWindowsProc(void *hwnd, intptr lParam)");
const EnumWindows = user32.func("bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr lParam)") as (
  cb: unknown,
  lp: number,
) => boolean;
const IsIconic = user32.func("bool __stdcall IsIconic(void *hWnd)") as (h: unknown) => boolean;

const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;
const INPUT_KEYBOARD = 1;
const SW_RESTORE = 9;
const VK_RETURN = 0x0d;
const VK_TAB = 0x09;
const VK_CONTROL = 0x11;
const VK_V = 0x56;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ProcessInfo {
  hwnd: unknown;
  pid: number;
  title: string;
  name: string;
}

const GAME_HINTS = ["majestic", "gta5", "gtav", "fivem", "ragemp", "altv", "playgtav"];

export function listWindows(): ProcessInfo[] {
  try {
    return listWindowsNative();
  } catch (err) {
    console.warn("listWindows failed", err);
    return [];
  }
}

function listWindowsNative(): ProcessInfo[] {
  const result: ProcessInfo[] = [];
  const cb = koffi.register((hWnd: unknown) => {
    if (!IsWindowVisible(hWnd)) return true;
    const buf = Buffer.alloc(1024);
    const n = GetWindowTextW(hWnd, buf, 512);
    if (n <= 0) return true;
    const title = buf.toString("utf16le").replace(/\u0000.*$/, "");
    if (!title) return true;
    const pidBuf = Buffer.alloc(4);
    GetWindowThreadProcessId(hWnd, pidBuf);
    const pid = pidBuf.readUInt32LE(0);
    result.push({ hwnd: hWnd, pid, title, name: title });
    return true;
  }, koffi.pointer(EnumWindowsProc));

  EnumWindows(cb, 0);
  koffi.unregister(cb);
  return result;
}

export function findGameProcess(): ProcessInfo | null {
  const windows = listWindows();
  const scored = windows.filter((w) => GAME_HINTS.some((h) => w.title.toLowerCase().includes(h)));
  if (scored.length) {
    const majestic = scored.find((w) => /majestic/i.test(w.title));
    return majestic ?? scored[0];
  }
  return windows.find((w) => /grand theft|gta|roleplay/i.test(w.title)) ?? null;
}

function focusWindow(hwnd: unknown | null) {
  if (!hwnd) return;
  try {
    if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
    const fg = GetForegroundWindow();
    const pidDummy = Buffer.alloc(4);
    const fgThread = GetWindowThreadProcessId(fg, pidDummy);
    const targetThread = GetWindowThreadProcessId(hwnd, pidDummy);
    const cur = GetCurrentThreadId();
    AttachThreadInput(cur, fgThread, true);
    AttachThreadInput(cur, targetThread, true);
    AllowSetForegroundWindow(0xffffffff);
    SetForegroundWindow(hwnd);
    AttachThreadInput(cur, fgThread, false);
    AttachThreadInput(cur, targetThread, false);
  } catch {
    try {
      SetForegroundWindow(hwnd);
    } catch {
      /* ignore */
    }
  }
}

function keyboardEvent(wVk: number, wScan: number, dwFlags: number) {
  return {
    type: INPUT_KEYBOARD,
    u: {
      ki: {
        wVk,
        wScan,
        dwFlags,
        time: 0,
        dwExtraInfo: 0,
      },
    },
  };
}

function sendEvents(events: unknown[]) {
  if (!events.length) return;
  SendInput(events.length, events, koffi.sizeof(INPUT));
}

let injecting = false;

export function setMacroInjecting(value: boolean) {
  injecting = value;
}

export function isMacroInjecting() {
  return injecting;
}

export async function pressBackspace(count: number) {
  const vk = 0x08;
  const scan = MapVirtualKeyW(vk, 0);
  for (let i = 0; i < count; i++) {
    sendEvents([keyboardEvent(vk, scan, 0), keyboardEvent(vk, scan, KEYEVENTF_KEYUP)]);
    await sleep(4);
  }
}

function keyTap(key: string) {
  const vkMap: Record<string, number> = { T: 0x54, Enter: VK_RETURN };
  const vk = vkMap[key] ?? key.toUpperCase().charCodeAt(0);
  const scan = MapVirtualKeyW(vk, 0);
  sendEvents([
    keyboardEvent(vk, scan, 0),
    keyboardEvent(vk, scan, KEYEVENTF_KEYUP),
  ]);
}

function tapVk(vk: number) {
  const scan = MapVirtualKeyW(vk, 0);
  sendEvents([keyboardEvent(vk, scan, 0), keyboardEvent(vk, scan, KEYEVENTF_KEYUP)]);
}

function typeUnicode(text: string) {
  const events: unknown[] = [];
  for (const ch of [...text]) {
    if (ch === "\n" || ch === "\r") continue;
    const code = ch.codePointAt(0) ?? 0;
    if (code > 0xffff) continue;
    events.push(keyboardEvent(0, code, KEYEVENTF_UNICODE));
    events.push(keyboardEvent(0, code, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
  }
  sendEvents(events);
}

async function pasteText(text: string) {
  const previous = clipboard.readText();
  clipboard.writeText(text);
  sendEvents([
    keyboardEvent(VK_CONTROL, MapVirtualKeyW(VK_CONTROL, 0), 0),
    keyboardEvent(VK_V, MapVirtualKeyW(VK_V, 0), 0),
    keyboardEvent(VK_V, MapVirtualKeyW(VK_V, 0), KEYEVENTF_KEYUP),
    keyboardEvent(VK_CONTROL, MapVirtualKeyW(VK_CONTROL, 0), KEYEVENTF_KEYUP),
  ]);
  await sleep(8);
  clipboard.writeText(previous);
}

async function typeLine(text: string) {
  const parts = text.split(/\{tab\}/gi);
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    if (chunk) {
      if (chunk.length >= 8) await pasteText(chunk);
      else typeUnicode(chunk);
    }
    if (i < parts.length - 1) tapVk(VK_TAB);
  }
}

async function typeText(text: string, pressEnter: boolean) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const enterEachLine = lines.length > 1;
  for (let i = 0; i < lines.length; i++) {
    await typeLine(lines[i]);
    const last = i === lines.length - 1;
    if (enterEachLine || (pressEnter && last)) {
      tapVk(VK_RETURN);
      if (!last) await sleep(8);
    }
  }
}

export function pressKey(hwnd: unknown | null, key: string) {
  focusWindow(hwnd);
  keyTap(key);
}

export async function sendTextToWindow(hwnd: unknown | null, text: string, pressEnter: boolean) {
  focusWindow(hwnd);
  await typeText(text, pressEnter);
}

export async function sendTextForeground(text: string, pressEnter: boolean) {
  await typeText(text, pressEnter);
}

export function pressKeyForeground(key: string) {
  keyTap(key);
}
