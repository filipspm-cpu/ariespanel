import fs from "fs";
import path from "path";
import { app } from "electron";
import { apiRequestUrls } from "./accountsApi";
import { loadState } from "./storage";
import { loadTesters } from "./testers";

export type FactionRecord = {
  id: string;
  leader: string;
  frozen: boolean;
  updatedAt: string;
};

export type FactionsResult = {
  ok: boolean;
  editor: boolean;
  factions: FactionRecord[];
  error?: string;
};

const IDS = [
  "lspd",
  "ems",
  "lscsd",
  "sang",
  "gov",
  "wn",
  "fib",
  "ballas",
  "vagos",
  "families",
  "bloods",
  "marabunta",
] as const;

const FACTION_URLS = [
  "https://filipekweb.pl/aries/factions.php",
  "https://www.filipekweb.pl/aries/factions.php",
  "https://filipekweb.pl/aries/accounts.php",
  "https://www.filipekweb.pl/aries/accounts.php",
];

type StoredRow = {
  leader: string;
  frozen: boolean;
  updatedAt: string;
};

function localPath() {
  return path.join(app.getPath("userData"), "panel-factions.json");
}

function knownId(id: string) {
  return (IDS as readonly string[]).includes(id);
}

function cleanLeader(raw: unknown) {
  return String(raw || "")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 64);
}

function asFrozen(raw: unknown) {
  return raw === true || raw === 1 || raw === "1" || raw === "true";
}

function asRow(raw: unknown): StoredRow | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as { leader?: unknown; frozen?: unknown; updatedAt?: unknown; updated_at?: unknown };
  return {
    leader: cleanLeader(item.leader),
    frozen: asFrozen(item.frozen),
    updatedAt: String(item.updatedAt || item.updated_at || ""),
  };
}

function readRows(): Record<string, StoredRow> {
  try {
    const raw = JSON.parse(fs.readFileSync(localPath(), "utf8")) as unknown;
    const source =
      raw && typeof raw === "object" && !Array.isArray(raw) && (raw as { rows?: unknown }).rows
        ? (raw as { rows: unknown }).rows
        : raw;
    const map: Record<string, StoredRow> = {};
    if (Array.isArray(source)) {
      for (const item of source) {
        const id = String((item as { id?: unknown })?.id || "").trim();
        const row = asRow(item);
        if (knownId(id) && row) map[id] = row;
      }
      return map;
    }
    if (!source || typeof source !== "object") return {};
    for (const [id, value] of Object.entries(source as Record<string, unknown>)) {
      const row = asRow(value);
      if (knownId(id) && row) map[id] = row;
    }
    return map;
  } catch {
    return {};
  }
}

function writeRows(rows: Record<string, StoredRow>) {
  fs.writeFileSync(localPath(), JSON.stringify({ rows }, null, 2), "utf8");
}

function merge(rows: Record<string, StoredRow>): FactionRecord[] {
  return IDS.map((id) => ({
    id,
    leader: rows[id]?.leader || "",
    frozen: Boolean(rows[id]?.frozen),
    updatedAt: rows[id]?.updatedAt || "",
  }));
}

function rowsFromList(list: FactionRecord[]) {
  const rows: Record<string, StoredRow> = {};
  for (const item of list) {
    if (!knownId(item.id)) continue;
    rows[item.id] = { leader: item.leader, frozen: item.frozen, updatedAt: item.updatedAt };
  }
  return rows;
}

function parseRemote(payload: unknown): FactionRecord[] | null {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { factions?: unknown }).factions)) {
    return null;
  }
  const rows: Record<string, StoredRow> = {};
  for (const item of (payload as { factions: unknown[] }).factions) {
    const id = String((item as { id?: unknown })?.id || "").trim();
    const row = asRow(item);
    if (knownId(id) && row) rows[id] = row;
  }
  return merge(rows);
}

function caller() {
  const settings = loadState().settings;
  return {
    discordId: String(settings.discordId || "").replace(/\D/g, ""),
    name: String(settings.discordGlobalName || settings.username || "Konto").slice(0, 191),
  };
}

function isMainDeveloper(id: string) {
  if (!id) return false;
  return loadTesters().some((row) => row.id === id && /main-dev|m-dev|mdev/i.test(row.role));
}

function result(ok: boolean, editor: boolean, factions: FactionRecord[], error?: string): FactionsResult {
  return { ok, editor, factions, error };
}

function cache(factions: FactionRecord[]) {
  writeRows(rowsFromList(factions));
}

function remoteError(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  return String((payload as { error?: unknown }).error || "");
}

async function remoteFactions(body: Record<string, unknown>) {
  return apiRequestUrls(FACTION_URLS, "POST", body, (payload) => parseRemote(payload) !== null);
}

export async function listFactions(): Promise<FactionsResult> {
  const { discordId } = caller();
  const editor = isMainDeveloper(discordId);
  const remote = await remoteFactions({ action: "factionsList", discordId }).catch(() => null);
  const remoteRows = parseRemote(remote);
  if (remoteRows && (remote as { ok?: unknown }).ok !== false) {
    cache(remoteRows);
    return result(true, editor, remoteRows);
  }
  const cached = merge(readRows());
  const synced = cached.some((row) => row.leader || row.frozen || row.updatedAt);
  return result(false, editor, cached, synced ? "offline" : "server");
}

export async function saveFaction(input: { id?: string; leader?: string; frozen?: unknown }): Promise<FactionsResult> {
  const { discordId, name } = caller();
  const editor = isMainDeveloper(discordId);
  if (!discordId) return { ...(await listFactions()), ok: false, error: "login" };
  if (!editor) return { ...(await listFactions()), ok: false, editor: false, error: "forbidden" };
  const id = String(input.id || "").trim();
  if (!knownId(id)) return { ...(await listFactions()), ok: false, error: "invalid" };
  const leader = cleanLeader(input.leader);
  const frozen = asFrozen(input.frozen);
  const remote = await remoteFactions({
    action: "factionsSave",
    discordId,
    name,
    id,
    leader,
    frozen,
  }).catch(() => null);
  const remoteRows = parseRemote(remote);
  const err = remoteError(remote);
  if (remoteRows && (remote as { ok?: unknown }).ok === true) {
    cache(remoteRows);
    return result(true, true, remoteRows);
  }
  const listed = remoteRows ? result(false, true, remoteRows, err || "server") : await listFactions();
  return { ...listed, ok: false, editor: true, error: err || listed.error || "server" };
}
