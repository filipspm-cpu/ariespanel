import fs from "fs";
import path from "path";
import { app } from "electron";
import mysql from "mysql2/promise";
import { apiRequest } from "./accountsApi";
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

const DB = {
  host: "host425499.lh.pl",
  user: "host425499_ariespanel",
  password: "Wu8BzxevpdGr86f5WrXr",
  database: "host425499_ariespanel",
};

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

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function mysqlConn() {
  return mysql.createConnection({
    host: DB.host,
    port: 3306,
    user: DB.user,
    password: DB.password,
    database: DB.database,
    connectTimeout: 4000,
  });
}

async function ensureTable(conn: mysql.Connection) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS panel_factions (
      id VARCHAR(32) NOT NULL PRIMARY KEY,
      leader VARCHAR(64) NOT NULL DEFAULT '',
      frozen TINYINT NOT NULL DEFAULT 0,
      updated_by VARCHAR(191) NOT NULL DEFAULT '',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function mysqlList(): Promise<FactionRecord[] | null> {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    const [rows] = await conn.query("SELECT id, leader, frozen, updated_at FROM panel_factions");
    const stored: Record<string, StoredRow> = {};
    for (const item of rows as { id?: string; leader?: string; frozen?: number; updated_at?: string }[]) {
      const id = String(item.id || "").trim();
      if (!knownId(id)) continue;
      const updated = item.updated_at ? new Date(item.updated_at) : null;
      stored[id] = {
        leader: cleanLeader(item.leader),
        frozen: Number(item.frozen) === 1,
        updatedAt: updated && !Number.isNaN(updated.getTime()) ? updated.toISOString() : "",
      };
    }
    return merge(stored);
  } catch {
    return null;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

async function mysqlSave(id: string, leader: string, frozen: boolean, updatedBy: string) {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    await conn.execute(
      `INSERT INTO panel_factions (id, leader, frozen, updated_by) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE leader = VALUES(leader), frozen = VALUES(frozen), updated_by = VALUES(updated_by)`,
      [id, leader, frozen ? 1 : 0, updatedBy],
    );
    return true;
  } catch {
    return false;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

function cache(factions: FactionRecord[]) {
  const current = readRows();
  const next = { ...current, ...rowsFromList(factions) };
  writeRows(next);
}

export async function listFactions(): Promise<FactionsResult> {
  const { discordId } = caller();
  const editor = isMainDeveloper(discordId);
  const remote = await apiRequest("POST", { action: "factionsList", discordId }).catch(() => null);
  const remoteRows = parseRemote(remote);
  if (remoteRows && (remote as { ok?: unknown }).ok !== false) {
    cache(remoteRows);
    return result(true, editor, remoteRows);
  }
  const sql = await mysqlList();
  if (sql) {
    cache(sql);
    return result(true, editor, sql);
  }
  return result(true, editor, merge(readRows()));
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
  const remote = await apiRequest("POST", {
    action: "factionsSave",
    discordId,
    name,
    id,
    leader,
    frozen,
  }).catch(() => null);
  const remoteRows = parseRemote(remote);
  if (remoteRows && (remote as { ok?: unknown }).ok === true) {
    cache(remoteRows);
    return result(true, true, remoteRows);
  }
  const saved = await mysqlSave(id, leader, frozen, name);
  if (saved) return listFactions();
  const rows = readRows();
  rows[id] = { leader, frozen, updatedAt: new Date().toISOString() };
  writeRows(rows);
  return result(true, true, merge(rows));
}
