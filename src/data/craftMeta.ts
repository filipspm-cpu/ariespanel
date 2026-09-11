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

export const CRAFT_FRACTIONS: { id: string; label: string; color: string; gameId: number }[] = [
  { id: "lspd", label: "LSPD", color: "#FFC130", gameId: 1 },
  { id: "ems", label: "EMS", color: "#E12020", gameId: 2 },
  { id: "lscsd", label: "LSCSD", color: "#D9B47C", gameId: 3 },
  { id: "army", label: "SANG", color: "#BBAA7E", gameId: 4 },
  { id: "gov", label: "GOV", color: "#1A6FC4", gameId: 5 },
  { id: "wn", label: "WN", color: "#E85D75", gameId: 6 },
  { id: "fib", label: "FIB", color: "#808080", gameId: 7 },
  { id: "bloods", label: "Bloods", color: "#C41E3A", gameId: 8 },
  { id: "vagos", label: "Vagos", color: "#E6C200", gameId: 9 },
  { id: "ballas", label: "Ballas", color: "#7B3FA0", gameId: 10 },
  { id: "families", label: "Rodziny", color: "#2E9B45", gameId: 11 },
  { id: "marabunta", label: "Marabunta", color: "#2BB3C7", gameId: 12 },
];

export const MATERIAL_TYPES: Record<string, { label: string; color: string }> = {
  green: { label: "green", color: "#73CC72" },
  blue: { label: "blue", color: "#4EA0FF" },
  red: { label: "red", color: "#E45B5B" },
};

export function materialMeta(type: string) {
  return MATERIAL_TYPES[type] ?? { label: type, color: "#fff" };
}

export function fractionMeta(id: string) {
  return (
    CRAFT_FRACTIONS.find((row) => row.id === id) ?? {
      id,
      label: id,
      color: "#888",
      gameId: 0,
    }
  );
}

export const MATERIAL_KEYS = ["green", "blue", "red"] as const;
export type MaterialKey = (typeof MATERIAL_KEYS)[number];
export type MaterialStock = Record<MaterialKey, number>;

export const EMPTY_STOCK: MaterialStock = { green: 0, blue: 0, red: 0 };

export function asStock(input: Partial<MaterialStock> | undefined): MaterialStock {
  return {
    green: Number(input?.green) || 0,
    blue: Number(input?.blue) || 0,
    red: Number(input?.red) || 0,
  };
}

export function gramsToKg(grams: number) {
  return grams / 1000;
}

export function formatKg(grams: number) {
  const kg = gramsToKg(grams);
  const text = Number.isInteger(kg) ? String(kg) : kg.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return `${text} kg`;
}
