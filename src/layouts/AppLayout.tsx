import { useEffect } from "react";
import type { ComponentType } from "react";
import { TitleBar } from "@/components/TitleBar";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { HomePage } from "@/pages/HomePage";
import { CmdPage } from "@/pages/CmdPage";
import { OverlayPage } from "@/pages/OverlayPage";
import { MacrosPage } from "@/pages/MacrosPage";
import { CountersPage } from "@/pages/CountersPage";
import { CreditsPage } from "@/pages/CreditsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AboutPage } from "@/pages/AboutPage";
import { CraftPage } from "@/pages/CraftPage";
import { UpdateBanner } from "@/components/UpdateBanner";
import { useAccountRank } from "@/components/RankBadge";
import { useAppStore } from "@/store/useAppStore";
import type { RouteId } from "@/types";

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
};

export function AppLayout() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const discordId = useAppStore((s) => s.settings.discordId);
  const rank = useAccountRank(discordId);
  const allowed = route !== "craft" || rank === "developer";

  useEffect(() => {
    if (route === "craft" && rank !== "developer") setRoute("home");
  }, [route, rank, setRoute]);

  const Page = allowed ? pages[route] : HomePage;
  return (
    <div className="flex h-full flex-col bg-black">
      <TitleBar />
      <UpdateBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <Page />
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
