import type { PanelLogEntry } from "@/types/api";

type Listener = (entry: PanelLogEntry) => void;

let seq = 10_000;
const buffer: PanelLogEntry[] = [];
const listeners = new Set<Listener>();

export function ariesLog(input: Omit<PanelLogEntry, "id" | "at">) {
  const entry: PanelLogEntry = {
    id: seq++,
    at: Date.now(),
    ...input,
    detail: input.detail?.trim() || undefined,
  };
  buffer.push(entry);
  if (buffer.length > 250) buffer.shift();
  listeners.forEach((fn) => fn(entry));
  return entry;
}

export function subscribeAriesLog(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function ariesLogBuffer() {
  return [...buffer];
}

export function mergeLogEntries(...groups: PanelLogEntry[][]) {
  const map = new Map<number, PanelLogEntry>();
  for (const group of groups) {
    for (const row of group) {
      if (row?.id) map.set(row.id, row);
    }
  }
  return [...map.values()].sort((a, b) => a.at - b.at || a.id - b.id);
}
