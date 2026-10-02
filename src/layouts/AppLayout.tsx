import { lazy, Suspense, useEffect } from "react";
import type { ComponentType } from "react";
import { TitleBar } from "@/components/TitleBar";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { AriesConsole } from "@/components/AriesConsole";
import { HomePage } from "@/pages/HomePage";
import { CmdPage } from "@/pages/CmdPage";
import { OverlayPage } from "@/pages/OverlayPage";
import { MacrosPage } from "@/pages/MacrosPage";
import { CountersPage } from "@/pages/CountersPage";
import { CreditsPage } from "@/pages/CreditsPage";
import { AccountsPage } from "@/pages/AccountsPage";
import { NoticesPage } from "@/pages/NoticesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { AboutPage } from "@/pages/AboutPage";
import { CraftPage } from "@/pages/CraftPage";
import { FeedbackPage } from "@/pages/FeedbackPage";
import { AchievementsPage } from "@/pages/AchievementsPage";
import { FactionsPage } from "@/pages/FactionsPage";
import { UpdateBanner } from "@/components/UpdateBanner";
import { WelcomeNoticesModal } from "@/components/WelcomeNoticesModal";
import { useAccountRanks } from "@/components/RankBadge";
import { canAccessRoute } from "@/data/navigation";
import { useAppStore } from "@/store/useAppStore";
import type { RouteId } from "@/types";

const ForumPage = lazy(() => import("@/pages/ForumPage").then(({ ForumPage }) => ({ default: ForumPage })));

const pages: Record<RouteId, ComponentType> = {
  home: HomePage,
  cmd: CmdPage,
  overlay: OverlayPage,
  macros: MacrosPage,
  counters: CountersPage,
  settings: SettingsPage,
  accounts: AccountsPage,
  notices: NoticesPage,
  about: AboutPage,
  credits: CreditsPage,
  craft: CraftPage,
  feedback: FeedbackPage,
  achievements: AchievementsPage,
  factions: FactionsPage,
};

export function AppLayout() {
  const route = useAppStore((s) => s.route);
  const setRoute = useAppStore((s) => s.setRoute);
  const discordId = useAppStore((s) => s.settings.discordId);
  const ranks = useAccountRanks(discordId);
  const allowed = canAccessRoute(route, ranks);

  useEffect(() => {
    if (!canAccessRoute(route, ranks)) setRoute("home");
  }, [route, ranks, setRoute]);

  const pageRoute = allowed ? route : "home";
  const Page = pageRoute === "forum" ? null : pages[pageRoute];
  return (
    <div className="flex h-full flex-col bg-black">
      <TitleBar />
      <UpdateBanner />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {Page ? (
            <Page />
          ) : (
            <Suspense
              fallback={
                <div className="studio-page">
                  <div className="studio-body text-sm text-zinc-400">Ładowanie forum…</div>
                </div>
              }
            >
              <ForumPage />
            </Suspense>
          )}
        </main>
        <WelcomeNoticesModal />
      </div>
      <AriesConsole />
      <CommandPalette />
    </div>
  );
}
