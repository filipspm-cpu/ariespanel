export type RouteId =
  | "home"
  | "cmd"
  | "overlay"
  | "macros"
  | "counters"
  | "forum"
  | "settings"
  | "about"
  | "credits";

export interface NavItem {
  id: RouteId;
  label: string;
  icon: string;
  badge?: string;
  forumRuleId?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: (NavItem & { children?: NavItem[] })[];
}

export type MacroStepType =
  | "insert-text"
  | "multiline-text"
  | "key-press"
  | "wait"
  | "call-function"
  | "if"
  | "if-else"
  | "random"
  | "counter";

export interface MacroTrigger {
  prefix: string;
  command: string;
}

export interface MacroStep {
  id: string;
  type: MacroStepType;
  text: string;
  pressEnter: boolean;
  enterEachLine?: boolean;
  pressT?: boolean;
  waitMs?: number;
  key?: string;
  condition?: string;
  counterId?: string;
  children?: MacroStep[];
  elseChildren?: MacroStep[];
}

export interface Macro {
  id: string;
  name: string;
  folderId: string | null;
  trigger: string;
  triggers: MacroTrigger[];
  random: boolean;
  enabled: boolean;
  steps: MacroStep[];
}

export interface MacroFolder {
  id: string;
  name: string;
}

export type CounterColor = "purple" | "green" | "blue" | "orange" | "red";

export interface Counter {
  id: string;
  name: string;
  description: string;
  value: number;
  color: CounterColor;
  shortcut: string;
  showInOverlay: boolean;
  history: { timestamp: number; delta: number }[];
}

export interface OverlayCounterItem {
  id: string;
  name: string;
  value: number;
  color: CounterColor;
}

export interface OverlayHudLayout {
  showReports: boolean;
  showSpotify: boolean;
  showClock: boolean;
  showRadial: boolean;
  showPush: boolean;
  positions: {
    reports: { x: number; y: number; scale: number };
    spotify: { x: number; y: number; scale: number };
    clock: { x: number; y: number; scale: number };
  };
}

export interface OverlaySettings extends OverlayHudLayout {
  displayId: number | null;
  enabled: boolean;
  editMode: boolean;
  previousLayout: OverlayHudLayout | null;
}

export interface CmdSettings {
  pressT: boolean;
  reverse: boolean;
  pressEnter: boolean;
  intervalMs: number;
}

export interface AppSettings {
  language: "pl";
  username: string;
  theme: "dark";
  githubOwner: string;
  githubRepo: string;
  githubToken: string;
  autoUpdate: boolean;
  discordId?: string;
  discordUsername?: string;
  discordGlobalName?: string;
  discordAvatar?: string | null;
  discordAvatarUrl?: string;
}

export interface UpdateStatus {
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
}

export interface UpdateNotice {
  id: string;
  version: string;
  at: number;
  kind: "available" | "installed";
  read: boolean;
}

export type AppNotice = UpdateNotice;

export interface AppStats {
  reportsToday: number;
  reportsWeek: number;
  eventSpecsToday: number;
  appOnlineMs: number;
  sessionStartedAt: number;
}

export interface SpotifyTrack {
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  playing: boolean;
  position?: number;
  duration?: number;
}

export interface DisplayInfo {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  primary: boolean;
}

export interface ProcessInfo {
  hwnd: unknown;
  pid: number;
  title: string;
  name: string;
}

export interface LiveServerStatus {
  endpoint: string;
  name: string;
  project: "majestic";
  players: number;
  online: boolean;
  region?: string;
}
