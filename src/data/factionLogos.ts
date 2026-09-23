import lspd from "@/assets/factions/lspd.png";
import ems from "@/assets/factions/ems.png";
import lscsd from "@/assets/factions/lscsd.png";
import sang from "@/assets/factions/sang.png";
import gov from "@/assets/factions/gov.png";
import wn from "@/assets/factions/wn.png";
import fib from "@/assets/factions/fib.png";
import ballas from "@/assets/factions/ballas.png";
import vagos from "@/assets/factions/vagos.png";
import families from "@/assets/factions/families.png";
import bloods from "@/assets/factions/bloods.png";
import marabunta from "@/assets/factions/marabunta.png";
import { forumRuleById } from "@/data/forumRules";

export const FACTION_LOGOS: Record<string, string> = {
  lspd,
  ems,
  lscsd,
  sang,
  gov,
  wn,
  fib,
  ballas,
  vagos,
  families,
  bloods,
  marabunta,
};

const FORUM_TARGET: Record<string, { ruleId: string; line: string }> = {
  lspd: { ruleId: "frakcje", line: "6. LSPD / LSCSD" },
  lscsd: { ruleId: "frakcje", line: "6. LSPD / LSCSD" },
  ems: { ruleId: "frakcje", line: "1. Zasady ogólne" },
  sang: { ruleId: "frakcje", line: "7. SA National Guard" },
  gov: { ruleId: "frakcje", line: "3. Rząd" },
  wn: { ruleId: "frakcje", line: "10. Weazel News" },
  fib: { ruleId: "frakcje", line: "5. FIB" },
  ballas: { ruleId: "org", line: "" },
  vagos: { ruleId: "org", line: "" },
  families: { ruleId: "org", line: "" },
  bloods: { ruleId: "org", line: "" },
  marabunta: { ruleId: "org", line: "" },
};

export function factionIdsForLine(line: string): string[] {
  const text = line.trim().replace(/:$/, "");
  if (!text || text.length > 70) return [];
  if (text === "3. Rząd" || text === "Zadania i obowiązki Rządu") return ["gov"];
  if (text === "5. FIB" || text === "Zadania i obowiązki FIB") return ["fib"];
  if (text === "6. LSPD / LSCSD" || text === "Zadania i obowiązki LSPD / LSCSD") return ["lspd", "lscsd"];
  if (text === "7. SA National Guard" || text === "Zasady SANG") return ["sang"];
  if (text === "10. Weazel News") return ["wn"];
  return [];
}

export function factionForumFocus(id: string) {
  const target = FORUM_TARGET[id] ?? { ruleId: "frakcje", line: "" };
  const body = forumRuleById(target.ruleId).body.replace(/\r\n/g, "\n");
  const start = target.line
    ? body.split("\n").findIndex((line) => line.trim() === target.line)
    : 0;
  const lineIndex = start < 0 ? 0 : start;
  return { ruleId: target.ruleId, start: lineIndex, end: lineIndex };
}
