import type { OverlaySettings, UpdateNotice, UpdateStatus } from "./index";

export type PanelLogEntry = {
  id: number;
  at: number;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
  detail?: string;
  open?: boolean;
};

export interface FeedbackApiItem {
  id: number;
  discordId: string;
  name: string;
  kind: "bug" | "suggestion";
  status: "open" | "done" | "deleted";
  channel: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface FeedbackApiResult {
  ok: boolean;
  developer: boolean;
  items: FeedbackApiItem[];
  error?: string;
  created?: boolean;
}

export interface ForumAskResult {
  ok: boolean;
  answer: string;
  source?: string;
  error?: string;
}

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
  clickerSet: (payload: { enabled: boolean; intervalMs: number; button?: string }) => Promise<{
    ok: boolean;
    running: boolean;
    armed: boolean;
    intervalMs: number;
    platform: string;
    phase: "off" | "armed" | "clicking";
  }>;
  onClickerStatus: (cb: (payload: { phase: "off" | "armed" | "clicking" }) => void) => () => void;
  macroSend: (
    text: string,
    pressEnter: boolean,
    extra?: { pressT?: boolean; enterEachLine?: boolean; skipFirstT?: boolean },
  ) => Promise<unknown>;
  macroPress: (key: string) => Promise<unknown>;
  registerTriggers: (triggers: { id: string; sequence: string }[]) => Promise<unknown>;
  onCmdProgress: (cb: (data: { command: string }) => void) => () => void;
  onCmdDone: (cb: (data: { aborted: boolean }) => void) => () => void;
  onCommandPalette: (cb: () => void) => () => void;
  onOpenSettings: (cb: () => void) => () => void;
  onToggleConsole: (cb: (open?: boolean) => void) => () => void;
  onConsoleEntry: (cb: (entry: PanelLogEntry) => void) => () => void;
  consoleHistory: () => Promise<PanelLogEntry[]>;
  onMacroFired: (cb: (data: { id: string }) => void) => () => void;
  onCountersChanged: (cb: (counters: import("./index").Counter[]) => void) => () => void;
  feedbackList: () => Promise<FeedbackApiResult>;
  feedbackCreate: (payload: { kind: string; title: string; body: string; channel: string }) => Promise<FeedbackApiResult>;
  feedbackUpdate: (payload: { id: number; status: string }) => Promise<FeedbackApiResult>;
  appVersion: () => Promise<string>;
  updateStatus: () => Promise<UpdateStatus>;
  updateCheck: () => Promise<UpdateStatus>;
  updateInstall: () => Promise<unknown>;
  updateOpenSetup: (version?: string) => Promise<unknown>;
  onUpdateStatus: (cb: (status: UpdateStatus) => void) => () => void;
  updateNotices: () => Promise<UpdateNotice[]>;
  updateNoticesRead: () => Promise<UpdateNotice[]>;
  majesticServers: (force?: boolean) => Promise<import("./index").LiveServerStatus[]>;
  forumOpen: (url: string) => Promise<unknown>;
  profileSaveName: (name: string) => Promise<{ ok: boolean; name: string; error?: string }>;
  forumAsk: (payload: {
    question: string;
    passages: {
      ruleId?: string;
      ruleTitle?: string;
      point?: string | null;
      section?: string | null;
      excerpt?: string;
      penalty?: string | null;
    }[];
  }) => Promise<ForumAskResult>;
  openPrivacy: () => Promise<unknown>;
  discordConnect: () => Promise<{
    id: string;
    username: string;
    globalName: string;
    discriminator: string;
    avatar: string | null;
    avatarUrl: string;
  }>;
  accountsList: () => Promise<{ id?: string; name: string; avatarUrl: string; ip?: string; lastLogin?: string; rank?: string; banned?: boolean }[]>;
  accountsSetBan: (payload: { id: string; banned: boolean; name?: string }) => Promise<
    { id?: string; name: string; avatarUrl: string; ip?: string; lastLogin?: string; rank?: string; banned?: boolean }[]
  >;
  accountsBanStatus: () => Promise<boolean>;
  onAccountBanned: (cb: (payload: { banned: boolean }) => void) => () => void;
  ranksList: () => Promise<{ name: string; discord: string; id: string; role: string }[]>;
  ranksSet: (payload: { id: string; rank: string; name?: string }) => Promise<{ name: string; discord: string; id: string; role: string }[]>;
  noticesList: () => Promise<{
    ok: boolean;
    editor: boolean;
    popup: boolean;
    notices: import("./notices").PanelNotice[];
  }>;
  noticesCreate: (payload: { kind: string; title: string; body: string }) => Promise<{
    ok: boolean;
    editor: boolean;
    popup: boolean;
    notices: import("./notices").PanelNotice[];
    error?: string;
  }>;
  noticesDelete: (payload: { id: number; title?: string }) => Promise<{
    ok: boolean;
    editor: boolean;
    popup: boolean;
    notices: import("./notices").PanelNotice[];
    error?: string;
  }>;
  noticesSetPopup: (enabled: boolean) => Promise<{
    ok: boolean;
    editor: boolean;
    popup: boolean;
    notices: import("./notices").PanelNotice[];
    error?: string;
  }>;
  factionsList: () => Promise<{
    ok: boolean;
    editor: boolean;
    factions: { id: string; leader: string; frozen: boolean; updatedAt?: string }[];
    error?: string;
  }>;
  factionsSave: (payload: { id: string; leader: string; frozen: boolean }) => Promise<{
    ok: boolean;
    editor: boolean;
    factions: { id: string; leader: string; frozen: boolean; updatedAt?: string }[];
    error?: string;
  }>;
  rewardsState: () => Promise<import("./rewards").RewardsState>;
  rewardsGenerate: () => Promise<import("./rewards").RewardsState>;
  rewardsRedeem: (code: string) => Promise<import("./rewards").RewardsState>;
  rewardsSync: (payload: {
    reports: number;
    events: number;
    onlineMs: number;
    nightReports: number;
    activeDays: number;
  }) => Promise<import("./rewards").RewardsState>;
  rewardsClaim: (kind: string) => Promise<import("./rewards").RewardsState>;
  rewardsAccounts: () => Promise<import("./rewards").AccountRewards[]>;
  rewardsPaid: (targetId: string) => Promise<import("./rewards").AccountRewards[]>;
  rewardsDefine: (payload: import("./rewards").CustomAchievementInput) => Promise<import("./rewards").RewardsState>;
  rewardsUndefine: (id: string) => Promise<import("./rewards").RewardsState>;
  rewardsGrant: (id: string) => Promise<import("./rewards").RewardsState>;
};

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
