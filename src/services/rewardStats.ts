import type { Counter } from "@/types";
import { calendarDayKey } from "@/services/todayStats";

export function collectRewardStats(state: {
  counters: Counter[];
  stats: { appOnlineMs: number; sessionStartedAt: number };
}) {
  const ticket = state.counters.find((c) => c.id === "ticket");
  const events = state.counters.find((c) => c.id === "event-specs");
  const onlineMs = Math.max(0, state.stats.appOnlineMs + (Date.now() - state.stats.sessionStartedAt));
  return {
    reports: Math.max(0, ticket?.value || 0),
    events: Math.max(0, events?.value || 0),
    onlineMs,
    nightReports: nightCount(ticket),
    activeDays: uniqueDays(ticket),
  };
}

function nightCount(counter?: Counter) {
  return (counter?.history ?? []).reduce((sum, entry) => {
    if (entry.delta <= 0) return sum;
    const hour = new Date(entry.timestamp).getHours();
    return hour >= 0 && hour < 6 ? sum + entry.delta : sum;
  }, 0);
}

function uniqueDays(counter?: Counter) {
  const days = new Set<string>();
  days.add(calendarDayKey());
  for (const entry of counter?.history ?? []) {
    const date = new Date(entry.timestamp);
    if (!Number.isNaN(date.getTime())) days.add(calendarDayKey(date));
  }
  return days.size;
}

export async function pushRewardStats(state: {
  counters: Counter[];
  stats: { appOnlineMs: number; sessionStartedAt: number };
}) {
  if (!window.synvity?.rewardsSync) return;
  try {
    await window.synvity.rewardsSync(collectRewardStats(state));
  } catch {
    /* ignore */
  }
}

export function rewardsErrorText(code?: string) {
  if (code === "login") return "Najpierw połącz Discord w ustawieniach.";
  if (code === "own") return "Nie możesz wpisać własnego kodu.";
  if (code === "used") return "Ten użytkownik już wpisał promokod.";
  if (code === "missing") return "Nie ma takiego kodu.";
  if (code === "invalid") return "Niepoprawny kod.";
  if (code === "points") return "Za mało punktów, żeby to odebrać.";
  if (code === "claimed") return "Ta nagroda jest już odebrana.";
  if (code === "forbidden") return "Tylko developer może to zrobić.";
  if (code === "network") return "Nie udało się połączyć z serwerem nagród.";
  if (code) return "Nie udało się zapisać.";
  return "";
}
