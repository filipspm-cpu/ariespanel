import fs from "fs";
import path from "path";
import { app } from "electron";

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

export interface Counter {
  id: string;
  name: string;
  description: string;
  value: number;
  color: "purple" | "green";
  shortcut: string;
  showInOverlay: boolean;
  history: { timestamp: number; delta: number }[];
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

export interface AppState {
  macros: Macro[];
  folders: MacroFolder[];
  counters: Counter[];
  overlay: OverlaySettings;
  cmd: CmdSettings;
  settings: AppSettings;
  stats: {
    reportsToday: number;
    reportsWeek: number;
    eventSpecsToday: number;
    appOnlineMs: number;
    sessionStartedAt: number;
  };
}

const defaultState = (): AppState => ({
  macros: [
    {
      id: "macro-w",
      name: ".w",
      folderId: null,
      trigger: ".w",
      triggers: [{ prefix: ".", command: "w" }],
      random: true,
      enabled: true,
      steps: [
        { id: "s1", type: "insert-text", text: "Witam", pressEnter: false },
        { id: "s2", type: "insert-text", text: "Hejka", pressEnter: false },
        { id: "s3", type: "insert-text", text: "Czesc", pressEnter: false },
        { id: "s4", type: "insert-text", text: "Dzień dobry", pressEnter: false },
      ],
    },
  ],
  folders: [{ id: "folder-general", name: "Ogólne" }],
  counters: [
    {
      id: "ticket",
      name: "Reporty",
      description: "Odebrane zgłoszenia",
      value: 0,
      color: "purple",
      shortcut: "F8",
      showInOverlay: true,
      history: [],
    },
    {
      id: "event-specs",
      name: "Event Specs",
      description: "Specyfikacje eventów",
      value: 0,
      color: "green",
      shortcut: "F9",
      showInOverlay: true,
      history: [],
    },
  ],
  overlay: {
    displayId: null,
    enabled: false,
    editMode: false,
    showReports: true,
    showSpotify: true,
    showClock: true,
    showRadial: true,
    showPush: true,
    positions: {
      reports: { x: 50, y: 8, scale: 1 },
      spotify: { x: 50, y: 91, scale: 1 },
      clock: { x: 1.4, y: 95, scale: 0.75 },
    },
    previousLayout: null,
  },
  cmd: {
    pressT: false,
    reverse: false,
    pressEnter: true,
    intervalMs: 500,
  },
  settings: {
    language: "pl",
    username: "Filipek",
    theme: "dark",
    githubOwner: "filipspm-cpu",
    githubRepo: "ariespanel",
    githubToken: "",
    autoUpdate: true,
  },
  stats: {
    reportsToday: 0,
    reportsWeek: 0,
    eventSpecsToday: 0,
    appOnlineMs: 0,
    sessionStartedAt: Date.now(),
  },
});

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function parseTrigger(trigger: string): MacroTrigger {
  if (trigger.startsWith("%")) return { prefix: "%", command: trigger.slice(1) };
  if (trigger.startsWith(".")) return { prefix: ".", command: trigger.slice(1) };
  return { prefix: "", command: trigger };
}

function migrateMacro(raw: Macro): Macro {
  const trigger = raw.trigger || raw.name || "";
  const triggers = raw.triggers && raw.triggers.length > 0 ? raw.triggers : [parseTrigger(trigger)];
  const steps = (raw.steps ?? []).map((s) => ({
    ...s,
    type: s.type || ("insert-text" as const),
    children: s.children?.map((c) => ({ ...c, type: c.type || ("insert-text" as const) })),
    elseChildren: s.elseChildren?.map((c) => ({ ...c, type: c.type || ("insert-text" as const) })),
  }));
  const wrapped =
    raw.random && !steps.some((s) => s.type === "random")
      ? [
          {
            id: uid("step"),
            type: "random" as const,
            text: "",
            pressEnter: false,
            children: steps,
          },
        ]
      : steps;
  return {
    ...raw,
    trigger: `${triggers[0]?.prefix ?? ""}${triggers[0]?.command ?? ""}` || trigger,
    triggers,
    random: Boolean(raw.random) || wrapped.some((s) => s.type === "random"),
    enabled: raw.enabled !== false,
    steps: wrapped,
  };
}

function filePath() {
  return path.join(app.getPath("userData"), "synvity-state.json");
}

let cache: AppState | null = null;

function normalizeState(state: AppState): AppState {
  const settings = {
    ...state.settings,
    githubOwner: "filipspm-cpu",
    githubRepo: "ariespanel",
  };
  return {
    ...state,
    settings,
    macros: (state.macros ?? []).map((m) => migrateMacro(m)),
  };
}

export function loadState(): AppState {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(filePath(), "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppState>;
    cache = normalizeState(deepMerge(defaultState(), parsed));
    const repo = (parsed.settings as AppSettings | undefined)?.githubRepo;
    const owner = (parsed.settings as AppSettings | undefined)?.githubOwner;
    if (repo !== "ariespanel" || owner !== "filipspm-cpu") {
      try {
        fs.writeFileSync(filePath(), JSON.stringify(cache, null, 2), "utf-8");
      } catch {
        /* ignore */
      }
    }
  } catch {
    cache = defaultState();
    try {
      fs.mkdirSync(path.dirname(filePath()), { recursive: true });
      fs.writeFileSync(filePath(), JSON.stringify(cache, null, 2), "utf-8");
    } catch {
      /* ignore first-write errors */
    }
  }
  return cache;
}

export function saveState(partial: Partial<AppState>): AppState {
  const current = loadState();
  cache = normalizeState(deepMerge(current, partial));
  fs.mkdirSync(path.dirname(filePath()), { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(cache, null, 2), "utf-8");
  return cache;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepMerge<T>(base: T, patch: Partial<T> | undefined): T {
  if (!patch) return base;
  const out = Array.isArray(base) ? ([...base] as T) : { ...base };
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const key = k as keyof T;
    const current = (out as Record<string, unknown>)[k];
    if (Array.isArray(v)) {
      (out as Record<string, unknown>)[k] = v;
    } else if (isObject(v) && isObject(current)) {
      (out as Record<string, unknown>)[k] = deepMerge(current, v);
    } else if (v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    } else {
      void key;
    }
  }
  return out;
}
