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
  macroSend: (text: string, pressEnter: boolean) => ipcRenderer.invoke("macro:send", text, pressEnter),
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
  appVersion: () => ipcRenderer.invoke("app:version") as Promise<string>,
  updateStatus: () => ipcRenderer.invoke("update:status"),
  updateCheck: () => ipcRenderer.invoke("update:check"),
  updateInstall: () => ipcRenderer.invoke("update:install"),
  onUpdateStatus: (cb: (status: unknown) => void) => {
    const listener = (_: unknown, status: unknown) => cb(status);
    ipcRenderer.on("update:status", listener);
    return () => ipcRenderer.removeListener("update:status", listener);
  },
};

contextBridge.exposeInMainWorld("synvity", api);

export type SynvityApi = typeof api;
