import { useEffect } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { BrandMark } from "@/components/BrandMark";
import { hydrate } from "@/services/storageClient";
import { overlayCounterItems } from "@/services/overlayCounters";
import { calendarDayKey, msUntilNextMidnight } from "@/services/todayStats";
import { useAppStore } from "@/store/useAppStore";

export function App() {
  const hydrateFromDisk = useAppStore((s) => s.hydrateFromDisk);
  const macros = useAppStore((s) => s.macros);
  const counters = useAppStore((s) => s.counters);
  const overlay = useAppStore((s) => s.overlay);
  const hydrated = useAppStore((s) => s.hydrated);

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
      const today = calendarDayKey();
      const elapsed = Math.max(0, Date.now() - s.sessionStartedAt);
      if (resetDay || s.onlineDay !== today) {
        useAppStore.getState().patchStats({
          appOnlineMs: 0,
          sessionStartedAt: Date.now(),
          onlineDay: today,
        });
        return;
      }
      if (elapsed < 20000) return;
      useAppStore.getState().patchStats({
        appOnlineMs: s.appOnlineMs + elapsed,
        sessionStartedAt: Date.now(),
        onlineDay: today,
      });
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
    let midnight = window.setTimeout(function arm() {
      onMidnight();
      midnight = window.setTimeout(arm, msUntilNextMidnight());
    }, msUntilNextMidnight());

    return () => {
      clearInterval(tick);
      window.clearTimeout(midnight);
    };
  }, [hydrated]);

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center bg-syn-bg"><BrandMark /></div>;
  }

  return <AppLayout />;
}
