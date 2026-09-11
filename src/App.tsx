import { useEffect } from "react";
import { AppLayout } from "@/layouts/AppLayout";
import { BrandMark } from "@/components/BrandMark";
import introSound from "@/assets/sounds/intro.mp3";
import { hydrate } from "@/services/storageClient";
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
    if (!hydrated) return;
    const ticket = counters.find((c) => c.id === "ticket")?.value ?? 0;
    const specs = counters.find((c) => c.id === "event-specs")?.value ?? 0;
    void window.synvity?.spotifyNow().then((track) => {
      void window.synvity?.overlayPush({ overlay, ticket, specs, track, now: Date.now() });
    });
  }, [counters, overlay, hydrated]);

  useEffect(() => {
    const t = setInterval(() => {
      const ticket = useAppStore.getState().counters.find((c) => c.id === "ticket")?.value ?? 0;
      const specs = useAppStore.getState().counters.find((c) => c.id === "event-specs")?.value ?? 0;
      const ov = useAppStore.getState().overlay;
      void window.synvity?.spotifyNow().then((track) => {
        void window.synvity?.overlayPush({ overlay: ov, ticket, specs, track, now: Date.now() });
      }).catch(() => undefined);
    }, 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = setInterval(() => {
      const s = useAppStore.getState().stats;
      const elapsed = Date.now() - s.sessionStartedAt;
      if (elapsed < 20000) return;
      useAppStore.getState().patchStats({
        appOnlineMs: s.appOnlineMs + elapsed,
        sessionStartedAt: Date.now(),
      });
    }, 30000);
    return () => clearInterval(t);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (useAppStore.getState().settings.startupSound === false) return;
    const audio = new Audio(introSound);
    audio.volume = 0.85;
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.removeAttribute("src");
    };
  }, [hydrated]);

  if (!hydrated) {
    return <div className="flex h-full items-center justify-center bg-syn-bg"><BrandMark /></div>;
  }

  return <AppLayout />;
}
