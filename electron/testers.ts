import fs from "fs";
import path from "path";
import { app } from "electron";
import { apiRequest } from "./accountsApi";

export type Tester = {
  name: string;
  discord: string;
  id: string;
  role: string;
};

const FALLBACK_ROLES: Tester[] = [
  { id: "1305449847125708811", name: "Filipek", discord: "filipek_wita", role: "developer" },
  { id: "1039967564664676412", name: "Rysiasty", discord: "rysiowsky", role: "developer" },
  { id: "1200264556354752565", name: "wisniofka", discord: "wisniofka", role: "beta" },
  { id: "584315259360247808", name: "bartssv", discord: "bartssv", role: "beta" },
  { id: "352473379326001152", name: "Dorek", discord: ".dorek.", role: "beta" },
];

let cached: Tester[] = [];

function cachePath() {
  return path.join(app.getPath("userData"), "account-roles.json");
}

function parseRoles(payload: unknown): Tester[] {
  const rows =
    payload && typeof payload === "object" && Array.isArray((payload as { roles?: unknown }).roles)
      ? (payload as { roles: unknown[] }).roles
      : [];
  return rows
    .map((row) => {
      const item = row as { id?: string; discord_id?: string; name?: string; discord?: string; rank?: string; role?: string };
      const id = String(item.id || item.discord_id || "").replace(/\D/g, "");
      const rank = String(item.rank || item.role || "").trim();
      if (!id || !rank) return null;
      return {
        id,
        name: String(item.name || "").trim() || "Konto",
        discord: String(item.discord || "").trim(),
        role: rank,
      };
    })
    .filter((row): row is Tester => Boolean(row));
}

function writeCache(rows: Tester[]) {
  cached = rows;
  try {
    fs.writeFileSync(cachePath(), JSON.stringify(rows, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

function readCache(): Tester[] {
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath(), "utf8")) as Tester[];
    return Array.isArray(raw) ? raw.filter((row) => row?.id && row?.role) : [];
  } catch {
    return [];
  }
}

function withFallback(rows: Tester[]): Tester[] {
  const map = new Map(rows.map((row) => [row.id, row]));
  for (const seed of FALLBACK_ROLES) {
    if (!map.has(seed.id)) map.set(seed.id, seed);
  }
  return [...map.values()];
}

export function loadTesters(): Tester[] {
  if (cached.length) return cached;
  cached = withFallback(readCache());
  return cached;
}

export function ingestRolesPayload(payload: unknown): Tester[] {
  const roles = parseRoles(payload);
  if (roles.length) writeCache(withFallback(roles));
  return loadTesters();
}

export async function refreshAccountRoles(): Promise<Tester[]> {
  const payload = await apiRequest("GET");
  return ingestRolesPayload(payload);
}

export async function setAccountRank(id: string, rank: string, name?: string): Promise<Tester[]> {
  const payload = await apiRequest("POST", {
    action: "setRank",
    id,
    rank,
    name: name || "",
  });
  ingestRolesPayload(payload);
  if (!loadTesters().length) await refreshAccountRoles();
  return loadTesters();
}

export function isBetaTesterId(discordId: string | undefined) {
  if (!discordId) return false;
  return loadTesters().some((t) => t.id === discordId && (/beta/i.test(t.role) || /dev/i.test(t.role)));
}
