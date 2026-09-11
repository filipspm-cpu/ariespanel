import { app, ipcMain, BrowserWindow, Tray, Notification, nativeImage, shell } from "electron";
import { autoUpdater, type UpdateInfo, type ProgressInfo } from "electron-updater";
import { loadState } from "./storage";
import { isBetaTesterId } from "./testers";
import { closeUpdateProgressWindow, openUpdateProgressWindow, setUpdateProgress } from "./updateProgress";
import { listUpdateNotices, markUpdateNoticesRead, pushUpdateNotice } from "./updateNotices";

export const GITHUB_OWNER = "filipspm-cpu";
export const GITHUB_REPO = "ariespanel";

export type UpdateStatus = {
  status: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  version?: string;
  currentVersion: string;
  percent?: number;
  transferred?: number;
  total?: number;
  detail?: string;
  left?: string;
  message?: string;
  channel?: "stable" | "beta";
};

let last: UpdateStatus = { status: "idle", currentVersion: "0.0.0" };
let checking = false;
let applying = false;
let notifiedVersion = "";
let getWindow: () => BrowserWindow | null = () => null;
let getTray: () => Tray | null = () => null;
let getIcon: () => Electron.NativeImage = () => nativeImage.createEmpty();

function send(patch: Partial<UpdateStatus>) {
  last = {
    ...last,
    ...patch,
    currentVersion: app.getVersion(),
    channel: isBetaUser() ? "beta" : "stable",
  };
  getWindow()?.webContents.send("update:status", last);
}

function isRetiredLine(version: string | undefined) {
  return /^1\.1\.\d+/.test(String(version || "").replace(/^v/i, ""));
}

function setupUrl(version?: string) {
  const ver = String(version || "").replace(/^v/i, "");
  if (ver) return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/v${ver}/ARIES-Setup-${ver}.exe`;
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
}

function openSetup(version?: string) {
  void shell.openExternal(setupUrl(version || last.version));
}

function isBetaUser() {
  return isBetaTesterId(loadState().settings.discordId);
}

function applyFeed() {
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.channel = "latest";
  autoUpdater.requestHeaders = { "User-Agent": "ARIES-Updater" };
  const nsis = autoUpdater as typeof autoUpdater & {
    verifyUpdateCodeSignature?: (publisherNames: string[], path: string) => Promise<string | null>;
  };
  nsis.verifyUpdateCodeSignature = async () => null;
  autoUpdater.setFeedURL({
    provider: "github",
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  });
}

function friendlyUpdateError(err: unknown) {
  const raw = err instanceof Error ? err.message : String(err);
  if (/404|Not Found|authentication token/i.test(raw)) {
    return "Nie znaleziono aktualizacji. Gdy wyjdzie nowa wersja, pojawi się tutaj.";
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::|network/i.test(raw)) {
    return "Brak połączenia z internetem. Spróbuj ponownie za chwilę.";
  }
  if (raw.length > 160) return "Nie udało się sprawdzić aktualizacji.";
  return raw;
}

function formatBytes(n: number) {
  if (!n || n < 0) return "0 MB";
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatLeft(bytesPerSecond: number, transferred: number, total: number) {
  if (!bytesPerSecond || !total || transferred >= total) return "Zaraz koniec…";
  const sec = Math.max(1, Math.round((total - transferred) / bytesPerSecond));
  if (sec < 60) return `Zostało ok. ${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `Zostało ok. ${m} min ${s} s`;
}

function hidePanel() {
  getWindow()?.hide();
}

function showPanel() {
  const win = getWindow();
  if (!win) return;
  win.show();
  win.focus();
}

function notifyAvailable(version: string) {
  pushUpdateNotice(app.getVersion(), { version, at: Date.now(), kind: "available" });
  if (notifiedVersion === version) return;
  notifiedVersion = version;
  const body = `Dostępna aktualizacja ${version}. Wejdź w Ustawienia i kliknij Zaktualizuj.`;
  try {
    if (Notification.isSupported()) {
      const note = new Notification({
        title: "ARIES",
        body,
        icon: getIcon(),
      });
      note.on("click", () => {
        const win = getWindow();
        if (!win) return;
        win.show();
        win.focus();
        win.webContents.send("ui:openSettings");
      });
      note.show();
    }
  } catch {
    /* ignore */
  }
  try {
    getTray()?.displayBalloon({
      title: "ARIES",
      content: body,
      icon: getIcon(),
    });
  } catch {
    /* ignore */
  }
}

async function checkNow(fromUser: boolean) {
  if (!app.isPackaged) {
    if (fromUser) {
      send({
        status: "error",
        message: "W trybie deweloperskim aktualizacje nie są pobierane. Użyj zainstalowanego ARIES.exe.",
      });
    }
    return last;
  }
  if (checking || applying) return last;
  if (last.status === "available" || last.status === "downloading" || last.status === "downloaded") {
    if (!fromUser) return last;
  }
  checking = true;
  applyFeed();
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    send({ status: "error", message: friendlyUpdateError(err) });
  } finally {
    checking = false;
  }
  return last;
}

async function applyUpdate() {
  if (!app.isPackaged) {
    send({ status: "error", message: "Aktualizacja działa po instalacji ARIES, nie w trybie deweloperskim." });
    return last;
  }
  if (applying) return last;
  if (isRetiredLine(last.version)) {
    send({ status: "not-available", version: undefined, message: undefined });
    return last;
  }
  if (last.status !== "available" && last.status !== "downloaded") {
    await checkNow(true);
  }
  if (last.status === "downloaded") {
    hidePanel();
    openUpdateProgressWindow(last.version || "", getIcon());
    finishInstall();
    return last;
  }
  applying = true;
  hidePanel();
  openUpdateProgressWindow(last.version || "", getIcon());
  setUpdateProgress({
    percent: 0,
    detail: "Start pobierania…",
    left: "Szacowanie czasu…",
    sub: `v${last.version || ""}`,
  });
  applyFeed();
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    applying = false;
    closeUpdateProgressWindow();
    showPanel();
    send({ status: "error", message: friendlyUpdateError(err) });
    openSetup(last.version);
  }
  return last;
}

function finishInstall() {
  (app as unknown as { isQuiting: boolean }).isQuiting = true;
  setUpdateProgress({
    percent: 100,
    detail: "Instalowanie…",
    left: "Aplikacja uruchomi się ponownie",
    sub: `v${last.version || ""}`,
  });
  setTimeout(() => {
    closeUpdateProgressWindow();
    autoUpdater.quitAndInstall(true, true);
  }, 600);
}

export function registerUpdater(opts: {
  getWindow: () => BrowserWindow | null;
  getTray: () => Tray | null;
  getIcon: () => Electron.NativeImage;
}) {
  getWindow = opts.getWindow;
  getTray = opts.getTray;
  getIcon = opts.getIcon;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.autoRunAppAfterInstall = true;
  applyFeed();
  last = { status: "idle", currentVersion: app.getVersion() };
  listUpdateNotices(app.getVersion());
  try {
    const nsis = autoUpdater as typeof autoUpdater & {
      verifyUpdateCodeSignature?: (publisherNames: string[], path: string) => Promise<string | null>;
    };
    nsis.verifyUpdateCodeSignature = async () => null;
  } catch {
    /* unsigned */
  }

  autoUpdater.on("checking-for-update", () => {
    if (!applying) send({ status: "checking" });
  });
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    if (isRetiredLine(info.version)) {
      send({ status: "not-available", version: undefined, message: undefined });
      return;
    }
    send({ status: "available", version: info.version, message: undefined });
    notifyAvailable(info.version);
  });
  autoUpdater.on("update-not-available", () => {
    if (!applying) send({ status: "not-available", version: undefined, message: undefined });
  });
  autoUpdater.on("download-progress", (p: ProgressInfo) => {
    send({
      status: "downloading",
      percent: p.percent,
      version: last.version,
      transferred: p.transferred,
      total: p.total,
      detail: `${formatBytes(p.transferred)} / ${formatBytes(p.total)}`,
      left: formatLeft(p.bytesPerSecond, p.transferred, p.total),
    });
    setUpdateProgress({
      percent: p.percent,
      detail: `${formatBytes(p.transferred)} / ${formatBytes(p.total)}`,
      left: formatLeft(p.bytesPerSecond, p.transferred, p.total),
      sub: `v${last.version || ""}`,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    send({ status: "downloaded", version: info.version, percent: 100 });
    finishInstall();
  });
  autoUpdater.on("error", (err) => {
    const wasApplying = applying;
    applying = false;
    closeUpdateProgressWindow();
    showPanel();
    send({ status: "error", message: friendlyUpdateError(err) });
    if (wasApplying) openSetup(last.version);
  });

  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("update:status", () => ({ ...last, currentVersion: app.getVersion() }));
  ipcMain.handle("update:check", () => checkNow(true));
  ipcMain.handle("update:install", () => applyUpdate());
  ipcMain.handle("update:openSetup", (_e, version?: string) => {
    openSetup(typeof version === "string" ? version : last.version);
    return true;
  });
  ipcMain.handle("update:notices", () => listUpdateNotices(app.getVersion()));
  ipcMain.handle("update:noticesRead", () => markUpdateNoticesRead(app.getVersion()));

  setTimeout(() => {
    if (loadState().settings.autoUpdate === false) return;
    void checkNow(false);
  }, 8000);
  setInterval(() => {
    if (loadState().settings.autoUpdate === false) return;
    void checkNow(false);
  }, 4 * 60 * 60 * 1000);
}

export function checkUpdatesOnOpen() {
  /* polling in registerUpdater */
}
