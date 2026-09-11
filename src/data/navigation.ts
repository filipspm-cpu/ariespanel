import { FORUM_RULES } from "@/data/forumRules";
import { hasBetaAccess, type AccountRank } from "@/data/testers";
import type { NavGroup, RouteId } from "@/types";

export const navGroups: NavGroup[] = [
  {
    id: "platform",
    label: "Platforma",
    items: [
      { id: "home", label: "Główna", icon: "home" },
      {
        id: "cmd",
        label: "Gra",
        icon: "gamepad",
        children: [
          { id: "cmd", label: "Wykonawca CMD", icon: "terminal" },
          { id: "overlay", label: "Nakładka", icon: "layers" },
          { id: "macros", label: "Makra", icon: "zap" },
          { id: "counters", label: "Statystyki", icon: "gauge" },
        ],
      },
      {
        id: "forum",
        label: "Forum",
        icon: "messages",
        children: FORUM_RULES.map((rule) => ({
          id: "forum" as const,
          label: rule.title,
          icon: "scroll",
          href: rule.url,
        })),
      },
      { id: "craft", label: "Craft", icon: "hammer", betaOnly: true },
    ],
  },
  {
    id: "settings-group",
    label: "Ustawienia",
    items: [
      { id: "settings", label: "Ustawienia systemu", icon: "settings" },
      { id: "about", label: "O aplikacji", icon: "info" },
      { id: "credits", label: "Autorzy", icon: "heart" },
    ],
  },
];

function canSeeNavItem(item: { devOnly?: boolean; betaOnly?: boolean }, rank: AccountRank | null) {
  if (item.devOnly && rank !== "developer") return false;
  if (item.betaOnly && !hasBetaAccess(rank)) return false;
  return true;
}

function withBetaBadge<T extends { betaOnly?: boolean; badge?: string }>(item: T): T {
  if (!item.betaOnly) return item;
  return { ...item, badge: item.badge || "BETA" };
}

export function canAccessRoute(route: RouteId, rank: AccountRank | null) {
  if (route === "craft") return hasBetaAccess(rank);
  return true;
}

export function visibleNavGroups(rank: AccountRank | null): NavGroup[] {
  return navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => canSeeNavItem(item, rank))
        .map((item) => ({
          ...withBetaBadge(item),
          children: item.children?.filter((child) => canSeeNavItem(child, rank)).map(withBetaBadge),
        })),
    }))
    .filter((group) => group.items.length > 0);
}

export const breadcrumbs: Record<RouteId, string[]> = {
  home: ["Dashboard"],
  cmd: ["Dashboard", "Game", "Cmd"],
  overlay: ["Dashboard", "Game", "Overlay"],
  macros: ["Dashboard", "Gra", "Makra"],
  counters: ["Dashboard", "Gra", "Statystyki"],
  settings: ["Dashboard", "Ustawienia systemu"],
  about: ["Dashboard", "O aplikacji"],
  credits: ["Dashboard", "Autorzy"],
  craft: ["Dashboard", "Craft"],
};

export const pageMeta: Record<RouteId, { title: string; subtitle?: string }> = {
  home: { title: "Dashboard" },
  cmd: { title: "CMD Executor", subtitle: "Wyślij serię komend do wybranego procesu gry" },
  overlay: { title: "Nakładka", subtitle: "Skonfiguruj nakładkę gry i powiadomienia" },
  macros: { title: "Makra" },
  counters: { title: "Statystyki" },
  settings: { title: "Ustawienia systemu" },
  about: { title: "O aplikacji", subtitle: "ARIES — prywatny panel administracyjny" },
  credits: { title: "Autorzy" },
  craft: { title: "Craft", subtitle: "Tabela krafta frakcji — Majestic Wiki" },
};
