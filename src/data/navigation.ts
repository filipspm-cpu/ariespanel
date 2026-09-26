import { FORUM_RULES } from "@/data/forumRules";
import { hasBetaAccess, hasDeveloperAccess, hasMainDeveloperAccess, type AccountRank } from "@/data/testers";
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
          { id: "clicker", label: "Auto clicker", icon: "mouse" },
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
          ruleId: rule.id,
        })),
      },
      { id: "craft", label: "Craft", icon: "hammer" },
      { id: "factions", label: "Frakcje", icon: "shield" },
      { id: "achievements", label: "Osiągnięcia", icon: "trophy" },
    ],
  },
  {
    id: "settings-group",
    label: "Ustawienia",
    items: [
      { id: "settings", label: "Ustawienia systemu", icon: "settings" },
      { id: "feedback", label: "Zgłoś błąd", icon: "bug" },
      { id: "accounts", label: "Konta", icon: "users", devOnly: true },
      { id: "notices", label: "Ogłoszenia", icon: "megaphone", mainDevOnly: true },
      { id: "about", label: "O aplikacji", icon: "info" },
      { id: "credits", label: "Autorzy", icon: "heart" },
    ],
  },
];

function canSeeNavItem(item: { devOnly?: boolean; betaOnly?: boolean; mainDevOnly?: boolean }, rank: AccountRank | AccountRank[] | null) {
  const ranks = Array.isArray(rank) ? rank : rank ? [rank] : [];
  if (item.mainDevOnly && !hasMainDeveloperAccess(ranks)) return false;
  if (item.devOnly && !hasDeveloperAccess(ranks)) return false;
  if (item.betaOnly && !hasBetaAccess(ranks)) return false;
  return true;
}

function withBetaBadge<T extends { betaOnly?: boolean; badge?: string }>(item: T): T {
  if (!item.betaOnly) return item;
  return { ...item, badge: item.badge || "BETA" };
}

export function canAccessRoute(route: RouteId, rank: AccountRank | AccountRank[] | null) {
  const ranks = Array.isArray(rank) ? rank : rank ? [rank] : [];
  if (route === "accounts") return hasDeveloperAccess(ranks);
  if (route === "notices") return hasMainDeveloperAccess(ranks);
  return true;
}

export function visibleNavGroups(rank: AccountRank | AccountRank[] | null): NavGroup[] {
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
  clicker: ["Dashboard", "Gra", "Auto clicker"],
  settings: ["Dashboard", "Ustawienia systemu"],
  accounts: ["Dashboard", "Ustawienia", "Konta"],
  notices: ["Dashboard", "Ustawienia", "Ogłoszenia"],
  about: ["Dashboard", "O aplikacji"],
  credits: ["Dashboard", "Autorzy"],
  craft: ["Dashboard", "Craft"],
  factions: ["Dashboard", "Frakcje"],
  forum: ["Dashboard", "Forum"],
  feedback: ["Dashboard", "Ustawienia", "Zgłoś błąd"],
  achievements: ["Dashboard", "Osiągnięcia"],
};

export const pageMeta: Record<RouteId, { title: string; subtitle?: string }> = {
  home: { title: "Dashboard" },
  cmd: { title: "CMD Executor", subtitle: "Wyślij serię komend do wybranego procesu gry" },
  overlay: { title: "Nakładka", subtitle: "Skonfiguruj nakładkę gry i powiadomienia" },
  macros: { title: "Makra" },
  counters: { title: "Statystyki" },
  clicker: { title: "Auto clicker", subtitle: "Uzbrój suwakiem, start wybranym przyciskiem" },
  settings: { title: "Ustawienia systemu" },
  accounts: { title: "Konta", subtitle: "Konta Discord zalogowane w ARIES" },
  notices: { title: "Ogłoszenia" },
  about: { title: "O aplikacji", subtitle: "ARIES — prywatny panel administracyjny" },
  credits: { title: "Autorzy" },
  craft: { title: "Craft", subtitle: "Tabela krafta frakcji — Majestic Wiki" },
  factions: { title: "Frakcje", subtitle: "Liderzy i status aktywności" },
  forum: { title: "Forum", subtitle: "Regulamin serwera w panelu" },
  feedback: { title: "Zgłoś błąd", subtitle: "Zgłoś błąd albo nową sugestię — developerzy to zobaczą" },
  achievements: { title: "Osiągnięcia", subtitle: "Trudne zadania, punkty i dolary do gry" },
};
