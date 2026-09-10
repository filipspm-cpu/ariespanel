import type { AppStats } from "@/types";

export async function fetchDashboardStats(local: AppStats): Promise<AppStats> {
  return local;
}

export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}
