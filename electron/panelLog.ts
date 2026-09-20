export type PanelLogLevel = "info" | "warn" | "error";

export type PanelLogEntry = {
  id: number;
  at: number;
  level: PanelLogLevel;
  source: string;
  message: string;
  detail?: string;
  open?: boolean;
};

const MAX = 250;
let seq = 1;
const buffer: PanelLogEntry[] = [];
let emit: ((entry: PanelLogEntry) => void) | null = null;

export function attachPanelLog(fn: (entry: PanelLogEntry) => void) {
  emit = fn;
}

export function panelLog(input: Omit<PanelLogEntry, "id" | "at">): PanelLogEntry {
  const entry: PanelLogEntry = {
    id: seq++,
    at: Date.now(),
    ...input,
    detail: input.detail?.trim() || undefined,
  };
  buffer.push(entry);
  if (buffer.length > MAX) buffer.shift();
  emit?.(entry);
  return entry;
}

export function panelLogHistory() {
  return [...buffer];
}
