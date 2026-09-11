export type CraftItem = {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  type: string;
  materials: number;
  materialType: string;
  weight: number;
  maxStack: number;
  fractions: string[];
  groupId: number;
};

export const CRAFT_FRACTIONS: { id: string; label: string; color: string }[] = [
  { id: "lspd", label: "LSPD", color: "#FFC130" },
  { id: "lscsd", label: "LSCSD", color: "#D9B47C" },
  { id: "ems", label: "EMS", color: "#E12020" },
  { id: "army", label: "SANG", color: "#BBAA7E" },
  { id: "gov", label: "GOV", color: "#1A6FC4" },
  { id: "wn", label: "WN", color: "#E85D75" },
  { id: "fib", label: "FIB", color: "#808080" },
  { id: "ballas", label: "Ballas", color: "#7B3FA0" },
  { id: "vagos", label: "Vagos", color: "#E6C200" },
  { id: "families", label: "Rodziny", color: "#2E9B45" },
  { id: "bloods", label: "Bloods", color: "#C41E3A" },
  { id: "marabunta", label: "Marabunta", color: "#2BB3C7" },
];

export function fractionMeta(id: string) {
  return CRAFT_FRACTIONS.find((row) => row.id === id) ?? { id, label: id, color: "#888" };
}
