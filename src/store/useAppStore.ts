import type {
  AppSettings,
  AppStats,
  CmdSettings,
  Counter,
  Macro,
  MacroFolder,
  OverlayHudLayout,
  OverlaySettings,
  RouteId,
} from "@/types";
import { persist } from "@/services/storageClient";
import { migrateMacro } from "@/data/defaultMacros";

export interface AppSnapshot {
  route: RouteId;
  gameOpen: boolean;
  forumOpen: boolean;
  searchOpen: boolean;
  searchQuery: string;
  onlineCount: number;
  macros: Macro[];
  folders: MacroFolder[];
  counters: Counter[];
  overlay: OverlaySettings;
  cmd: CmdSettings;
  settings: AppSettings;
  stats: AppStats;
  hydrated: boolean;
}

const defaultSnapshot = (): Omit<AppSnapshot, "route" | "searchOpen" | "searchQuery" | "onlineCount" | "hydrated"> => ({
  gameOpen: true,
  forumOpen: false,
  macros: [],
  folders: [],
  counters: [],
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
  cmd: { pressT: false, reverse: false, pressEnter: true, intervalMs: 500 },
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

function snapshotHud(overlay: OverlaySettings): OverlayHudLayout {
  return {
    showReports: overlay.showReports,
    showSpotify: overlay.showSpotify,
    showClock: overlay.showClock,
    showRadial: overlay.showRadial,
    showPush: overlay.showPush,
    positions: {
      reports: { ...overlay.positions.reports },
      spotify: { ...overlay.positions.spotify },
      clock: { ...overlay.positions.clock },
    },
  };
}

const defaultHud = (): OverlayHudLayout => snapshotHud(defaultSnapshot().overlay);

type State = AppSnapshot & {
  setRoute: (route: RouteId) => void;
  setGameOpen: (open: boolean) => void;
  setForumOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  hydrateFromDisk: (data: Partial<AppSnapshot>) => void;
  setMacros: (macros: Macro[]) => void;
  setFolders: (folders: MacroFolder[]) => void;
  setCounters: (counters: Counter[]) => void;
  addCounter: (input: { name: string; description?: string; shortcut?: string; color?: Counter["color"]; showInOverlay?: boolean }) => string;
  removeCounter: (id: string) => void;
  bumpCounter: (id: string, delta: number) => void;
  removeCounterEntry: (id: string, timestamp: number, delta: number) => void;
  clearCounterToday: (id: string) => void;
  patchOverlay: (overlay: Partial<OverlaySettings>) => void;
  resetOverlayLayout: () => void;
  restoreOverlayPrevious: () => void;
  rememberOverlayLayout: () => void;
  patchCmd: (cmd: Partial<CmdSettings>) => void;
  patchSettings: (settings: Partial<AppSettings>) => void;
  patchStats: (stats: Partial<AppStats>) => void;
};

import { create } from "zustand";

export const useAppStore = create<State>((set, get) => ({
  route: "home",
  searchOpen: false,
  searchQuery: "",
  onlineCount: 2,
  hydrated: false,
  ...defaultSnapshot(),
  setRoute: (route) => {
    const gameRoutes: RouteId[] = ["cmd", "overlay", "macros", "counters"];
    set({
      route,
      gameOpen: gameRoutes.includes(route) ? true : get().gameOpen,
    });
  },
  setGameOpen: (gameOpen) => set({ gameOpen }),
  setForumOpen: (forumOpen) => set({ forumOpen }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  hydrateFromDisk: (data) => {
    const defaults = defaultSnapshot();
    const overlayIn = data.overlay;
    set({
      ...defaults,
      ...data,
      macros: Array.isArray(data.macros) ? data.macros.map((m) => migrateMacro(m as Macro)) : defaults.macros,
      counters: (Array.isArray(data.counters) ? data.counters : defaults.counters).map((c) => ({
        ...c,
        showInOverlay: c.showInOverlay !== false,
        name: c.id === "ticket" ? "Reporty" : c.name,
      })),
      overlay: {
        ...defaults.overlay,
        ...overlayIn,
        positions: {
          reports: { ...defaults.overlay.positions.reports, ...overlayIn?.positions?.reports },
          spotify: { ...defaults.overlay.positions.spotify, ...overlayIn?.positions?.spotify },
          clock: { ...defaults.overlay.positions.clock, ...overlayIn?.positions?.clock },
        },
        previousLayout: overlayIn?.previousLayout ?? null,
      },
      stats: {
        ...defaults.stats,
        ...data.stats,
        sessionStartedAt: Date.now(),
      },
      settings: { ...defaults.settings, ...data.settings },
      cmd: { ...defaults.cmd, ...data.cmd },
      hydrated: true,
    });
  },
  setMacros: (macros) => {
    set({ macros });
    void persist({ macros: get().macros });
  },
  setFolders: (folders) => {
    set({ folders });
    void persist({ folders });
  },
  setCounters: (counters) => {
    set({ counters });
    void persist({ counters });
  },
  addCounter: (input) => {
    const name = input.name.trim() || "Nowa statystyka";
    const id = `counter-${crypto.randomUUID()}`;
    const next: Counter[] = [
      ...get().counters,
      {
        id,
        name,
        description: input.description?.trim() ?? "",
        value: 0,
        color: input.color ?? "blue",
        shortcut: input.shortcut?.trim() ?? "",
        showInOverlay: input.showInOverlay ?? true,
        history: [],
      },
    ];
    set({ counters: next });
    void persist({ counters: next });
    return id;
  },
  removeCounter: (id) => {
    if (id === "ticket" || id === "event-specs") return;
    const counters = get().counters.filter((c) => c.id !== id);
    set({ counters });
    void persist({ counters });
  },
  bumpCounter: (id, delta) => {
    const counters = get().counters.map((c) => {
      if (c.id !== id) return c;
      const value = Math.max(0, c.value + delta);
      const applied = value - c.value;
      if (applied === 0) return c;
      return {
        ...c,
        value,
        history: [...(c.history ?? []), { timestamp: Date.now(), delta: applied }].slice(-2000),
      };
    });
    set({ counters });
    void persist({ counters });
  },
  removeCounterEntry: (id, timestamp, delta) => {
    const counters = get().counters.map((c) => {
      if (c.id !== id) return c;
      const history = [...(c.history ?? [])];
      const idx = history.findIndex((h) => h.timestamp === timestamp && h.delta === delta);
      if (idx < 0) return c;
      const removed = history.splice(idx, 1)[0];
      return {
        ...c,
        history,
        value: Math.max(0, c.value - removed.delta),
      };
    });
    set({ counters });
    void persist({ counters });
  },
  clearCounterToday: (id) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const from = start.getTime();
    const to = from + 86400000;
    const counters = get().counters.map((c) => {
      if (c.id !== id) return c;
      const history = c.history ?? [];
      const today = history.filter((h) => h.timestamp >= from && h.timestamp < to);
      const rest = history.filter((h) => h.timestamp < from || h.timestamp >= to);
      const removed = today.reduce((sum, h) => sum + h.delta, 0);
      return {
        ...c,
        history: rest,
        value: Math.max(0, c.value - removed),
      };
    });
    set({ counters });
    void persist({ counters });
  },
  patchOverlay: (overlay) => {
    const prev = get().overlay;
    const next = {
      ...prev,
      ...overlay,
      positions: overlay.positions
        ? {
            reports: { ...prev.positions.reports, ...overlay.positions.reports },
            spotify: { ...prev.positions.spotify, ...overlay.positions.spotify },
            clock: { ...prev.positions.clock, ...overlay.positions.clock },
          }
        : prev.positions,
    };
    set({ overlay: next });
    void persist({ overlay: next });
  },
  resetOverlayLayout: () => {
    const current = get().overlay;
    const hud = defaultHud();
    const next: OverlaySettings = {
      ...current,
      ...hud,
      editMode: current.editMode,
      previousLayout: snapshotHud(current),
    };
    set({ overlay: next });
    void persist({ overlay: next });
  },
  restoreOverlayPrevious: () => {
    const current = get().overlay;
    if (!current.previousLayout) return;
    const next: OverlaySettings = {
      ...current,
      ...current.previousLayout,
      previousLayout: snapshotHud(current),
    };
    set({ overlay: next });
    void persist({ overlay: next });
  },
  rememberOverlayLayout: () => {
    const current = get().overlay;
    const next: OverlaySettings = {
      ...current,
      previousLayout: snapshotHud(current),
    };
    set({ overlay: next });
    void persist({ overlay: next });
  },
  patchCmd: (cmd) => {
    const next = { ...get().cmd, ...cmd };
    set({ cmd: next });
    void persist({ cmd: next });
  },
  patchSettings: (settings) => {
    const next = { ...get().settings, ...settings };
    set({ settings: next });
    void persist({ settings: next });
  },
  patchStats: (stats) => {
    const next = { ...get().stats, ...stats };
    set({ stats: next });
    void persist({ stats: next });
  },
}));
