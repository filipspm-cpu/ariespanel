import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("synvityOverlay", {
  onState: (cb: (payload: unknown) => void) => {
    const listener = (_: unknown, payload: unknown) => cb(payload);
    ipcRenderer.on("overlay:state", listener);
    return () => ipcRenderer.removeListener("overlay:state", listener);
  },
  setIgnore: (ignore: boolean) => ipcRenderer.send("overlay:ignore", ignore),
  saveLayout: (positions: unknown) => ipcRenderer.send("overlay:saveLayout", positions),
});
