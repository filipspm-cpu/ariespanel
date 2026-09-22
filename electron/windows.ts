import { clipboard } from "electron";

import type koffiDefault from "koffi";
import { pickGameWindow } from "./gameWindowScore";

let koffi: typeof koffiDefault;
let SendInput: (n: number, p: unknown, cb: number) => number;
let MapVirtualKeyW: (code: number, type: number) => number;
let SetForegroundWindow: (h: unknown) => boolean;
let BringWindowToTop: (h: unknown) => boolean;
let ShowWindow: (h: unknown, n: number) => boolean;
let GetForegroundWindow: () => unknown;
let GetWindowThreadProcessId: (h: unknown, pid: Buffer) => number;
let AttachThreadInput: (a: number, b: number, f: boolean) => boolean;
let GetCurrentThreadId: () => number;
let AllowSetForegroundWindow: (pid: number) => boolean;
let IsWindowVisible: (h: unknown) => boolean;
let IsWindow: (h: unknown) => boolean;
let IsHungAppWindow: (h: unknown) => boolean;
let GetClassNameW: (h: unknown, buf: Buffer, n: number) => number;
let SendMessageTimeoutW: (
  h: unknown,
  msg: number,
  wParam: number,
  lParam: Buffer,
  flags: number,
  timeout: number,
  result: Buffer,
) => number;
let EnumWindowsProc: unknown;
let EnumWindows: (cb: unknown, lp: number) => boolean;
let IsIconic: (h: unknown) => boolean;
let OpenProcess: (access: number, inherit: boolean, pid: number) => unknown;
let QueryFullProcessImageNameW: (h: unknown, flags: number, buf: Buffer, size: Buffer) => boolean;
let CloseHandle: (h: unknown) => boolean;
let INPUT: unknown;
let nativeReady = false;

function ensureNative() {
  if (nativeReady) return;
  koffi = require("koffi") as typeof koffiDefault;
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
  INPUT = koffi.struct("INPUT", {
    type: "uint32",
    u: koffi.union({
      mi: MOUSEINPUT,
      ki: KEYBDINPUT,
      hi: HARDWAREINPUT,
    }),
  });

  SendInput = user32.func(
    "uint32 __stdcall SendInput(uint32 nInputs, INPUT *pInputs, int cbSize)",
  ) as (n: number, p: unknown, cb: number) => number;
  MapVirtualKeyW = user32.func("uint32 __stdcall MapVirtualKeyW(uint32 uCode, uint32 uMapType)") as (
    code: number,
    type: number,
  ) => number;
  SetForegroundWindow = user32.func("bool __stdcall SetForegroundWindow(void *hWnd)") as (h: unknown) => boolean;
  BringWindowToTop = user32.func("bool __stdcall BringWindowToTop(void *hWnd)") as (h: unknown) => boolean;
  ShowWindow = user32.func("bool __stdcall ShowWindow(void *hWnd, int nCmdShow)") as (h: unknown, n: number) => boolean;
  GetForegroundWindow = user32.func("void * __stdcall GetForegroundWindow()") as () => unknown;
  GetWindowThreadProcessId = user32.func(
    "uint32 __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *lpdwProcessId)",
  ) as (h: unknown, pid: Buffer) => number;
  AttachThreadInput = user32.func(
    "bool __stdcall AttachThreadInput(uint32 idAttach, uint32 idAttachTo, bool fAttach)",
  ) as (a: number, b: number, f: boolean) => boolean;
  GetCurrentThreadId = kernel32.func("uint32 __stdcall GetCurrentThreadId()") as () => number;
  AllowSetForegroundWindow = user32.func("bool __stdcall AllowSetForegroundWindow(uint32 dwProcessId)") as (
    pid: number,
  ) => boolean;
  IsWindowVisible = user32.func("bool __stdcall IsWindowVisible(void *hWnd)") as (h: unknown) => boolean;
  IsWindow = user32.func("bool __stdcall IsWindow(void *hWnd)") as (h: unknown) => boolean;
  IsHungAppWindow = user32.func("bool __stdcall IsHungAppWindow(void *hWnd)") as (h: unknown) => boolean;
  GetClassNameW = user32.func("int __stdcall GetClassNameW(void *hWnd, _Out_ uint16 *lpClassName, int nMaxCount)") as (
    h: unknown,
    buf: Buffer,
    n: number,
  ) => number;
  SendMessageTimeoutW = user32.func(
    "intptr __stdcall SendMessageTimeoutW(void *hWnd, uint32 Msg, uintptr wParam, void *lParam, uint32 fuFlags, uint32 uTimeout, _Out_ uintptr *lpdwResult)",
  ) as (
    h: unknown,
    msg: number,
    wParam: number,
    lParam: Buffer,
    flags: number,
    timeout: number,
    result: Buffer,
  ) => number;
  EnumWindowsProc = koffi.proto("bool __stdcall EnumWindowsProc(void *hwnd, intptr lParam)");
  EnumWindows = user32.func("bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr lParam)") as (
    cb: unknown,
    lp: number,
  ) => boolean;
  IsIconic = user32.func("bool __stdcall IsIconic(void *hWnd)") as (h: unknown) => boolean;
  OpenProcess = kernel32.func("void * __stdcall OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)") as (
    access: number,
    inherit: boolean,
    pid: number,
  ) => unknown;
  QueryFullProcessImageNameW = kernel32.func(
    "bool __stdcall QueryFullProcessImageNameW(void *hProcess, uint32 dwFlags, _Out_ uint16 *lpExeName, _Inout_ uint32 *lpdwSize)",
  ) as (h: unknown, flags: number, buf: Buffer, size: Buffer) => boolean;
  CloseHandle = kernel32.func("bool __stdcall CloseHandle(void *hObject)") as (h: unknown) => boolean;
  nativeReady = true;
}

const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;
const INPUT_MOUSE = 0;
const INPUT_KEYBOARD = 1;
const MOUSEEVENTF_LEFTDOWN = 0x0002;
const MOUSEEVENTF_LEFTUP = 0x0004;
const MOUSEEVENTF_RIGHTDOWN = 0x0008;
const MOUSEEVENTF_RIGHTUP = 0x0010;
const SW_RESTORE = 9;
const VK_RETURN = 0x0d;
const VK_TAB = 0x09;
const VK_CONTROL = 0x11;
const VK_V = 0x56;
const WM_GETTEXT = 0x000d;
const SMTO_ABORTIFHUNG = 0x0002;
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const ASFW_ANY = 0xffffffff;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ProcessInfo {
  hwnd: number;
  pid: number;
  title: string;
  name: string;
  className?: string;
}

export interface PublicProcessInfo {
  pid: number;
  title: string;
  name: string;
}

export { pickGameWindow, scoreGameWindow } from "./gameWindowScore";

export function publicProcess(p: ProcessInfo | null): PublicProcessInfo | null {
  if (!p) return null;
  return { pid: p.pid, title: p.title, name: p.name };
}

let windowsCache: { at: number; list: ProcessInfo[] } = { at: 0, list: [] };

function hwndId(hWnd: unknown): number {
  try {
    const addr = koffi.address(hWnd);
    const asNumber = Number(addr);
    return Number.isFinite(asNumber) ? asNumber : 0;
  } catch {
    const asNumber = Number(hWnd);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }
}

function sameHwnd(a: unknown, b: unknown): boolean {
  const left = hwndId(a);
  const right = hwndId(b);
  return Boolean(left) && left === right;
}

function readUtf16(buf: Buffer): string {
  return buf.toString("utf16le").split("\u0000")[0].trim();
}

function windowClassName(hWnd: unknown): string {
  const buf = Buffer.alloc(512);
  const n = GetClassNameW(hWnd, buf, 256);
  if (n <= 0) return "";
  return readUtf16(buf);
}

function windowTitleSafe(hWnd: unknown): string {
  try {
    if (IsHungAppWindow(hWnd)) return "";
    const buf = Buffer.alloc(1024);
    const result = Buffer.alloc(8);
    const ok = SendMessageTimeoutW(hWnd, WM_GETTEXT, 512, buf, SMTO_ABORTIFHUNG, 80, result);
    if (!ok) return "";
    return readUtf16(buf);
  } catch {
    return "";
  }
}

function processExeName(pid: number, cache: Map<number, string>): string {
  if (!pid) return "";
  const cached = cache.get(pid);
  if (cached !== undefined) return cached;
  let name = "";
  try {
    const handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
    if (handle) {
      try {
        const buf = Buffer.alloc(1040);
        const size = Buffer.alloc(4);
        size.writeUInt32LE(520, 0);
        if (QueryFullProcessImageNameW(handle, 0, buf, size)) {
          const full = readUtf16(buf);
          name = full.split(/[/\\]/).pop() || full;
        }
      } finally {
        CloseHandle(handle);
      }
    }
  } catch {
    name = "";
  }
  cache.set(pid, name);
  return name;
}

export function listWindows(force = false): ProcessInfo[] {
  const now = Date.now();
  if (!force && now - windowsCache.at < 800 && windowsCache.list.length) return windowsCache.list;
  try {
    const list = listWindowsNative();
    windowsCache = { at: now, list };
    return list;
  } catch (err) {
    console.warn("listWindows failed", err);
    return windowsCache.list;
  }
}

function listWindowsNative(): ProcessInfo[] {
  ensureNative();
  const result: ProcessInfo[] = [];
  const exeCache = new Map<number, string>();
  const cb = koffi.register((hWnd: unknown) => {
    try {
      if (!IsWindowVisible(hWnd)) return true;
      const pidBuf = Buffer.alloc(4);
      GetWindowThreadProcessId(hWnd, pidBuf);
      const pid = pidBuf.readUInt32LE(0);
      const className = windowClassName(hWnd);
      const title = windowTitleSafe(hWnd);
      const name = processExeName(pid, exeCache);
      if (!title && !name && !className) return true;
      result.push({
        hwnd: hwndId(hWnd),
        pid,
        title: title || name || className,
        name: name || title || className,
        className,
      });
    } catch {
      /* skip a single bad window instead of hanging the app */
    }
    return true;
  }, koffi.pointer(EnumWindowsProc));

  try {
    EnumWindows(cb, 0);
  } finally {
    koffi.unregister(cb);
  }
  return result;
}

export function findGameProcess(): ProcessInfo | null {
  return pickGameWindow(listWindows(true));
}

export function isGameForeground(): boolean {
  ensureNative();
  const game = pickGameWindow(listWindows());
  if (!game?.hwnd) return false;
  try {
    const fg = GetForegroundWindow();
    return hwndId(fg) !== 0 && hwndId(fg) === game.hwnd;
  } catch {
    return false;
  }
}

function focusWindow(hwnd: unknown | null) {
  ensureNative();
  if (!hwnd) return false;
  try {
    if (!IsWindow(hwnd)) return false;
    if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
    const fg = GetForegroundWindow();
    const pidDummy = Buffer.alloc(4);
    const fgThread = fg ? GetWindowThreadProcessId(fg, pidDummy) : 0;
    const targetThread = GetWindowThreadProcessId(hwnd, pidDummy);
    const cur = GetCurrentThreadId();
    if (fgThread) AttachThreadInput(cur, fgThread, true);
    if (targetThread) AttachThreadInput(cur, targetThread, true);
    AllowSetForegroundWindow(ASFW_ANY);
    ShowWindow(hwnd, SW_RESTORE);
    BringWindowToTop(hwnd);
    SetForegroundWindow(hwnd);
    if (fgThread) AttachThreadInput(cur, fgThread, false);
    if (targetThread) AttachThreadInput(cur, targetThread, false);
    return sameHwnd(GetForegroundWindow(), hwnd);
  } catch {
    try {
      SetForegroundWindow(hwnd);
      return sameHwnd(GetForegroundWindow(), hwnd);
    } catch {
      return false;
    }
  }
}

async function focusWindowReliable(hwnd: unknown | null) {
  if (!hwnd) return false;
  for (let i = 0; i < 4; i++) {
    if (focusWindow(hwnd)) return true;
    await sleep(40);
  }
  return focusWindow(hwnd);
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

function mouseEvent(dwFlags: number) {
  return {
    type: INPUT_MOUSE,
    u: {
      mi: {
        dx: 0,
        dy: 0,
        mouseData: 0,
        dwFlags,
        time: 0,
        dwExtraInfo: 0,
      },
    },
  };
}

export async function clickMouse(button: "left" | "right") {
  ensureNative();
  const down = button === "right" ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN;
  const up = button === "right" ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP;
  sendEvents([mouseEvent(down)]);
  await sleep(12);
  sendEvents([mouseEvent(up)]);
}

function sendEvents(events: unknown[]) {
  ensureNative();
  if (!events.length) return;
  SendInput(events.length, events, koffi.sizeof(INPUT));
}

let injecting = false;
let injectDepth = 0;

export function setMacroInjecting(value: boolean) {
  if (value) injectDepth += 1;
  else injectDepth = Math.max(0, injectDepth - 1);
  injecting = injectDepth > 0;
}

export function isMacroInjecting() {
  return injecting;
}

export async function pressBackspace(count: number) {
  ensureNative();
  const vk = 0x08;
  const scan = MapVirtualKeyW(vk, 0);
  for (let i = 0; i < count; i++) {
    sendEvents([keyboardEvent(vk, scan, 0), keyboardEvent(vk, scan, KEYEVENTF_KEYUP)]);
    await sleep(4);
  }
}

function keyTap(key: string) {
  ensureNative();
  const vkMap: Record<string, number> = { T: 0x54, Enter: VK_RETURN };
  const vk = vkMap[key] ?? key.toUpperCase().charCodeAt(0);
  const scan = MapVirtualKeyW(vk, 0);
  sendEvents([keyboardEvent(vk, scan, 0), keyboardEvent(vk, scan, KEYEVENTF_KEYUP)]);
}

async function tapVk(vk: number) {
  ensureNative();
  const scan = MapVirtualKeyW(vk, 0);
  sendEvents([keyboardEvent(vk, scan, 0)]);
  await sleep(20);
  sendEvents([keyboardEvent(vk, scan, KEYEVENTF_KEYUP)]);
}

function pasteWaitMs(text: string, fast?: boolean) {
  if (fast) return Math.max(50, Math.min(260, 28 + text.length * 3));
  return Math.max(220, Math.min(1500, 120 + text.length * 10));
}

async function pasteText(text: string, fast?: boolean) {
  ensureNative();
  if (!text) return;
  clipboard.writeText(text);
  await sleep(fast ? 18 : 50);
  const ctrlScan = MapVirtualKeyW(VK_CONTROL, 0);
  const vScan = MapVirtualKeyW(VK_V, 0);
  sendEvents([keyboardEvent(VK_CONTROL, ctrlScan, 0)]);
  await sleep(fast ? 12 : 25);
  sendEvents([keyboardEvent(VK_V, vScan, 0)]);
  await sleep(fast ? 16 : 30);
  sendEvents([keyboardEvent(VK_V, vScan, KEYEVENTF_KEYUP), keyboardEvent(VK_CONTROL, ctrlScan, KEYEVENTF_KEYUP)]);
  await sleep(pasteWaitMs(text, fast));
}

function unicodeEvents(text: string): unknown[] {
  const events: unknown[] = [];
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    if (code > 0xffff) {
      const high = Math.floor((code - 0x10000) / 0x400) + 0xd800;
      const low = ((code - 0x10000) % 0x400) + 0xdc00;
      events.push(keyboardEvent(0, high, KEYEVENTF_UNICODE), keyboardEvent(0, high, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
      events.push(keyboardEvent(0, low, KEYEVENTF_UNICODE), keyboardEvent(0, low, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
    } else {
      events.push(keyboardEvent(0, code, KEYEVENTF_UNICODE), keyboardEvent(0, code, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
    }
  }
  return events;
}

async function typeChars(text: string) {
  const events = unicodeEvents(text);
  const chunk = 64;
  for (let i = 0; i < events.length; i += chunk) {
    sendEvents(events.slice(i, i + chunk));
    await sleep(8);
  }
}

async function typeLine(text: string, fast?: boolean) {
  const parts = text.split(/\{tab\}/gi);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part) {
      clipboard.writeText(part);
      await sleep(fast ? 8 : 20);
      if (clipboard.readText() === part) {
        await pasteText(part, fast);
      } else {
        await typeChars(part);
      }
    }
    if (i < parts.length - 1) await tapVk(VK_TAB);
  }
}

function splitChatLines(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export type TypeTextOptions = {
  pressEnter?: boolean;
  enterEachLine?: boolean;
  pressT?: boolean;
  skipFirstT?: boolean;
  fastPaste?: boolean;
};

function asTypeOptions(value: boolean | TypeTextOptions | undefined): TypeTextOptions {
  if (typeof value === "boolean") return { pressEnter: value };
  return value ?? {};
}

async function typeText(text: string, options: TypeTextOptions) {
  const previous = clipboard.readText();
  const fast = Boolean(options.fastPaste);
  try {
    const chatLines = Boolean(options.pressT || options.enterEachLine);
    const reopenChat = Boolean(options.pressT) || chatLines;
    const rawLines = chatLines
      ? splitChatLines(text)
      : text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const toSend: string[] = [];
    let previousLine = "";
    for (const line of rawLines) {
      if (chatLines) {
        const key = line.trim().toLowerCase();
        if (key && key === previousLine) continue;
        previousLine = key;
      }
      toSend.push(line);
    }
    const skipFirstT = options.skipFirstT !== false;
    for (let i = 0; i < toSend.length; i++) {
      const line = toSend[i];
      const last = i === toSend.length - 1;
      const openChat = reopenChat && (i > 0 || !skipFirstT);
      if (openChat) {
        await tapVk(0x54);
        await sleep(fast ? 160 : 320);
      }
      await typeLine(line, fast && !chatLines);
      await sleep(chatLines ? (fast ? 80 : 140) : fast ? 12 : 40);
      if (chatLines || (options.pressEnter && last)) {
        await tapVk(VK_RETURN);
        if (!last) await sleep(chatLines ? (fast ? 220 : 380) : fast ? 90 : 220);
      }
    }
  } finally {
    await sleep(fast ? 25 : 60);
    try {
      clipboard.writeText(previous);
    } catch {
      /* ignore */
    }
  }
}

export function pressKey(hwnd: unknown | null, key: string) {
  focusWindow(hwnd);
  keyTap(key);
}

export async function sendTextToWindow(hwnd: unknown | null, text: string, pressEnter: boolean) {
  await focusWindowReliable(hwnd);
  await sleep(80);
  await typeText(text, { pressEnter });
}

export async function sendTextForeground(text: string, pressEnterOrOptions: boolean | TypeTextOptions = false) {
  await typeText(text, asTypeOptions(pressEnterOrOptions));
}

export function pressKeyForeground(key: string) {
  keyTap(key);
}
