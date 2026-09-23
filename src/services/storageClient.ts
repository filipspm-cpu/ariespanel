import type { AppNotice, AppSettings, AppStats, ClickerSettings, CmdSettings, Counter, Macro, MacroFolder, OverlaySettings } from "@/types";

export interface PersistedState {
  macros: Macro[];
  folders: MacroFolder[];
  counters: Counter[];
  overlay: OverlaySettings;
  cmd: CmdSettings;
  clicker: ClickerSettings;
  settings: AppSettings;
  stats: AppStats;
  notices: AppNotice[];
}

let persistChain: Promise<void> = Promise.resolve();

export function persist(partial: Partial<PersistedState>) {
  const api = window.synvity;
  if (!api) return persistChain;
  const run = persistChain.then(async () => {
    try {
      await api.saveState(partial);
    } catch (err) {
      console.warn("Nie udało się zapisać stanu", err);
    }
  });
  persistChain = run;
  return run;
}

export async function hydrate(): Promise<PersistedState | null> {
  if (!window.synvity) return null;
  return (await window.synvity.loadState()) as PersistedState;
}
