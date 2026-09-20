import type { Counter } from "@/types";
import { calendarDayKey } from "@/services/todayStats";

export type RewardClock = {
  appOnlineMs: number;
  sessionStartedAt: number;
  onlineDay?: string;
  rewardOnlineMs?: number;
  rewardActiveDays?: number;
  rewardActiveDay?: string;
};

export function uniqueDays(counter?: Counter, now = Date.now()) {
  const days = new Set<string>();
  days.add(calendarDayKey(new Date(now)));
  for (const entry of counter?.history ?? []) {
    const date = new Date(entry.timestamp);
    if (!Number.isNaN(date.getTime())) days.add(calendarDayKey(date));
  }
  return days.size;
}

export function seedRewardStats(
  stats: RewardClock | undefined,
  counters: Counter[] | undefined,
  now = Date.now(),
): RewardClock {
  const today = calendarDayKey(new Date(now));
  const sameDay = stats?.onlineDay === today;
  let rewardActiveDays = Math.max(0, stats?.rewardActiveDays ?? 0);
  let rewardActiveDay = stats?.rewardActiveDay || "";
  if (rewardActiveDays <= 0) {
    const ticket = counters?.find((c) => c.id === "ticket");
    rewardActiveDays = uniqueDays(ticket, now);
    rewardActiveDay = today;
  } else if (rewardActiveDay !== today) {
    rewardActiveDays += 1;
    rewardActiveDay = today;
  }
  return {
    appOnlineMs: sameDay ? Math.max(0, stats?.appOnlineMs ?? 0) : 0,
    sessionStartedAt: now,
    onlineDay: today,
    rewardOnlineMs: Math.max(0, stats?.rewardOnlineMs ?? stats?.appOnlineMs ?? 0),
    rewardActiveDays,
    rewardActiveDay,
  };
}

export function advanceRewardStats(
  stats: RewardClock,
  opts?: { now?: number; resetDay?: boolean; minElapsedMs?: number },
): RewardClock | null {
  const now = opts?.now ?? Date.now();
  const today = calendarDayKey(new Date(now));
  const elapsed = Math.max(0, now - stats.sessionStartedAt);
  const newDay = Boolean(opts?.resetDay) || stats.onlineDay !== today;
  if (!newDay && elapsed < (opts?.minElapsedMs ?? 0)) return null;

  const baseOnline = stats.rewardOnlineMs ?? stats.appOnlineMs ?? 0;
  let rewardActiveDays = Math.max(0, stats.rewardActiveDays ?? 0);
  let rewardActiveDay = stats.rewardActiveDay || "";
  if (rewardActiveDays <= 0) {
    rewardActiveDays = 1;
    rewardActiveDay = today;
  } else if (rewardActiveDay !== today) {
    rewardActiveDays += 1;
    rewardActiveDay = today;
  }

  return {
    ...stats,
    appOnlineMs: newDay ? 0 : Math.max(0, stats.appOnlineMs + elapsed),
    sessionStartedAt: now,
    onlineDay: today,
    rewardOnlineMs: Math.max(0, baseOnline + elapsed),
    rewardActiveDays,
    rewardActiveDay,
  };
}

export function collectRewardStats(
  state: {
    counters: Counter[];
    stats: RewardClock;
  },
  now = Date.now(),
) {
  const ticket = state.counters.find((c) => c.id === "ticket");
  const events = state.counters.find((c) => c.id === "event-specs");
  const elapsed = Math.max(0, now - state.stats.sessionStartedAt);
  const today = calendarDayKey(new Date(now));
  const onlineMs = Math.max(0, (state.stats.rewardOnlineMs ?? state.stats.appOnlineMs ?? 0) + elapsed);
  const trackedDays =
    (state.stats.rewardActiveDays ?? 0) +
    (state.stats.rewardActiveDay && state.stats.rewardActiveDay !== today ? 1 : 0);
  return {
    reports: Math.max(0, ticket?.value || 0),
    events: Math.max(0, events?.value || 0),
    onlineMs,
    nightReports: nightCount(ticket),
    activeDays: Math.max(trackedDays, uniqueDays(ticket, now), 1),
  };
}

function nightCount(counter?: Counter) {
  return Math.max(
    0,
    (counter?.history ?? []).reduce((sum, entry) => {
      const hour = new Date(entry.timestamp).getHours();
      return hour >= 0 && hour < 6 ? sum + entry.delta : sum;
    }, 0),
  );
}

export async function pushRewardStats(state: {
  counters: Counter[];
  stats: RewardClock;
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
  if (code === "device" || code === "ip") return "Na tym komputerze kod promocyjny został już użyty.";
  if (code === "missing") return "Nie ma takiego kodu.";
  if (code === "invalid") return "Niepoprawny kod.";
  if (code === "points") return "Za mało punktów, żeby to odebrać.";
  if (code === "claimed") return "Ta nagroda jest już odebrana.";
  if (code === "forbidden") return "Tylko developer może to zrobić.";
  if (code === "db") return "Nie udało się połączyć z bazą.";
  if (code === "phpfile") return "Na hostingu nie działa rewards.php. Wgraj accounts.php z folderu hosting — tam jest teraz generowanie kodów.";
  if (code === "timeout") return "Serwer nagród nie odpowiedział (timeout 12s).";
  if (code === "json") return "Serwer nagród oddał HTML lub tekst zamiast JSON.";
  if (code === "empty") return "Serwer nagród oddał pustą odpowiedź.";
  if (code === "http") return "Serwer nagród zwrócił błąd HTTP.";
  if (code === "network") return "Nie udało się połączyć z serwerem nagród.";
  if (code) return "Nie udało się zapisać.";
  return "";
}
