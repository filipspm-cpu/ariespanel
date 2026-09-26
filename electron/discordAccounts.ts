import fs from "fs";
import path from "path";
import { app } from "electron";
import mysql from "mysql2/promise";
import { apiRequest } from "./accountsApi";
import { loadPromoDevice } from "./promoDevice";
import { loadState } from "./storage";
import { ingestRolesPayload, loadTesters } from "./testers";

export type DiscordAccountCard = {
  id: string;
  name: string;
  avatarUrl: string;
  ip: string;
  lastLogin: string;
  rank: string;
  banned: boolean;
};

type StoredAccount = DiscordAccountCard & { id: string };

const DB = {
  host: "host425499.lh.pl",
  user: "host425499_ariespanel",
  password: "Wu8BzxevpdGr86f5WrXr",
  database: "host425499_ariespanel",
};

function cardName(profile: { globalName?: string; username?: string; name?: string }) {
  return (profile.name || profile.globalName || profile.username || "Konto").trim() || "Konto";
}

function defaultAvatarUrl(id: string) {
  if (!/^\d+$/.test(id)) return "";
  try {
    const index = Number(BigInt(id) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
}

function parseAccountId(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/[a-zA-Z]/.test(raw)) {
    const safe = raw.replace(/[^a-zA-Z0-9_-]/g, "");
    return safe.length >= 8 ? safe : "";
  }
  return raw.replace(/\D/g, "");
}

function localPath() {
  return path.join(app.getPath("userData"), "discord-accounts.json");
}

function readLocal(): StoredAccount[] {
  try {
    const raw = JSON.parse(fs.readFileSync(localPath(), "utf8")) as StoredAccount[];
    return Array.isArray(raw) ? raw.filter((row) => row?.id && row?.name) : [];
  } catch {
    return [];
  }
}

function writeLocal(rows: StoredAccount[]) {
  fs.writeFileSync(localPath(), JSON.stringify(rows, null, 2), "utf8");
}

function newerLogin(a?: string, b?: string) {
  const ta = Date.parse(a || "") || 0;
  const tb = Date.parse(b || "") || 0;
  if (tb > ta) return b || "";
  return a || b || "";
}

function upsertLocal(account: StoredAccount) {
  const prev = readLocal().find((row) => row.id === account.id);
  const merged: StoredAccount = {
    id: account.id,
    name: account.name || prev?.name || "Konto",
    avatarUrl: account.avatarUrl || prev?.avatarUrl || "",
    ip: "",
    lastLogin: newerLogin(account.lastLogin, prev?.lastLogin),
    rank: account.rank || prev?.rank || "",
    banned: Boolean(account.banned || prev?.banned),
  };
  const rows = readLocal().filter((row) => row.id !== account.id);
  rows.unshift(merged);
  writeLocal(rows.slice(0, 500));
  return merged;
}

function asLogin(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const raw = String(value).trim();
  if (!raw || raw === "null" || raw === "undefined") return "";
  const time = Date.parse(raw);
  if (Number.isNaN(time)) return "";
  return new Date(time).toISOString();
}

function asAvatar(value: unknown): string {
  const url = String(value || "").trim();
  if (!url || url.includes("/embed/avatars/")) return "";
  return url;
}

function parseAccounts(payload: unknown): StoredAccount[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { accounts?: unknown }).accounts)
      ? (payload as { accounts: unknown[] }).accounts
      : [];
  return rows
    .map((row) => {
      const item = row as {
        id?: string;
        discord_id?: string;
        device_id?: string;
        name?: string;
        avatarUrl?: string;
        avatar_url?: string;
        lastLogin?: string;
        last_login?: string;
        updated_at?: string;
        banned?: boolean;
      };
      const id = parseAccountId(item.id || item.discord_id || item.device_id);
      const name = String(item.name || "").trim();
      if (!id || !name) return null;
      return {
        id,
        name,
        avatarUrl: asAvatar(item.avatarUrl || item.avatar_url),
        ip: "",
        lastLogin: asLogin(item.lastLogin || item.last_login || item.updated_at),
        rank: "",
        banned: Boolean(item.banned),
      };
    })
    .filter((row): row is StoredAccount => Boolean(row));
}

function knownAccounts(): StoredAccount[] {
  return [
    { id: "1305449847125708811", name: "Filipek", discord: "filipek_wita" },
    { id: "1039967564664676412", name: "Rysiasty", discord: "rysiowsky" },
    { id: "1200264556354752565", name: "wisniofka", discord: "wisniofka" },
    { id: "584315259360247808", name: "bartssv", discord: "bartssv" },
    { id: "352473379326001152", name: "Dorek", discord: ".dorek." },
  ].map((person) => ({
    id: person.id,
    name: person.name,
    avatarUrl: defaultAvatarUrl(person.id),
    ip: "",
    lastLogin: "",
    rank: "",
    banned: false,
  }));
}

function mergeById(...lists: StoredAccount[][]) {
  const map = new Map<string, StoredAccount>();
  for (const list of lists) {
    for (const row of list) {
      const prev = map.get(row.id);
      if (!prev) {
        map.set(row.id, {
          ...row,
          avatarUrl: asAvatar(row.avatarUrl),
          lastLogin: asLogin(row.lastLogin),
          banned: Boolean(row.banned),
        });
        continue;
      }
      map.set(row.id, {
        id: row.id,
        name: prev.name || row.name,
        avatarUrl: asAvatar(prev.avatarUrl) || asAvatar(row.avatarUrl),
        ip: "",
        lastLogin: newerLogin(asLogin(prev.lastLogin), asLogin(row.lastLogin)),
        rank: prev.rank || row.rank || "",
        banned: Boolean(prev.banned || row.banned),
      });
    }
  }
  return [...map.values()];
}

function toCards(rows: StoredAccount[]): DiscordAccountCard[] {
  return rows.map(({ id, name, avatarUrl, ip, lastLogin, rank, banned }) => ({
    id,
    name,
    avatarUrl: asAvatar(avatarUrl) || defaultAvatarUrl(id),
    ip: ip || "",
    lastLogin: asLogin(lastLogin),
    rank: rank || "",
    banned: Boolean(banned),
  }));
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
    CREATE TABLE IF NOT EXISTS discord_accounts (
      discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL,
      avatar_url VARCHAR(512) NOT NULL,
      ip VARCHAR(45) NOT NULL DEFAULT '',
      last_login TIMESTAMP NULL DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await conn.query("ALTER TABLE discord_accounts ADD COLUMN ip VARCHAR(45) NOT NULL DEFAULT ''").catch(() => undefined);
  await conn.query("ALTER TABLE discord_accounts ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL").catch(() => undefined);
}

async function mysqlUpsert(account: StoredAccount): Promise<boolean> {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    await conn.execute(
      `INSERT INTO discord_accounts (discord_id, name, avatar_url, last_login) VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url), ip = '', last_login = NOW()`,
      [account.id, account.name, account.avatarUrl],
    );
    return true;
  } catch {
    return false;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

async function mysqlList(): Promise<StoredAccount[]> {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    const [rows] = await conn.query(
      "SELECT discord_id, name, avatar_url, last_login, updated_at FROM discord_accounts ORDER BY COALESCE(last_login, updated_at) DESC, name ASC",
    );
    return parseAccounts(rows);
  } catch {
    return [];
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

async function mysqlProfiles(): Promise<StoredAccount[]> {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    const [rows] = await conn.query(
      `SELECT discord_id AS id, name, updated_at AS last_login
       FROM panel_profiles
       WHERE discord_id IS NOT NULL AND TRIM(discord_id) <> '' AND name IS NOT NULL AND TRIM(name) <> ''`,
    );
    return parseAccounts(rows).filter((row) => /^\d{5,}$/.test(row.id));
  } catch {
    return [];
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

export async function recordDiscordAccount(
  profile: {
    id?: string;
    username?: string;
    globalName?: string;
    name?: string;
    avatarUrl?: string;
  },
  opts?: { login?: boolean },
): Promise<void> {
  const id = String(profile.id || "").replace(/\D/g, "");
  const name = cardName(profile).slice(0, 191);
  const avatarUrl = String(profile.avatarUrl || "").slice(0, 512);
  if (!id || !name) return;
  const prev = readLocal().find((row) => row.id === id);
  const captureLogin = Boolean(opts?.login || !prev?.lastLogin);
  const lastLogin = captureLogin ? new Date().toISOString() : "";
  const account = upsertLocal({ id, name, avatarUrl, ip: "", lastLogin, rank: "", banned: Boolean(prev?.banned) });
  await Promise.all([mysqlUpsert(account), apiRequest("POST", { id, name, avatarUrl })]);
}

export async function listDiscordAccounts(): Promise<DiscordAccountCard[]> {
  try {
    const [sql, php, profiles] = await Promise.all([
      mysqlList(),
      apiRequest("GET").catch(() => null),
      mysqlProfiles(),
    ]);
    if (php) ingestRolesPayload(php);
    const rows = mergeById(parseAccounts(php), sql, profiles, readLocal(), knownAccounts()).filter((row) =>
      /^\d{5,}$/.test(row.id),
    );
    const testers = loadTesters();
    const rankById = new Map(testers.map((t) => [t.id, t.role]));
    const bannedIds = await mysqlBannedIds();
    for (const row of rows) {
      row.rank = rankById.get(row.id) || "";
      if (bannedIds.has(row.id)) row.banned = true;
    }
    rows.sort((a, b) => {
      const ta = Date.parse(a.lastLogin || "") || 0;
      const tb = Date.parse(b.lastLogin || "") || 0;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, "pl");
    });
    return toCards(rows);
  } catch {
    return toCards(mergeById(readLocal(), knownAccounts()).filter((row) => /^\d{5,}$/.test(row.id)));
  }
}

function callerCanManage(targetId: string) {
  const caller = callerDiscordId();
  if (!caller || caller === targetId) return false;
  const row = loadTesters().find((tester) => tester.id === caller);
  if (!row || !/dev/i.test(row.role)) return false;
  const target = loadTesters().find((tester) => tester.id === targetId);
  if (target && isMainDeveloperRole(target.role)) return false;
  return true;
}

export async function deleteDiscordAccount(id: string): Promise<DiscordAccountCard[]> {
  const target = String(id || "").replace(/\D/g, "");
  if (!target || !callerCanManage(target)) return listDiscordAccounts();
  writeLocal(readLocal().filter((row) => row.id !== target));
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    await conn.execute("DELETE FROM discord_accounts WHERE discord_id = ?", [target]);
    await conn.execute("DELETE FROM panel_profiles WHERE discord_id = ?", [target]).catch(() => undefined);
  } catch {
    /* PHP below still tries */
  } finally {
    await conn?.end().catch(() => undefined);
  }
  await apiRequest("POST", {
    action: "accountDelete",
    id: target,
    discordId: callerDiscordId(),
  }).catch(() => null);
  return listDiscordAccounts();
}

function callerDiscordId() {
  return String(loadState().settings.discordId || "").replace(/\D/g, "");
}

function isMainDeveloperRole(role: string) {
  return role.split(/[,|/]+/).some((part) => {
    const token = part.trim().toLowerCase().replace(/[_\s]+/g, "-");
    return token === "m-dev" || token === "mdev" || token.includes("main-dev");
  });
}

function callerCanBan(targetId: string) {
  const caller = callerDiscordId();
  if (!caller || caller === targetId) return false;
  const row = loadTesters().find((tester) => tester.id === caller);
  if (!row || !isMainDeveloperRole(row.role)) return false;
  const target = loadTesters().find((tester) => tester.id === targetId);
  if (target && isMainDeveloperRole(target.role)) return false;
  return true;
}

async function ensureBans(conn: mysql.Connection) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS account_bans (
      account_id VARCHAR(64) NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL DEFAULT '',
      banned_by VARCHAR(64) NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function mysqlBannedIds(): Promise<Set<string>> {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureBans(conn);
    const [rows] = await conn.query("SELECT account_id FROM account_bans");
    const ids = new Set<string>();
    for (const row of rows as { account_id?: string }[]) {
      const id = parseAccountId(row.account_id);
      if (id) ids.add(id);
    }
    return ids;
  } catch {
    return new Set();
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

export async function setAccountBanned(id: string, banned: boolean, name?: string): Promise<DiscordAccountCard[]> {
  const target = parseAccountId(id);
  if (!target || !callerCanBan(target)) return listDiscordAccounts();
  const caller = callerDiscordId();
  const label = String(name || "").trim().slice(0, 191);
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureBans(conn);
    if (banned) {
      await conn.execute(
        `INSERT INTO account_bans (account_id, name, banned_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name), banned_by = VALUES(banned_by)`,
        [target, label, caller],
      );
    } else {
      await conn.execute("DELETE FROM account_bans WHERE account_id = ?", [target]);
    }
  } catch {
    /* PHP below still tries */
  } finally {
    await conn?.end().catch(() => undefined);
  }
  await apiRequest("POST", {
    action: banned ? "accountBan" : "accountUnban",
    id: target,
    name: label,
    discordId: caller,
  }).catch(() => null);
  return listDiscordAccounts();
}

export async function currentAccountBanned(): Promise<boolean> {
  const deviceId = loadPromoDevice().id;
  const discordId = callerDiscordId();
  const ids = await mysqlBannedIds();
  if (ids.has(deviceId) || (discordId && ids.has(discordId))) return true;
  const payload = await apiRequest("POST", { action: "accountBanStatus", deviceId, discordId }).catch(() => null);
  return Boolean(payload && typeof payload === "object" && (payload as { banned?: unknown }).banned === true);
}
