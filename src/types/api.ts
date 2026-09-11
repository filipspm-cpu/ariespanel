import type { OverlaySettings, UpdateNotice, UpdateStatus } from "./index";

export interface SynvityApi {
  minimize: () => Promise<unknown>;
  maximize: () => Promise<unknown>;
  close: () => Promise<unknown>;
  isMaximized: () => Promise<boolean>;
  loadState: () => Promise<unknown>;
  saveState: (partial: unknown) => Promise<unknown>;
  findProcess: () => Promise<{ pid: number; title: string; name: string } | null>;
  listWindows: () => Promise<unknown>;
  spotifyNow: () => Promise<import("./index").SpotifyTrack | null>;
  listDisplays: () => Promise<
    { id: number; label: string; bounds: { x: number; y: number; width: number; height: number }; primary: boolean }[]
  >;
  overlayOpen: (payload?: { displayId?: number; editMode?: boolean }) => Promise<unknown>;
  overlayClose: () => Promise<unknown>;
  overlayEditMode: (enabled: boolean) => Promise<unknown>;
  overlayIsOpen: () => Promise<boolean>;
  overlayPush: (payload: unknown) => Promise<unknown>;
  onOverlayLayout: (cb: (overlay: OverlaySettings) => void) => () => void;
  cmdRun: (payload: {
    commands: string[];
    intervalMs: number;
    pressT: boolean;
    reverse: boolean;
    pressEnter: boolean;
  }) => Promise<unknown>;
  cmdStop: () => Promise<unknown>;
  macroSend: (
    text: string,
    pressEnter: boolean,
    extra?: { pressT?: boolean; enterEachLine?: boolean },
  ) => Promise<unknown>;
  macroPress: (key: string) => Promise<unknown>;
  registerTriggers: (triggers: { id: string; sequence: string }[]) => Promise<unknown>;
  onCmdProgress: (cb: (data: { command: string }) => void) => () => void;
  onCmdDone: (cb: (data: { aborted: boolean }) => void) => () => void;
  onCommandPalette: (cb: () => void) => () => void;
  onOpenSettings: (cb: () => void) => () => void;
  onMacroFired: (cb: (data: { id: string }) => void) => () => void;
  appVersion: () => Promise<string>;
  updateStatus: () => Promise<UpdateStatus>;
  updateCheck: () => Promise<UpdateStatus>;
  updateInstall: () => Promise<unknown>;
  updateOpenSetup: (version?: string) => Promise<unknown>;
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void;
  updateNotices: () => Promise<UpdateNotice[]>;
  updateNoticesRead: () => Promise<UpdateNotice[]>;
  majesticServers: () => Promise<import("./index").LiveServerStatus[]>;
  forumOpen: (url: string) => Promise<unknown>;
  discordConnect: () => Promise<{
    id: string;
    username: string;
    globalName: string;
    discriminator: string;
    avatar: string | null;
    avatarUrl: string;
  }>;
}

export {};

declare global {
  interface Window {
    synvity?: SynvityApi;
    synvityOverlay?: {
      onState: (cb: (payload: unknown) => void) => () => void;
      setIgnore: (ignore: boolean) => void;
      saveLayout: (positions: OverlaySettings["positions"]) => void;
    };
  }
}
