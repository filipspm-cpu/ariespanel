import type { Counter, OverlayCounterItem } from "@/types";

export function overlayCounterItems(counters: Counter[]): OverlayCounterItem[] {
  return counters
    .filter((c) => c.showInOverlay)
    .map((c) => ({ id: c.id, name: c.name, value: c.value, color: c.color }));
}
