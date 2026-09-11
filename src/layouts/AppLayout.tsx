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
import { UpdateBanner } from "@/components/UpdateBanner";
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
};

export function AppLayout() {
  const route = useAppStore((s) => s.route);
  const Page = pages[route];
  return (
    <div className="flex h-full flex-col bg-syn-bg">
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
