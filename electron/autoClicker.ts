import fs from "fs";
import path from "path";
import { app, type BrowserWindow } from "electron";
import type koffiDefault from "koffi";
import { clickMouse, isGameForeground, isMacroInjecting } from "./windows";
import { loadState } from "./storage";
import { isBetaTesterId } from "./testers";
import { panelLog } from "./panelLog";

export type ClickerButton = "left" | "right";

export type ClickerSettings = {
  intervalMs: number;
  button: ClickerButton;
  hotkey: string;
  repeat: number;
  gameOnly: boolean;
};

export type ClickerStatus = ClickerSettings & {
  allowed: boolean;
  running: boolean;
  arming: boolean;
  clicks: number;
  message?: string;
};

const HOTKEY_VK: Record<string, number> = {
  F6: 0x75,
  F7: 0x76,
  F8: 0x77,
  F9: 0x78,
  F10: 0x79,
  Insert: 0x2d,
  Pause: 0x13,
};

export const CLICKER_HOTKEYS = Object.keys(HOTKEY_VK);

const MIN_INTERVAL = 50;
const MAX_INTERVAL = 2000;
const MAX_REPEAT = 100_000;
const LEAD_MS = 450;

const DEFAULTS: ClickerSettings = {
  intervalMs: 100,
  button: "left",
  hotkey: "F6",
  repeat: 0,
  gameOnly: true,
};

let settings: ClickerSettings = { ...DEFAULTS };
let loaded = false;
let running = false;
let arming = false;
let clicks = 0;
let message = "";
let generation = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let hook: ReturnType<typeof setInterval> | null = null;
let hotkeyDown = false;
let lastPublish = 0;
let getWindow: () => BrowserWindow | null = () => null;

let GetAsyncKeyState: (key: number) => number;
let nativeReady = false;

function ensureHookNative() {
  if (nativeReady) return;
  const koffi = require("koffi") as typeof koffiDefault;
  const user32 = koffi.load("user32.dll");
  GetAsyncKeyState = user32.func("short __stdcall GetAsyncKeyState(int vKey)") as (key: number) => number;
  nativeReady = true;
}

function filePath() {
  return path.join(app.getPath("userData"), "aries-clicker.json");
}

function clampSettings(raw: Partial<ClickerSettings> | null | undefined): ClickerSettings {
  const interval = Number(raw?.intervalMs);
  const repeat = Number(raw?.repeat);
  const hotkey = String(raw?.hotkey || DEFAULTS.hotkey);
  return {
    intervalMs: Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, Number.isFinite(interval) ? Math.round(interval) : DEFAULTS.intervalMs)),
    button: raw?.button === "right" ? "right" : "left",
    hotkey: HOTKEY_VK[hotkey] ? hotkey : DEFAULTS.hotkey,
    repeat: Math.min(MAX_REPEAT, Math.max(0, Number.isFinite(repeat) ? Math.round(repeat) : 0)),
    gameOnly: raw?.gameOnly !== false,
  };
}

function readSettings() {
  if (loaded) return settings;
  loaded = true;
  try {
    settings = clampSettings(JSON.parse(fs.readFileSync(filePath(), "utf8")) as Partial<ClickerSettings>);
  } catch {
    settings = { ...DEFAULTS };
  }
  return settings;
}

function writeSettings() {
  try {
    fs.mkdirSync(path.dirname(filePath()), { recursive: true });
    fs.writeFileSync(filePath(), JSON.stringify(settings, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

function allowedNow() {
  return isBetaTesterId(loadState().settings.discordId);
}

export function getClickerStatus(): ClickerStatus {
  readSettings();
  return {
    ...settings,
    allowed: allowedNow(),
    running,
    arming,
    clicks,
    message: message || undefined,
  };
}

function publish(force = false) {
  const now = Date.now();
  if (!force && now - lastPublish < 200) return;
  lastPublish = now;
  const status = getClickerStatus();
  try {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send("clicker:status", status);
  } catch {
    /* window can close mid-click */
  }
}

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function finish(nextMessage: string) {
  generation += 1;
  running = false;
  arming = false;
  clearTimer();
  message = nextMessage;
  publish(true);
}

async function clickOnce(gen: number) {
  if (gen !== generation || !running) return;
  if (!allowedNow()) {
    finish("Auto kliker jest tylko dla beta testerów.");
    return;
  }
  if (isMacroInjecting()) {
    timer = setTimeout(() => void clickOnce(gen), settings.intervalMs);
    return;
  }
  const started = Date.now();
  try {
    if (settings.gameOnly && !isGameForeground()) {
      message = "Czeka na okno gry…";
      publish();
      timer = setTimeout(() => void clickOnce(gen), settings.intervalMs);
      return;
    }
    await clickMouse(settings.button);
  } catch (err) {
    finish("Kliknięcie nie doszło. Auto kliker działa w ARIES na Windows.");
    panelLog({
      level: "error",
      source: "clicker",
      message: "Auto kliker nie wysłał kliknięcia",
      detail: err instanceof Error ? err.message : String(err),
    });
    return;
  }
  if (gen !== generation || !running) return;
  clicks += 1;
  message = "";
  if (settings.repeat > 0 && clicks >= settings.repeat) {
    panelLog({ level: "info", source: "clicker", message: `Auto kliker skończył po ${clicks} kliknięciach` });
    finish("");
    return;
  }
  publish();
  const wait = Math.max(0, settings.intervalMs - (Date.now() - started));
  timer = setTimeout(() => void clickOnce(gen), wait);
}

function beginLoop() {
  arming = false;
  running = true;
  message = "";
  const gen = generation;
  publish(true);
  void clickOnce(gen);
}

export function configureClicker(patch: Partial<ClickerSettings>): ClickerStatus {
  readSettings();
  if (!allowedNow()) {
    message = "Auto kliker jest tylko dla beta testerów.";
    publish(true);
    return getClickerStatus();
  }
  settings = clampSettings({ ...settings, ...patch });
  writeSettings();
  hotkeyDown = false;
  message = "";
  publish(true);
  return getClickerStatus();
}

export function setClickerRunning(next: boolean): ClickerStatus {
  readSettings();
  if (next && !allowedNow()) {
    message = "Auto kliker jest tylko dla beta testerów.";
    panelLog({ level: "warn", source: "clicker", message: message });
    publish(true);
    return getClickerStatus();
  }
  if (!next) {
    if (running || arming) panelLog({ level: "info", source: "clicker", message: "Auto kliker zatrzymany" });
    finish("");
    return getClickerStatus();
  }
  if (running || arming) return getClickerStatus();
  clicks = 0;
  generation += 1;
  const gen = generation;
  running = true;
  arming = true;
  message = "Przesuń kursor na grę…";
  panelLog({
    level: "info",
    source: "clicker",
    message: `Auto kliker startuje (${settings.button === "right" ? "prawy" : "lewy"}, ${settings.intervalMs} ms, ${settings.hotkey})`,
  });
  publish(true);
  timer = setTimeout(() => {
    if (gen !== generation) return;
    beginLoop();
  }, LEAD_MS);
  return getClickerStatus();
}

export function toggleClicker(): ClickerStatus {
  return setClickerRunning(!(running || arming));
}

export function resetClickerCount(): ClickerStatus {
  if (!running && !arming) clicks = 0;
  publish(true);
  return getClickerStatus();
}

function pollHotkey() {
  if (!nativeReady) return;
  const vk = HOTKEY_VK[readSettings().hotkey];
  if (!vk) return;
  const down = (GetAsyncKeyState(vk) & 0x8000) !== 0;
  const edge = down && !hotkeyDown;
  hotkeyDown = down;
  if (!edge || isMacroInjecting()) return;
  if (!allowedNow()) return;
  toggleClicker();
}

export function bindClickerWindow(fn: () => BrowserWindow | null) {
  getWindow = fn;
}

export function startClickerHook() {
  readSettings();
  if (hook) return;
  try {
    ensureHookNative();
    const vk = HOTKEY_VK[settings.hotkey];
    hotkeyDown = Boolean(vk) && (GetAsyncKeyState(vk) & 0x8000) !== 0;
  } catch (err) {
    console.warn("Clicker hook unavailable", err);
    return;
  }
  hook = setInterval(pollHotkey, 30);
}

export function stopClickerHook() {
  if (hook) clearInterval(hook);
  hook = null;
  finish("");
}
