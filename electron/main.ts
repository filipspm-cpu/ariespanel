import { app, BrowserWindow, ipcMain, globalShortcut, screen, Tray, Menu, nativeImage, shell } from "electron";
import fs from "fs";
import path from "path";
import { loadState, saveState, AppState } from "./storage";
import { sendTextToWindow, sendTextForeground, pressKey, findGameProcess, listWindows, publicProcess, type ProcessInfo } from "./windows";
import { getSpotifyTrack } from "./spotify";
import { connectDiscord } from "./discord";
import { listDiscordAccounts, recordDiscordAccount } from "./discordAccounts";
import { refreshAccountRoles, setAccountRank } from "./testers";
import { startMacroHook, stopMacroHook, updateMacroTriggers } from "./macroHook";
import { runMacroById, setCountersListener, setOverlayRefresh, triggersFromMacros } from "./runMacro";
import { createFeedback, listFeedback, updateFeedback } from "./feedback";
import {
  claimMoneyTier,
  generatePromoCode,
  getRewardsState,
  listAccountRewards,
  markRewardsPaid,
  redeemPromoCode,
  syncRewardStats,
} from "./rewards";
import { registerUpdater, overlayUpdateNotice } from "./updater";
import { fetchMajesticServerStatuses } from "./majesticStatus";
import { trustPublisherCert } from "./trustPublisher";
import { todayCount } from "./todayStats";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let cmdRunning = false;
let cmdAbort = false;
let overlayFeed: ReturnType<typeof setInterval> | null = null;

function appIcon() {
  const candidates = [
    path.join(process.resourcesPath, "installerIcon.ico"),
    path.join(process.resourcesPath, "aries-logo.png"),
    path.join(__dirname, "..", "build", "installerIcon.ico"),
    path.join(__dirname, "..", "src", "assets", "aries-logo.png"),
    path.join(__dirname, "..", "public", "aries-logo.png"),
    path.join(__dirname, "..", "dist", "aries-logo.png"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const img = nativeImage.createFromPath(file);
      if (!img.isEmpty()) return img;
    }
  }
  return nativeImage.createEmpty();
}

function assertForumUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Nieprawidłowy adres forum.");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "forum.gta5majestic.com") {
    throw new Error("Dozwolone jest tylko forum.gta5majestic.com.");
  }
  if (!parsed.pathname.startsWith("/threads/")) {
    throw new Error("Dozwolone są tylko wątki forum.");
  }
  return parsed.toString();
}

function persistOverlay(patch: Partial<AppState["overlay"]>) {
  const current = loadState();
  const overlay = {
    ...current.overlay,
    ...patch,
    positions: patch.positions
      ? {
          reports: { ...current.overlay.positions.reports, ...patch.positions.reports },
          spotify: { ...current.overlay.positions.spotify, ...patch.positions.spotify },
          clock: { ...current.overlay.positions.clock, ...patch.positions.clock },
          push: { ...current.overlay.positions.push, ...patch.positions.push },
        }
      : current.overlay.positions,
  };
  saveState({ overlay });
  mainWindow?.webContents.send("overlay:layout", overlay);
  return overlay;
}

function rendererUrl(file: "index" | "overlay") {
  if (isDev) {
    const base = process.env.VITE_DEV_SERVER_URL as string;
    return file === "index" ? base : `${base}/overlay.html`;
  }
  return path.join(__dirname, "..", "dist", file === "index" ? "index.html" : "overlay.html");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#09090b",
    icon: appIcon(),
    autoHideMenuBar: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: true,
      v8CacheOptions: "code",
    },
  });

  if (isDev) {
    void mainWindow.loadURL(rendererUrl("index"));
  } else {
    void mainWindow.loadFile(rendererUrl("index"));
  }

  mainWindow.once("ready-to-show", () => {
    const icon = appIcon();
    if (!icon.isEmpty()) mainWindow?.setIcon(icon);
    mainWindow?.show();
  });
  mainWindow.on("hide", () => {
    mainWindow?.webContents.setBackgroundThrottling(true);
    mainWindow?.webContents.setFrameRate(5);
  });
  mainWindow.on("show", () => {
    mainWindow?.webContents.setFrameRate(30);
  });
  mainWindow.on("minimize", () => {
    mainWindow?.webContents.setFrameRate(5);
  });
  mainWindow.on("restore", () => {
    mainWindow?.webContents.setFrameRate(30);
  });
  mainWindow.on("close", (e) => {
    if (!(app as unknown as { isQuiting?: boolean }).isQuiting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function overlayUrl() {
  if (isDev) return `${process.env.VITE_DEV_SERVER_URL}/overlay.html`;
  return path.join(__dirname, "..", "dist", "overlay.html");
}

export function createOverlayWindow(displayId?: number) {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }

  const displays = screen.getAllDisplays();
  const display =
    displays.find((d) => d.id === displayId) ??
    displays.find((d) => d.bounds.x === 0 && d.bounds.y === 0) ??
    screen.getPrimaryDisplay();

  overlayWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    roundedCorners: false,
    thickFrame: false,
    webPreferences: {
      preload: path.join(__dirname, "overlayPreload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
      v8CacheOptions: "code",
      offscreen: false,
    },
  });

  overlayWindow.setBackgroundColor("#00000000");
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.webContents.setFrameRate(12);
  overlayWindow.webContents.on("did-finish-load", () => {
    void overlayWindow?.webContents.insertCSS(
      "html,body,#root{background:transparent!important;background-color:transparent!important;overflow:hidden!important;overscroll-behavior:none;}::-webkit-scrollbar{display:none!important;width:0!important;height:0!important;}",
    );
    void pushOverlayState();
  });

  if (isDev) {
    void overlayWindow.loadURL(overlayUrl());
  } else {
    void overlayWindow.loadFile(overlayUrl());
  }

  overlayWindow.on("closed", () => {
    overlayWindow = null;
    stopOverlayFeed();
  });

  startOverlayFeed();
  return overlayWindow;
}

async function pushOverlayState() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const state = loadState();
  const overlayCounters = state.counters
    .filter((c) => c.showInOverlay)
    .map((c) => ({ id: c.id, name: c.name, value: todayCount(c.history), color: c.color }));
  const ticket = todayCount(state.counters.find((c) => c.id === "ticket")?.history);
  const specs = todayCount(state.counters.find((c) => c.id === "event-specs")?.history);
  const track = state.overlay.showSpotify ? await getSpotifyTrack() : null;
  overlayWindow.webContents.send("overlay:state", {
    overlay: state.overlay,
    overlayCounters,
    ticket,
    specs,
    track,
    notice: overlayUpdateNotice(),
    now: Date.now(),
  });
}

function startOverlayFeed() {
  stopOverlayFeed();
  void pushOverlayState();
  overlayFeed = setInterval(() => {
    void pushOverlayState();
  }, 1000);
}

function stopOverlayFeed() {
  if (overlayFeed) {
    clearInterval(overlayFeed);
    overlayFeed = null;
  }
}

function createTray() {
  const image = appIcon().resize({ width: 16, height: 16 });
  try {
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
  } catch {
    return;
  }
  tray.setToolTip("ARIES");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Pokaż ARIES",
        click: () => {
          if (!mainWindow) createMainWindow();
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: "Nakładka",
        click: () => {
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.close();
            persistOverlay({ enabled: false, editMode: false });
          } else {
            persistOverlay({ enabled: true });
            createOverlayWindow(loadState().overlay.displayId ?? undefined);
          }
        },
      },
      { type: "separator" },
      { label: "Zakończ", click: () => { (app as unknown as { isQuiting: boolean }).isQuiting = true; app.quit(); } },
    ]),
  );
}

function registerIpc() {
  ipcMain.handle("window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("window:maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle("window:close", () => mainWindow?.hide());
  ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);

  ipcMain.handle("state:load", () => {
    const state = loadState();
    if (state.settings.discordId) {
      void recordDiscordAccount({
        id: state.settings.discordId,
        username: state.settings.discordUsername,
        globalName: state.settings.discordGlobalName,
        avatarUrl: state.settings.discordAvatarUrl,
      });
    }
    return state;
  });
  ipcMain.handle("state:save", (_e, partial: Partial<AppState>) => {
    const next = saveState(partial);
    if (partial.macros) {
      updateMacroTriggers(triggersFromMacros(next.macros));
    }
    if (partial.counters) {
      void pushOverlayState();
    }
    if (partial.settings?.discordId) {
      void recordDiscordAccount({
        id: next.settings.discordId,
        username: next.settings.discordUsername,
        globalName: next.settings.discordGlobalName,
        avatarUrl: next.settings.discordAvatarUrl,
      });
    }
    return next;
  });

  ipcMain.handle("process:find", () => publicProcess(findGameProcess()));
  ipcMain.handle("process:list", () => listWindows().map((win) => publicProcess(win)).filter(Boolean));
  ipcMain.handle("spotify:now", () => getSpotifyTrack());
  ipcMain.handle("majestic:servers", (_e, force?: boolean) => fetchMajesticServerStatuses(Boolean(force)));
  ipcMain.handle("discord:connect", async () => {
    const profile = await connectDiscord();
    void recordDiscordAccount(profile, { login: true });
    return profile;
  });
  ipcMain.handle("accounts:list", () => listDiscordAccounts());
  ipcMain.handle("ranks:list", () => refreshAccountRoles());
  ipcMain.handle("ranks:set", (_e, payload: { id?: string; rank?: string; name?: string }) =>
    setAccountRank(String(payload?.id || ""), String(payload?.rank || ""), payload?.name),
  );
  ipcMain.handle("feedback:list", () => {
    const discordId = loadState().settings.discordId || "";
    return listFeedback(discordId);
  });
  ipcMain.handle("feedback:create", (_e, payload: { kind?: string; title?: string; body?: string; channel?: string }) => {
    const settings = loadState().settings;
    return createFeedback({
      discordId: settings.discordId || "",
      name: settings.discordGlobalName || settings.username || "",
      kind: payload?.kind || "bug",
      channel: payload?.channel || "other",
      title: payload?.title || "",
      body: payload?.body || "",
    });
  });
  ipcMain.handle("feedback:update", (_e, payload: { id?: number; status?: string }) => {
    const settings = loadState().settings;
    return updateFeedback({
      discordId: settings.discordId || "",
      id: Number(payload?.id) || 0,
      status: payload?.status || "open",
    });
  });
  ipcMain.handle("forum:open", (_e, url: string) => shell.openExternal(assertForumUrl(url)));
  ipcMain.handle("rewards:state", () => getRewardsState());
  ipcMain.handle("rewards:generate", () => generatePromoCode());
  ipcMain.handle("rewards:redeem", (_e, code: string) => redeemPromoCode(String(code || "")));
  ipcMain.handle(
    "rewards:sync",
    (
      _e,
      payload: { reports?: number; events?: number; onlineMs?: number; nightReports?: number; activeDays?: number },
    ) =>
      syncRewardStats({
        reports: Number(payload?.reports) || 0,
        events: Number(payload?.events) || 0,
        onlineMs: Number(payload?.onlineMs) || 0,
        nightReports: Number(payload?.nightReports) || 0,
        activeDays: Number(payload?.activeDays) || 0,
      }),
  );
  ipcMain.handle("rewards:claim", (_e, kind: string) => claimMoneyTier(String(kind || "")));
  ipcMain.handle("rewards:accounts", () => listAccountRewards());
  ipcMain.handle("rewards:paid", (_e, targetId: string) => markRewardsPaid(String(targetId || "")));

  ipcMain.handle("displays:list", () =>
    screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: d.label || `Monitor ${i + 1}`,
      bounds: d.bounds,
      primary: d.id === screen.getPrimaryDisplay().id,
    })),
  );

  ipcMain.handle("overlay:open", (_e, payload: { displayId?: number }) => {
    persistOverlay({ enabled: true, displayId: payload?.displayId ?? loadState().overlay.displayId });
    const win = createOverlayWindow(payload?.displayId ?? loadState().overlay.displayId ?? undefined);
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setFocusable(false);
    return true;
  });

  ipcMain.handle("overlay:close", () => {
    persistOverlay({ enabled: false, editMode: false });
    overlayWindow?.close();
    overlayWindow = null;
    stopOverlayFeed();
    return true;
  });

  ipcMain.handle("overlay:editMode", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return false;
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.setFocusable(false);
    return true;
  });

  ipcMain.on("overlay:ignore", (_e, ignore: boolean) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });

  ipcMain.handle("overlay:isOpen", () => Boolean(overlayWindow && !overlayWindow.isDestroyed()));

  ipcMain.handle("overlay:push", (_e, payload: unknown) => {
    overlayWindow?.webContents.send("overlay:state", payload);
    return true;
  });

  ipcMain.on("overlay:saveLayout", (_e, positions: AppState["overlay"]["positions"]) => {
    persistOverlay({ positions });
  });

  ipcMain.handle(
    "cmd:run",
    async (
      _e,
      payload: {
        commands: string[];
        intervalMs: number;
        pressT: boolean;
        reverse: boolean;
        pressEnter: boolean;
      },
    ) => {
      if (cmdRunning) return { ok: false, error: "already-running" };
      cmdRunning = true;
      cmdAbort = false;
      try {
        let commands = payload.commands.map((c) => c.trim()).filter(Boolean);
        if (payload.reverse) commands = [...commands].reverse();
        const interval = Math.max(100, payload.intervalMs || 500);
        let lastTarget: ProcessInfo | null = findGameProcess();
        if (!lastTarget) {
          mainWindow?.webContents.send("cmd:done", { aborted: false });
          return { ok: false, error: "no-game", target: null };
        }

        for (const command of commands) {
          if (cmdAbort) break;
          const processInfo: ProcessInfo = findGameProcess() ?? lastTarget;
          lastTarget = processInfo;
          mainWindow?.webContents.send("cmd:progress", { command });
          if (payload.pressT) {
            pressKey(processInfo.hwnd, "T");
            await sleep(220);
          }
          await sendTextToWindow(processInfo.hwnd, command, payload.pressEnter);
          await sleep(interval);
        }

        const aborted = cmdAbort;
        mainWindow?.webContents.send("cmd:done", { aborted });
        return { ok: true, aborted, target: publicProcess(lastTarget) };
      } catch (err) {
        mainWindow?.webContents.send("cmd:done", { aborted: true });
        return { ok: false, error: err instanceof Error ? err.message : "cmd-failed" };
      } finally {
        cmdRunning = false;
      }
    },
  );

  ipcMain.handle("cmd:stop", () => {
    cmdAbort = true;
    return true;
  });

  ipcMain.handle(
    "macro:send",
    async (
      _e,
      text: string,
      pressEnter: boolean,
      extra?: { pressT?: boolean; enterEachLine?: boolean; skipFirstT?: boolean },
    ) => {
      await sendTextForeground(text, {
        pressEnter,
        pressT: Boolean(extra?.pressT),
        enterEachLine: Boolean(extra?.enterEachLine),
        skipFirstT: Boolean(extra?.skipFirstT),
      });
      return true;
    },
  );

  ipcMain.handle("macro:press", (_e, key: string) => {
    const processInfo = findGameProcess();
    pressKey(processInfo?.hwnd ?? null, key);
    return true;
  });

  ipcMain.handle("macro:registerTriggers", (_e, triggers: { id: string; sequence: string }[]) => {
    updateMacroTriggers(triggers);
    return true;
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function registerShortcuts() {
  globalShortcut.register("CommandOrControl+K", () => {
    mainWindow?.webContents.send("ui:commandPalette");
  });
}

app.commandLine.appendSwitch("enable-transparent-visuals");
app.commandLine.appendSwitch("disable-features", [
  "MediaRouter",
  "DialMediaRouteProvider",
  "HardwareMediaKeyHandling",
  "TranslateUI",
  "AutofillServerCommunication",
  "OptimizationHints",
  "InterestFeedContentSuggestions",
  "CalculateNativeWinOcclusion",
].join(","));
app.commandLine.appendSwitch("disable-component-update");
app.commandLine.appendSwitch("disable-smooth-scrolling");
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=192");
app.setAppUserModelId("com.aries.app");

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) createMainWindow();
    mainWindow?.show();
    mainWindow?.focus();
  });
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;
  trustPublisherCert();
  await refreshAccountRoles();
  registerIpc();
  setOverlayRefresh(() => {
    void pushOverlayState();
  });
  setCountersListener((counters) => {
    mainWindow?.webContents.send("counters:changed", counters);
  });
  createMainWindow();
  createTray();
  registerUpdater({
    getWindow: () => mainWindow,
    getTray: () => tray,
    getIcon: () => appIcon(),
  });
  registerShortcuts();
  const saved = loadState();
  if (saved.overlay.enabled) {
    persistOverlay({ editMode: false });
    createOverlayWindow(saved.overlay.displayId ?? undefined);
  }
    try {
      const savedMacros = loadState().macros;
      updateMacroTriggers(triggersFromMacros(savedMacros));
      startMacroHook((macroId, eraseCount) => {
        void runMacroById(macroId, eraseCount).then(() => {
          mainWindow?.webContents.send("macro:fired", { id: macroId });
        });
      });
    } catch (err) {
      console.warn("Macro hook failed", err);
    }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    /* keep tray; do not quit */
  }
});

app.on("before-quit", () => {
  stopMacroHook();
  globalShortcut.unregisterAll();
});
