import { lazy, Suspense, useEffect } from "react";
import type { ComponentType } from "react";
import { TitleBar } from "@/components/TitleBar";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { HomePage } from "@/pages/HomePage";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useAccountRank } from "@/components/RankBadge";
import { canAccessRoute } from "@/data/navigation";
import { useAppStore } from "@/store/useAppStore";
import type { RouteId } from "@/types";

const CmdPage = lazy(() => import("@/pages/CmdPage").then((m) => ({ default: m.CmdPage })));
const OverlayPage = lazy(() => import("@/pages/OverlayPage").then((m) => ({ default: m.OverlayPage })));
const MacrosPage = lazy(() => import("@/pages/MacrosPage").then((m) => ({ default: m.MacrosPage })));
const CountersPage = lazy(() => import("@/pages/CountersPage").then((m) => ({ default: m.CountersPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const AboutPage = lazy(() => import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage })));
const CreditsPage = lazy(() => import("@/pages/CreditsPage").then((m) => ({ default: m.CreditsPage })));
const CraftPage = lazy(() => import("@/pages/CraftPage").then((m) => ({ default: m.CraftPage })));
const ForumPage = lazy(() => import("@/pages/ForumPage").then((m) => ({ default: m.ForumPage })));

const pages: Record<RouteId, ComponentType> = {
  home: HomePage,
  cmd: CmdPage,
  overlay: OverlayPage,
  macros: MacrosPage,
  counters: CountersPage,
  settings: SettingsPage,
  about: AboutPage,
  credits: CreditsPage,
  craft: CraftPage,
  forum: ForumPage,
};

export function AppLayout() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const discordId = useAppStore((s) => s.settings.discordId);
  const rank = useAccountRank(discordId);
  const allowed = canAccessRoute(route, rank);

  useEffect(() => {
    if (!canAccessRoute(route, rank)) setRoute("home");
  }, [route, rank, setRoute]);

  const Page = allowed ? pages[route] : HomePage;
  return (
    <div className="flex h-full flex-col bg-black">
      <TitleBar />
      <UpdateBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-[13px] text-zinc-600">Ładowanie…</div>}>
            <Page />
          </Suspense>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
