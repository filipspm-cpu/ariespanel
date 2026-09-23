import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SetupNameScreen } from "@/components/SetupNameScreen";
import { hydrate } from "@/services/storageClient";
import { overlayCounterItems } from "@/services/overlayCounters";
import { advanceRewardStats, pushRewardStats } from "@/services/rewardStats";
import { msUntilNextMidnight } from "@/services/todayStats";
import { MIN_CLICK_MS } from "@/types";
import { useAppStore } from "@/store/useAppStore";

export function App() {
  const hydrateFromDisk = useAppStore((s) => s.hydrateFromDisk);
  const macros = useAppStore((s) => s.macros);
  const counters = useAppStore((s) => s.counters);
  const overlay = useAppStore((s) => s.overlay);
  const hydrated = useAppStore((s) => s.hydrated);
  const profileNameSet = useAppStore((s) => Boolean(s.settings.profileNameSet));
  const [splash, setSplash] = useState(true);
  const splashStarted = useRef(Date.now());

  useEffect(() => {
    void hydrate().then((data) => {
      if (data) {
        hydrateFromDisk(data);
      } else {
        hydrateFromDisk({});
      }
    }).then(() => window.synvity?.ranksList?.()).then((rows) => {
      if (rows) useAppStore.getState().setTesters(rows);
    });
  }, [hydrateFromDisk]);

  useEffect(() => {
    document.getElementById("boot-splash")?.classList.add("is-hidden");
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const wait = Math.max(0, 1400 - (Date.now() - splashStarted.current));
    const timer = window.setTimeout(() => setSplash(false), wait);
    return () => window.clearTimeout(timer);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const clicker = useAppStore.getState().clicker;
    if (!clicker?.enabled) return;
    void window.synvity?.clickerSet?.({
      enabled: true,
      intervalMs: Math.max(MIN_CLICK_MS, clicker.intervalMs || MIN_CLICK_MS),
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const triggers = macros
      .filter((m) => m.enabled)
      .flatMap((m) => {
        const seqs = m.triggers?.length
          ? m.triggers.map((t) => `${t.prefix}${t.command}`)
          : [m.trigger];
        return seqs.filter(Boolean).map((sequence) => ({
          id: m.id,
          sequence: sequence.endsWith(" ") ? sequence : `${sequence} `,
        }));
      });
    void window.synvity?.registerTriggers(triggers);
  }, [macros, hydrated]);

  useEffect(() => {
    const off = window.synvity?.onCommandPalette(() => useAppStore.getState().setSearchOpen(true));
    return () => off?.();
  }, []);

  useEffect(() => {
    const off = window.synvity?.onOpenSettings(() => useAppStore.getState().setRoute("settings"));
    return () => off?.();
  }, []);

  useEffect(() => {
    const off = window.synvity?.onOverlayLayout((overlay) => {
      useAppStore.setState({ overlay });
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    const off = window.synvity?.onCountersChanged((next) => {
      if (!Array.isArray(next)) return;
      useAppStore.setState({ counters: next });
      void pushRewardStats({ ...useAppStore.getState(), counters: next });
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      const counter = useAppStore.getState().counters.find((c) => c.shortcut && c.shortcut.toUpperCase() === key.toUpperCase());
      if (!counter) return;
      e.preventDefault();
      useAppStore.getState().bumpCounter(counter.id, 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!hydrated || !overlay.enabled) return;
    void window.synvity?.overlayPush({
      overlay,
      overlayCounters: overlayCounterItems(counters),
      now: Date.now(),
    });
  }, [counters, overlay, hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const flushOnline = (resetDay: boolean) => {
      const s = useAppStore.getState().stats;
      const next = advanceRewardStats(s, { resetDay, minElapsedMs: 20000 });
      if (!next) return;
      useAppStore.getState().patchStats(next);
    };

    const pushOverlay = () => {
      const state = useAppStore.getState();
      if (!state.overlay.enabled) return;
      void window.synvity?.overlayPush({
        overlay: state.overlay,
        overlayCounters: overlayCounterItems(state.counters),
        now: Date.now(),
      });
    };

    const onMidnight = () => {
      flushOnline(true);
      pushOverlay();
    };

    const tick = setInterval(() => flushOnline(false), 30000);
    const rewards = window.setInterval(() => {
      const state = useAppStore.getState();
      if (state.settings.discordId) void pushRewardStats(state);
    }, 60000);
    let midnight = window.setTimeout(function arm() {
      onMidnight();
      midnight = window.setTimeout(arm, msUntilNextMidnight());
    }, msUntilNextMidnight());

    if (useAppStore.getState().settings.discordId) {
      void pushRewardStats(useAppStore.getState());
    }

    return () => {
      clearInterval(tick);
      window.clearInterval(rewards);
      window.clearTimeout(midnight);
    };
  }, [hydrated]);

  if (splash) {
    return <LoadingScreen />;
  }

  if (!profileNameSet) {
    return <SetupNameScreen />;
  }

  return <AppLayout />;
}
