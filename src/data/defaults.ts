import type { Counter, Macro, MacroFolder } from "@/types";

export const defaultFolders: MacroFolder[] = [{ id: "folder-general", name: "Ogólne" }];

export const defaultMacros: Macro[] = [];

export const defaultCounters: Counter[] = [
  {
    id: "ticket",
    name: "Reporty",
    description: "Odebrane zgłoszenia",
    value: 0,
    color: "purple",
    shortcut: "F8",
    showInOverlay: true,
    history: [],
  },
  {
    id: "event-specs",
    name: "Event Specs",
    description: "Specyfikacje eventów",
    value: 0,
    color: "green",
    shortcut: "F9",
    showInOverlay: true,
    history: [],
  },
];
