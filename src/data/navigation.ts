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
          { id: "counters", label: "Liczniki", icon: "gauge" },
        ],
      },
    ],
  },
  {
    id: "admin",
    label: "Administracja",
    items: [{ id: "settings", label: "Ustawienia systemu", icon: "settings" }],
  },
  {
    id: "docs",
    label: "Dokumentacja",
    items: [
      { id: "about", label: "O aplikacji", icon: "info" },
      { id: "credits", label: "Podziękowania", icon: "heart" },
    ],
  },
];

export const breadcrumbs: Record<RouteId, string[]> = {
  home: ["Dashboard"],
  cmd: ["Dashboard", "Game", "Cmd"],
  overlay: ["Dashboard", "Game", "Overlay"],
  macros: ["Dashboard", "Gra", "Makra"],
  counters: ["Dashboard", "Game", "Counters"],
  settings: ["Dashboard", "Ustawienia systemu"],
  about: ["Dashboard", "O aplikacji"],
  credits: ["Dashboard", "Podziękowania"],
};

export const pageMeta: Record<RouteId, { title: string; subtitle?: string }> = {
  home: { title: "Dashboard" },
  cmd: { title: "CMD Executor", subtitle: "Wyślij serię komend do wybranego procesu gry" },
  overlay: { title: "Nakładka", subtitle: "Skonfiguruj nakładkę gry i powiadomienia" },
  macros: { title: "Makra" },
  counters: { title: "Liczniki" },
  settings: { title: "Ustawienia systemu" },
  about: { title: "O aplikacji", subtitle: "ARIES — prywatny panel administracyjny" },
  credits: { title: "Podziękowania" },
};
