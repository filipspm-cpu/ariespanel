export type FactionGroup = "state" | "gang";

export type FactionDef = {
  id: string;
  name: string;
  short: string;
  color: string;
  group: FactionGroup;
};

export const FACTIONS: FactionDef[] = [
  { id: "lspd", name: "Los Santos Police Department", short: "LSPD", color: "#FFC130", group: "state" },
  { id: "ems", name: "Emergency Medical Services", short: "EMS", color: "#E12020", group: "state" },
  { id: "lscsd", name: "Los Santos County Sheriff Department", short: "LSCSD", color: "#D9B47C", group: "state" },
  { id: "sang", name: "San Andreas National Guard", short: "SANG", color: "#BBAA7E", group: "state" },
  { id: "gov", name: "Government", short: "GOV", color: "#1A6FC4", group: "state" },
  { id: "wn", name: "Weazel News", short: "WN", color: "#E85D75", group: "state" },
  { id: "fib", name: "Federal Investigation Bureau", short: "FIB", color: "#808080", group: "state" },
  { id: "ballas", name: "The Ballas Gang", short: "Ballas", color: "#7B3FA0", group: "gang" },
  { id: "vagos", name: "Los Santos Vagos", short: "Vagos", color: "#E6C200", group: "gang" },
  { id: "families", name: "The Families", short: "Families", color: "#2E9B45", group: "gang" },
  { id: "bloods", name: "The Bloods Gang", short: "Bloods", color: "#C41E3A", group: "gang" },
  { id: "marabunta", name: "Marabunta Grande", short: "Marabunta", color: "#2BB3C7", group: "gang" },
];

export const FACTION_GROUPS: { id: FactionGroup; label: string }[] = [
  { id: "state", label: "Frakcje państwowe" },
  { id: "gang", label: "Gangi" },
];

export type FactionRecord = {
  id: string;
  leader: string;
  frozen: boolean;
  updatedAt?: string;
};

export type FactionView = FactionDef & {
  leader: string;
  frozen: boolean;
};

export function mergeFactions(rows: FactionRecord[] | undefined): FactionView[] {
  const byId = new Map((rows || []).map((row) => [row.id, row]));
  return FACTIONS.map((faction) => {
    const row = byId.get(faction.id);
    return {
      ...faction,
      leader: String(row?.leader || "").trim(),
      frozen: Boolean(row?.frozen),
    };
  });
}
