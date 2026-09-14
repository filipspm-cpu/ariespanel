import type { Counter, OverlayCounterItem } from "@/types";
import { todayCount } from "@/services/todayStats";

export function overlayCounterItems(counters: Counter[]): OverlayCounterItem[] {
  return counters
    .filter((c) => c.showInOverlay)
    .map((c) => ({ id: c.id, name: c.name, value: todayCount(c.history), color: c.color }));
}
