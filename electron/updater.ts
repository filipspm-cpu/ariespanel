import { app, ipcMain, BrowserWindow } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";
import { loadState } from "./storage";

export const GITHUB_OWNER = "filipspm-cpu";
export const GITHUB_REPO = "ariespanel";

export type UpdateStatus = {
  status: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  version?: string;
  currentVersion: string;
  percent?: number;
  message?: string;
};

let last: UpdateStatus = { status: "idle", currentVersion: "0.0.0" };
let checking = false;
let didLaunchCheck = false;
let lastAutoCheckAt = 0;

function send(win: BrowserWindow | null, patch: Partial<UpdateStatus>) {
  last = { ...last, ...patch, currentVersion: app.getVersion() };
  win?.webContents.send("update:status", last);
}

function applyFeed() {
  const s = loadState().settings;
  const owner = s.githubOwner?.trim() || GITHUB_OWNER;
  const repo = s.githubRepo?.trim() || GITHUB_REPO;
  const token = s.githubToken?.trim();
  autoUpdater.setFeedURL({
    provider: "github",
    owner,
    repo,
    private: true,
    token: token || undefined,
  });
}

async function checkNow(win: BrowserWindow | null, fromUser: boolean) {
  if (!app.isPackaged) {
    if (fromUser) {
      send(win, {
        status: "error",
        message: "Aktualizacje działają w zainstalowanej aplikacji (ARIES-Setup), nie w trybie deweloperskim.",
      });
    }
    return last;
  }
  if (checking) return last;
  checking = true;
  applyFeed();
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    send(win, { status: "error", message: err instanceof Error ? err.message : String(err) });
  } finally {
    checking = false;
  }
  return last;
}

export function registerUpdater(getWindow: () => BrowserWindow | null) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;
  autoUpdater.autoRunAppAfterInstall = true;
  last = { status: "idle", currentVersion: app.getVersion() };
  try {
    (autoUpdater as unknown as { verifyUpdateCodeSignature?: boolean }).verifyUpdateCodeSignature = false;
  } catch {
    /* unsigned local builds */
  }

  autoUpdater.on("checking-for-update", () => send(getWindow(), { status: "checking" }));
  autoUpdater.on("update-available", (info: UpdateInfo) =>
    send(getWindow(), { status: "available", version: info.version, message: undefined }),
  );
  autoUpdater.on("update-not-available", () =>
    send(getWindow(), { status: "not-available", version: undefined, message: undefined }),
  );
  autoUpdater.on("download-progress", (p) =>
    send(getWindow(), { status: "downloading", percent: p.percent }),
  );
  autoUpdater.on("update-downloaded", (info) =>
    send(getWindow(), { status: "downloaded", version: info.version, percent: 100 }),
  );
  autoUpdater.on("error", (err) =>
    send(getWindow(), { status: "error", message: err instanceof Error ? err.message : String(err) }),
  );

  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("update:status", () => ({ ...last, currentVersion: app.getVersion() }));
  ipcMain.handle("update:check", () => checkNow(getWindow(), true));
  ipcMain.handle("update:install", () => {
    (app as unknown as { isQuiting: boolean }).isQuiting = true;
    autoUpdater.quitAndInstall(false, true);
  });
}

export function checkUpdatesOnOpen(getWindow: () => BrowserWindow | null) {
  if (!app.isPackaged || loadState().settings.autoUpdate === false) return;
  const now = Date.now();
  if (didLaunchCheck && now - lastAutoCheckAt < 10 * 60 * 1000) return;
  didLaunchCheck = true;
  lastAutoCheckAt = now;
  void checkNow(getWindow(), false);
}
