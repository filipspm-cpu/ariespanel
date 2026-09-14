import fs from "fs";
import path from "path";
import { app } from "electron";
import mysql from "mysql2/promise";
import { apiRequest } from "./accountsApi";
import { ingestRolesPayload, loadTesters } from "./testers";

export type DiscordAccountCard = {
  id: string;
  name: string;
  avatarUrl: string;
  ip: string;
  lastLogin: string;
  rank: string;
};

type StoredAccount = DiscordAccountCard & { id: string };

const DB = {
  host: "host425499.lh.pl",
  user: "host425499_ariespanel",
  password: "Wu8BzxevpdGr86f5WrXr",
  database: "host425499_ariespanel",
};

function cardName(profile: { globalName?: string; username?: string; name?: string }) {
  return (profile.globalName || profile.username || profile.name || "Konto").trim() || "Konto";
}

function defaultAvatarUrl(id: string) {
  try {
    const index = Number(BigInt(id) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  } catch {
    return "https://cdn.discordapp.com/embed/avatars/0.png";
  }
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
    ip: account.ip || prev?.ip || "",
    lastLogin: newerLogin(account.lastLogin, prev?.lastLogin),
    rank: account.rank || prev?.rank || "",
  };
  const rows = readLocal().filter((row) => row.id !== account.id);
  rows.unshift(merged);
  writeLocal(rows.slice(0, 500));
  return merged;
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
        name?: string;
        avatarUrl?: string;
        avatar_url?: string;
        ip?: string;
        lastLogin?: string;
        last_login?: string;
        updated_at?: string;
      };
      const id = String(item.id || item.discord_id || "").replace(/\D/g, "");
      const name = String(item.name || "").trim();
      if (!id || !name) return null;
      return {
        id,
        name,
        avatarUrl: String(item.avatarUrl || item.avatar_url || ""),
        ip: String(item.ip || "").trim(),
        lastLogin: String(item.lastLogin || item.last_login || item.updated_at || "").trim(),
        rank: "",
      };
    })
    .filter((row): row is StoredAccount => Boolean(row));
}

function testerAccounts(): StoredAccount[] {
  return loadTesters().map((tester) => ({
    id: tester.id.replace(/\D/g, ""),
    name: tester.name,
    avatarUrl: defaultAvatarUrl(tester.id),
    ip: "",
    lastLogin: "",
    rank: tester.role,
  })).filter((row) => row.id && row.name);
}

function mergeById(...lists: StoredAccount[][]) {
  const map = new Map<string, StoredAccount>();
  for (const list of lists) {
    for (const row of list) {
      const prev = map.get(row.id);
      if (!prev) {
        map.set(row.id, row);
        continue;
      }
      map.set(row.id, {
        id: row.id,
        name: prev.name || row.name,
        avatarUrl: prev.avatarUrl || row.avatarUrl,
        ip: prev.ip || row.ip || "",
        lastLogin: newerLogin(prev.lastLogin, row.lastLogin),
        rank: prev.rank || row.rank || "",
      });
    }
  }
  return [...map.values()];
}

function toCards(rows: StoredAccount[]): DiscordAccountCard[] {
  return rows.map(({ id, name, avatarUrl, ip, lastLogin, rank }) => ({
    id,
    name,
    avatarUrl,
    ip: ip || "",
    lastLogin: lastLogin || "",
    rank: rank || "",
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
      `INSERT INTO discord_accounts (discord_id, name, avatar_url, ip, last_login) VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url), ip = IF(VALUES(ip) = '', ip, VALUES(ip)), last_login = NOW()`,
      [account.id, account.name, account.avatarUrl, account.ip || ""],
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
      "SELECT discord_id, name, avatar_url, ip, last_login, updated_at FROM discord_accounts ORDER BY COALESCE(last_login, updated_at) DESC, name ASC",
    );
    return parseAccounts(rows);
  } catch {
    return [];
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

async function fetchPublicIp(): Promise<string> {
  try {
    const res = await withTimeout(fetch("https://api.ipify.org?format=json"), 4000);
    if (!res.ok) return "";
    const data = (await res.json()) as { ip?: string };
    const ip = String(data.ip || "").trim();
    return ip && ip.length <= 45 ? ip : "";
  } catch {
    return "";
  }
}

export async function recordDiscordAccount(
  profile: {
    id?: string;
    username?: string;
    globalName?: string;
    avatarUrl?: string;
  },
  opts?: { login?: boolean },
): Promise<void> {
  const id = String(profile.id || "").replace(/\D/g, "");
  const name = cardName(profile).slice(0, 191);
  const avatarUrl = String(profile.avatarUrl || "").slice(0, 512);
  if (!id || !name) return;
  const prev = readLocal().find((row) => row.id === id);
  const captureLogin = Boolean(opts?.login || !prev?.ip || !prev?.lastLogin);
  const ip = captureLogin ? await fetchPublicIp() : "";
  const lastLogin = captureLogin ? new Date().toISOString() : "";
  const account = upsertLocal({ id, name, avatarUrl, ip, lastLogin, rank: "" });
  await Promise.all([mysqlUpsert(account), apiRequest("POST", { id, name, avatarUrl, ip: account.ip })]);
}

export async function listDiscordAccounts(): Promise<DiscordAccountCard[]> {
  const [sql, php] = await Promise.all([mysqlList(), apiRequest("GET")]);
  ingestRolesPayload(php);
  const rows = mergeById(parseAccounts(php), sql, readLocal(), testerAccounts());
  const testers = loadTesters();
  const rankById = new Map(testers.map((t) => [t.id, t.role]));
  for (const row of rows) {
    row.rank = row.rank || rankById.get(row.id) || "";
  }
  rows.sort((a, b) => {
    const ta = Date.parse(a.lastLogin || "") || 0;
    const tb = Date.parse(b.lastLogin || "") || 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name, "pl");
  });
  return toCards(rows);
}
