import type { AppNotice, AppSettings, AppStats, CmdSettings, Counter, Macro, MacroFolder, OverlaySettings } from "@/types";

export interface PersistedState {
  macros: Macro[];
  folders: MacroFolder[];
  counters: Counter[];
  overlay: OverlaySettings;
  cmd: CmdSettings;
  settings: AppSettings;
  stats: AppStats;
  notices: AppNotice[];
}

export async function persist(partial: Partial<PersistedState>) {
  if (!window.synvity) return;
  try {
    await window.synvity.saveState(partial);
  } catch (err) {
    console.warn("Nie udało się zapisać stanu", err);
  }
}

export async function hydrate(): Promise<PersistedState | null> {
  if (!window.synvity) return null;
  return (await window.synvity.loadState()) as PersistedState;
}
