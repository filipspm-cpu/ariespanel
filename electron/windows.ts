import { clipboard } from "electron";

import type koffiDefault from "koffi";

let koffi: typeof koffiDefault;
let SendInput: (n: number, p: unknown, cb: number) => number;
let MapVirtualKeyW: (code: number, type: number) => number;
let SetForegroundWindow: (h: unknown) => boolean;
let ShowWindow: (h: unknown, n: number) => boolean;
let GetForegroundWindow: () => unknown;
let GetWindowThreadProcessId: (h: unknown, pid: number[]) => number;
let AllowSetForegroundWindow: (pid: number) => boolean;
let IsWindowVisible: (h: unknown) => boolean;
let GetWindowTextW: (h: unknown, buf: Buffer, n: number) => number;
let GetClassNameW: (h: unknown, buf: Buffer, n: number) => number;
let EnumWindowsProc: unknown;
let EnumWindows: (cb: unknown, lp: number) => boolean;
let IsIconic: (h: unknown) => boolean;
let IsWindow: (h: unknown) => boolean;
let BringWindowToTop: (h: unknown) => boolean;
let OpenProcess: (access: number, inherit: boolean, pid: number) => unknown;
let CloseHandle: (h: unknown) => boolean;
let QueryFullProcessImageNameW: (h: unknown, flags: number, buf: Buffer, size: number[]) => boolean;
let INPUT: unknown;
let nativeReady = false;

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const VK_MENU = 0x12;

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
  ShowWindow = user32.func("bool __stdcall ShowWindow(void *hWnd, int nCmdShow)") as (h: unknown, n: number) => boolean;
  GetForegroundWindow = user32.func("void * __stdcall GetForegroundWindow()") as () => unknown;
  GetWindowThreadProcessId = user32.func(
    "uint32 __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *lpdwProcessId)",
  ) as (h: unknown, pid: number[]) => number;
  AllowSetForegroundWindow = user32.func("bool __stdcall AllowSetForegroundWindow(uint32 dwProcessId)") as (
    pid: number,
  ) => boolean;
  IsWindowVisible = user32.func("bool __stdcall IsWindowVisible(void *hWnd)") as (h: unknown) => boolean;
  GetWindowTextW = user32.func("int __stdcall GetWindowTextW(void *hWnd, void *lpString, int nMaxCount)") as (
    h: unknown,
    buf: Buffer,
    n: number,
  ) => number;
  GetClassNameW = user32.func("int __stdcall GetClassNameW(void *hWnd, void *lpClassName, int nMaxCount)") as (
    h: unknown,
    buf: Buffer,
    n: number,
  ) => number;
  EnumWindowsProc = koffi.proto("bool __stdcall EnumWindowsProc(void *hwnd, intptr lParam)");
  EnumWindows = user32.func("bool __stdcall EnumWindows(EnumWindowsProc *lpEnumFunc, intptr lParam)") as (
    cb: unknown,
    lp: number,
  ) => boolean;
  IsIconic = user32.func("bool __stdcall IsIconic(void *hWnd)") as (h: unknown) => boolean;
  IsWindow = user32.func("bool __stdcall IsWindow(void *hWnd)") as (h: unknown) => boolean;
  BringWindowToTop = user32.func("bool __stdcall BringWindowToTop(void *hWnd)") as (h: unknown) => boolean;
  OpenProcess = kernel32.func(
    "void * __stdcall OpenProcess(uint32 dwDesiredAccess, bool bInheritHandle, uint32 dwProcessId)",
  ) as (access: number, inherit: boolean, pid: number) => unknown;
  CloseHandle = kernel32.func("bool __stdcall CloseHandle(void *hObject)") as (h: unknown) => boolean;
  QueryFullProcessImageNameW = kernel32.func(
    "bool __stdcall QueryFullProcessImageNameW(void *hProcess, uint32 dwFlags, void *lpExeName, _Inout_ uint32 *lpdwSize)",
  ) as (h: unknown, flags: number, buf: Buffer, size: number[]) => boolean;
  nativeReady = true;
}

const KEYEVENTF_KEYUP = 0x0002;
const INPUT_KEYBOARD = 1;
const SW_RESTORE = 9;
const SW_SHOW = 5;
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
  className?: string;
}

export type PublicProcess = {
  pid: number;
  title: string;
  name: string;
};

const GAME_EXE =
  /(?:^|[^a-z0-9])(gta5(?:_enhanced)?|playgta[v5]?|fivem(?:_.*)?|ragemp(?:_.*)?|rage-?mp|altv(?:-client)?|majestic)(?:\.exe)?$/i;
const GAME_CLASS = /^(grcwindow|ragemp|altv)/i;
const GAME_TITLE =
  /majestic|grand theft|gta\s*[v5]|gtav|gta5|gta\s*5|fivem|five\s*m|ragemp|rage\s*mp|rage multiplayer|alt:?v|roleplay|playgta/i;
const NOT_GAME_EXE = /(?:chrome|msedge|firefox|discord|spotify|code|explorer|aries|electron)\.exe$/i;

export function scoreGameWindow(w: { title: string; name: string; className?: string }): number {
  const exe = (w.name || "").replace(/^.*[/\\]/, "").toLowerCase();
  const title = (w.title || "").toLowerCase();
  const cls = (w.className || "").toLowerCase();
  if (NOT_GAME_EXE.test(exe) && !GAME_EXE.test(exe)) return 0;

  let score = 0;
  if (/^gta5(?:_enhanced)?\.exe$/.test(exe)) score += 120;
  else if (GAME_EXE.test(exe)) score += 80;
  if (GAME_CLASS.test(cls)) score += 70;
  if (/majestic/.test(title)) score += 40;
  if (GAME_TITLE.test(title)) score += 30;
  if (/(launcher|rockstar|social club)/.test(title) && !/grand theft/.test(title)) score -= 45;
  return score;
}

export function toPublicProcess(p: ProcessInfo | null): PublicProcess | null {
  if (!p) return null;
  return {
    pid: p.pid,
    title: p.title || p.name,
    name: p.name,
  };
}

let windowsCache: { at: number; list: ProcessInfo[] } = { at: 0, list: [] };

function readUtf16(buf: Buffer): string {
  return buf.toString("utf16le").replace(/\u0000.*$/, "").trim();
}

function hwndKey(h: unknown): string {
  if (h == null) return "";
  if (typeof h === "bigint" || typeof h === "number") return String(h);
  try {
    const address = (koffi as { address?: (ptr: unknown) => unknown }).address;
    if (typeof address === "function") return String(address(h));
  } catch {
    /* ignore */
  }
  return String(h);
}

function sameHwnd(a: unknown, b: unknown): boolean {
  const left = hwndKey(a);
  const right = hwndKey(b);
  return Boolean(left) && left === right;
}

function getWindowTitle(hwnd: unknown): string {
  const buf = Buffer.alloc(1024);
  const n = GetWindowTextW(hwnd, buf, 512);
  if (n <= 0) return "";
  return readUtf16(buf);
}

function getClassName(hwnd: unknown): string {
  const buf = Buffer.alloc(512);
  const n = GetClassNameW(hwnd, buf, 256);
  if (n <= 0) return "";
  return readUtf16(buf);
}

function getProcessExe(pid: number): string {
  if (!pid) return "";
  let handle: unknown;
  try {
    handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
    if (!handle) return "";
    const buf = Buffer.alloc(1024);
    const size = [512];
    const ok = QueryFullProcessImageNameW(handle, 0, buf, size);
    if (!ok) return "";
    const raw = readUtf16(buf);
    return raw.split(/[/\\]/).pop() || raw;
  } catch {
    return "";
  } finally {
    if (handle) {
      try {
        CloseHandle(handle);
      } catch {
        /* ignore */
      }
    }
  }
}

function windowPid(hwnd: unknown): number {
  const pidOut = [0];
  GetWindowThreadProcessId(hwnd, pidOut);
  return pidOut[0] >>> 0;
}

export function listWindows(force = false): ProcessInfo[] {
  const now = Date.now();
  if (!force && now - windowsCache.at < 1500 && windowsCache.list.length) return windowsCache.list;
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
  const cb = koffi.register((hWnd: unknown) => {
    try {
      if (!IsWindowVisible(hWnd)) return true;
      const title = getWindowTitle(hWnd);
      const pid = windowPid(hWnd);
      const exe = getProcessExe(pid);
      const className = getClassName(hWnd);
      const info: ProcessInfo = {
        hwnd: hWnd,
        pid,
        title,
        name: exe || title,
        className,
      };
      if (!title && scoreGameWindow(info) <= 0) return true;
      result.push(info);
    } catch {
      /* skip broken hwnd */
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

export function findGameProcess(force = false): ProcessInfo | null {
  const windows = listWindows(force);
  const ranked = windows
    .map((w) => ({ w, score: scoreGameWindow(w) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.w ?? null;
}

export function findTargetWindow(pid?: number | null, title?: string | null): ProcessInfo | null {
  const windows = listWindows(true);
  if (pid) {
    const byPid = windows.filter((w) => w.pid === pid);
    if (title) {
      const exact = byPid.find((w) => w.title === title);
      if (exact) return exact;
    }
    if (byPid.length) {
      return [...byPid].sort((a, b) => scoreGameWindow(b) - scoreGameWindow(a))[0];
    }
  }
  return findGameProcess(true);
}

async function focusWindow(hwnd: unknown | null): Promise<boolean> {
  ensureNative();
  if (!hwnd) return false;
  try {
    if (!IsWindow(hwnd)) return false;
    if (sameHwnd(GetForegroundWindow(), hwnd)) return true;
    if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
    ShowWindow(hwnd, SW_SHOW);
    AllowSetForegroundWindow(0xffffffff);

    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt) await sleep(45);
      const scan = MapVirtualKeyW(VK_MENU, 0);
      sendEvents([keyboardEvent(VK_MENU, scan, 0)]);
      try {
        BringWindowToTop(hwnd);
      } catch {
        /* optional */
      }
      SetForegroundWindow(hwnd);
      sendEvents([keyboardEvent(VK_MENU, scan, KEYEVENTF_KEYUP)]);
      await sleep(40);
      if (sameHwnd(GetForegroundWindow(), hwnd)) return true;
    }
  } catch {
    try {
      SetForegroundWindow(hwnd);
    } catch {
      /* ignore */
    }
  }
  return sameHwnd(GetForegroundWindow(), hwnd);
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
  ensureNative();
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

async function writeClipboard(text: string) {
  clipboard.writeText(text);
  for (let i = 0; i < 10 && clipboard.readText() !== text; i++) {
    clipboard.writeText(text);
    await sleep(16);
  }
}

async function pasteText(text: string) {
  ensureNative();
  if (!text) return;
  await writeClipboard(text);
  await sleep(30);
  const ctrlScan = MapVirtualKeyW(VK_CONTROL, 0);
  const vScan = MapVirtualKeyW(VK_V, 0);
  sendEvents([keyboardEvent(VK_CONTROL, ctrlScan, 0)]);
  await sleep(20);
  sendEvents([keyboardEvent(VK_V, vScan, 0)]);
  await sleep(28);
  sendEvents([
    keyboardEvent(VK_V, vScan, KEYEVENTF_KEYUP),
    keyboardEvent(VK_CONTROL, ctrlScan, KEYEVENTF_KEYUP),
  ]);
  await sleep(Math.max(260, Math.min(800, 180 + text.length * 3)));
}

async function typeLine(text: string) {
  const parts = text.split(/\{tab\}/gi);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) await pasteText(parts[i]);
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
};

function asTypeOptions(value: boolean | TypeTextOptions | undefined): TypeTextOptions {
  if (typeof value === "boolean") return { pressEnter: value };
  return value ?? {};
}

async function typeText(text: string, options: TypeTextOptions) {
  const chatLines = Boolean(options.pressT || options.enterEachLine);
  const reopenChat = Boolean(options.pressT) || chatLines;
  const toSend = chatLines
    ? splitChatLines(text)
    : text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const previous = clipboard.readText();
  try {
    for (let i = 0; i < toSend.length; i++) {
      const last = i === toSend.length - 1;
      if (reopenChat && i > 0) {
        await tapVk(0x54);
        await sleep(180);
      }
      await typeLine(toSend[i]);
      await sleep(70);
      if (chatLines || (options.pressEnter && last)) {
        await tapVk(VK_RETURN);
        if (!last) await sleep(260);
      }
    }
    await sleep(80);
  } finally {
    clipboard.writeText(previous);
  }
}

export async function pressKey(hwnd: unknown | null, key: string) {
  await focusWindow(hwnd);
  keyTap(key);
}

export async function sendTextToWindow(hwnd: unknown | null, text: string, pressEnter: boolean) {
  await focusWindow(hwnd);
  await typeText(text, { pressEnter });
}

export async function sendCommandToWindow(
  hwnd: unknown | null,
  text: string,
  options: { pressT?: boolean; pressEnter?: boolean },
) {
  const focused = await focusWindow(hwnd);
  if (hwnd && !focused) {
    await sleep(80);
    await focusWindow(hwnd);
  }
  if (options.pressT) {
    await tapVk(0x54);
    await sleep(200);
  }
  await typeText(text, { pressEnter: Boolean(options.pressEnter) });
}

export async function sendTextForeground(text: string, pressEnterOrOptions: boolean | TypeTextOptions = false) {
  await typeText(text, asTypeOptions(pressEnterOrOptions));
}

export function pressKeyForeground(key: string) {
  keyTap(key);
}
