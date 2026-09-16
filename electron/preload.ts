import { contextBridge, ipcRenderer } from "electron";

const api = {
  minimize: () => ipcRenderer.invoke("window:minimize"),
  maximize: () => ipcRenderer.invoke("window:maximize"),
  close: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized") as Promise<boolean>,
  loadState: () => ipcRenderer.invoke("state:load"),
  saveState: (partial: unknown) => ipcRenderer.invoke("state:save", partial),
  findProcess: () => ipcRenderer.invoke("process:find"),
  listWindows: () => ipcRenderer.invoke("process:list"),
  spotifyNow: () => ipcRenderer.invoke("spotify:now"),
  listDisplays: () => ipcRenderer.invoke("displays:list"),
  overlayOpen: (payload?: { displayId?: number; editMode?: boolean }) =>
    ipcRenderer.invoke("overlay:open", payload ?? {}),
  overlayClose: () => ipcRenderer.invoke("overlay:close"),
  overlayEditMode: (enabled: boolean) => ipcRenderer.invoke("overlay:editMode", enabled),
  overlayIsOpen: () => ipcRenderer.invoke("overlay:isOpen") as Promise<boolean>,
  overlayPush: (payload: unknown) => ipcRenderer.invoke("overlay:push", payload),
  onOverlayLayout: (cb: (overlay: unknown) => void) => {
    const listener = (_: unknown, overlay: unknown) => cb(overlay);
    ipcRenderer.on("overlay:layout", listener);
    return () => ipcRenderer.removeListener("overlay:layout", listener);
  },
  cmdRun: (payload: {
    commands: string[];
    intervalMs: number;
    pressT: boolean;
    reverse: boolean;
    pressEnter: boolean;
  }) => ipcRenderer.invoke("cmd:run", payload),
  cmdStop: () => ipcRenderer.invoke("cmd:stop"),
  macroSend: (
    text: string,
    pressEnter: boolean,
    extra?: { pressT?: boolean; enterEachLine?: boolean },
  ) => ipcRenderer.invoke("macro:send", text, pressEnter, extra),
  macroPress: (key: string) => ipcRenderer.invoke("macro:press", key),
  registerTriggers: (triggers: { id: string; sequence: string }[]) =>
    ipcRenderer.invoke("macro:registerTriggers", triggers),
  onCmdProgress: (cb: (data: { command: string }) => void) => {
    const listener = (_: unknown, data: { command: string }) => cb(data);
    ipcRenderer.on("cmd:progress", listener);
    return () => ipcRenderer.removeListener("cmd:progress", listener);
  },
  onCmdDone: (cb: (data: { aborted: boolean }) => void) => {
    const listener = (_: unknown, data: { aborted: boolean }) => cb(data);
    ipcRenderer.on("cmd:done", listener);
    return () => ipcRenderer.removeListener("cmd:done", listener);
  },
  onCommandPalette: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("ui:commandPalette", listener);
    return () => ipcRenderer.removeListener("ui:commandPalette", listener);
  },
  onOpenSettings: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("ui:openSettings", listener);
    return () => ipcRenderer.removeListener("ui:openSettings", listener);
  },
  onMacroFired: (cb: (data: { id: string }) => void) => {
    const listener = (_: unknown, data: { id: string }) => cb(data);
    ipcRenderer.on("macro:fired", listener);
    return () => ipcRenderer.removeListener("macro:fired", listener);
  },
  onCountersChanged: (cb: (counters: unknown) => void) => {
    const listener = (_: unknown, counters: unknown) => cb(counters);
    ipcRenderer.on("counters:changed", listener);
    return () => ipcRenderer.removeListener("counters:changed", listener);
  },
  feedbackList: () => ipcRenderer.invoke("feedback:list"),
  feedbackCreate: (payload: { kind: string; title: string; body: string; channel: string }) =>
    ipcRenderer.invoke("feedback:create", payload),
  feedbackUpdate: (payload: { id: number; status: string }) => ipcRenderer.invoke("feedback:update", payload),
  appVersion: () => ipcRenderer.invoke("app:version") as Promise<string>,
  updateStatus: () => ipcRenderer.invoke("update:status"),
  updateCheck: () => ipcRenderer.invoke("update:check"),
  updateInstall: () => ipcRenderer.invoke("update:install"),
  updateOpenSetup: (version?: string) => ipcRenderer.invoke("update:openSetup", version),
  updateNotices: () => ipcRenderer.invoke("update:notices") as Promise<
    { id: string; version: string; at: number; kind: "available" | "installed"; read: boolean }[]
  >,
  updateNoticesRead: () => ipcRenderer.invoke("update:noticesRead"),
  onUpdateStatus: (cb: (status: unknown) => void) => {
    const listener = (_: unknown, status: unknown) => cb(status);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
  majesticServers: (force?: boolean) => ipcRenderer.invoke("majestic:servers", Boolean(force)),
  discordConnect: () => ipcRenderer.invoke("discord:connect"),
  accountsList: () =>
    ipcRenderer.invoke("accounts:list") as Promise<
      { id?: string; name: string; avatarUrl: string; ip?: string; lastLogin?: string; rank?: string }[]
    >,
  ranksList: () => ipcRenderer.invoke("ranks:list"),
  ranksSet: (payload: { id: string; rank: string; name?: string }) => ipcRenderer.invoke("ranks:set", payload),
  forumOpen: (url: string) => ipcRenderer.invoke("forum:open", url),
};

contextBridge.exposeInMainWorld("synvity", api);

export type SynvityApi = typeof api;
