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
];

let cached: Tester[] = [];
let loaded = false;

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
      const item = row as {
        id?: string;
        discord_id?: string;
        name?: string;
        discord?: string;
        rank?: string;
        role?: string;
        ranks?: unknown;
      };
      const id = String(item.id || item.discord_id || "").replace(/\D/g, "");
      const ranks = Array.isArray(item.ranks)
        ? item.ranks.map((value) => String(value || "").trim()).filter(Boolean)
        : [];
      const rank = ranks.length ? ranks.join(",") : String(item.rank || item.role || "").trim();
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
  loaded = true;
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

function payloadOk(payload: unknown): payload is { roles: unknown[] } {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      (payload as { ok?: unknown }).ok === true &&
      Array.isArray((payload as { roles?: unknown }).roles),
  );
}

export function loadTesters(): Tester[] {
  if (loaded) return cached;
  cached = readCache();
  loaded = true;
  if (!cached.length) cached = FALLBACK_ROLES;
  return cached;
}

export function ingestRolesPayload(payload: unknown): Tester[] {
  if (!payloadOk(payload)) return loadTesters();
  writeCache(parseRoles(payload));
  return loadTesters();
}

export async function refreshAccountRoles(): Promise<Tester[]> {
  const payload = await apiRequest("GET");
  return ingestRolesPayload(payload);
}

function isMainDeveloperToken(part: string) {
  const token = part.trim().toLowerCase().replace(/[_\s]+/g, "-");
  return token === "m-dev" || token === "mdev" || token.includes("main-dev");
}

function roleHasMainDeveloper(role: string) {
  return role.split(/[,|/]+/).some((part) => isMainDeveloperToken(part));
}

export async function setAccountRank(id: string, rank: string, name?: string): Promise<Tester[]> {
  const prev = loadTesters().find((row) => row.id === id);
  const hadMain = Boolean(prev && roleHasMainDeveloper(prev.role));
  const ranks = rank
    .split(/[,|/]+/)
    .map((part) => part.trim())
    .filter((part) => part && !isMainDeveloperToken(part));
  const payload = await apiRequest("POST", {
    action: "setRank",
    id,
    rank: ranks.join(","),
    ranks,
    name: name || "",
  });
  if (payloadOk(payload)) {
    ingestRolesPayload(payload);
  } else {
    const next = loadTesters().filter((row) => row.id !== id);
    const normalized = ranks
      .map((part) => {
        const token = part.trim().toLowerCase().replace(/[_\s]+/g, "-");
        if (isMainDeveloperToken(token)) return "";
        if (token.includes("dev")) return "developer";
        if (token.includes("vip")) return "vip";
        if (token.includes("beta")) return "beta";
        return "";
      })
      .filter(Boolean);
    const unique: Array<"main-developer" | "developer" | "vip" | "beta"> = [];
    for (const item of normalized) {
      if (item === "developer" || item === "vip" || item === "beta") unique.push(item);
    }
    if (hadMain) unique.unshift("main-developer");
    if (unique.length) {
      next.push({
        id,
        name: name || prev?.name || "Konto",
        discord: prev?.discord || "",
        role: unique.join(","),
      });
    }
    writeCache(next);
  }
  return loadTesters();
}

export function isBetaTesterId(discordId: string | undefined) {
  if (!discordId) return false;
  const id = discordId.replace(/\D/g, "");
  if (!id) return false;
  return loadTesters().some((t) => t.id === id && (/beta/i.test(t.role) || /dev/i.test(t.role)));
}
