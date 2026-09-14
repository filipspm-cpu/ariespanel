import fs from "fs";
import path from "path";
import { app } from "electron";
import mysql from "mysql2/promise";
import { loadTesters } from "./testers";

export type DiscordAccountCard = {
  name: string;
  avatarUrl: string;
  ip: string;
  lastLogin: string;
};

type StoredAccount = DiscordAccountCard & { id: string };

const DB = {
  host: "host425499.lh.pl",
  user: "host425499_ariespanel",
  password: "Wu8BzxevpdGr86f5WrXr",
  database: "host425499_ariespanel",
};

const API_KEY = "aries-accounts-v1";
const API_URLS = [
  "https://filipekweb.pl/aries/accounts.php",
  "https://www.filipekweb.pl/aries/accounts.php",
];

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

function withKey(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}k=${encodeURIComponent(API_KEY)}`;
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

function upsertLocal(account: StoredAccount) {
  const rows = readLocal().filter((row) => row.id !== account.id);
  rows.unshift(account);
  writeLocal(rows.slice(0, 500));
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
        lastLogin: prev.lastLogin || row.lastLogin || "",
      });
    }
  }
  return [...map.values()];
}

function toCards(rows: StoredAccount[]): DiscordAccountCard[] {
  return rows.map(({ name, avatarUrl, ip, lastLogin }) => ({
    name,
    avatarUrl,
    ip: ip || "",
    lastLogin: lastLogin || "",
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

async function apiRequest(method: "GET" | "POST", body?: unknown): Promise<unknown | null> {
  const attempts = API_URLS.map(async (base) => {
    const res = await withTimeout(
      fetch(withKey(base), {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Aries-Key": API_KEY,
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json",
        },
        body: method === "POST" ? JSON.stringify({ ...(body as object), key: API_KEY }) : undefined,
      }),
      12000,
    );
    if (!res.ok) throw new Error(String(res.status));
    const text = (await res.text()).trim();
    if (!text) throw new Error("empty");
    return JSON.parse(text) as unknown;
  });
  try {
    return await Promise.any(attempts);
  } catch {
    return null;
  }
}

export async function recordDiscordAccount(profile: {
  id?: string;
  username?: string;
  globalName?: string;
  avatarUrl?: string;
}): Promise<void> {
  const id = String(profile.id || "").replace(/\D/g, "");
  const name = cardName(profile).slice(0, 191);
  const avatarUrl = String(profile.avatarUrl || "").slice(0, 512);
  if (!id || !name) return;
  const account = { id, name, avatarUrl, ip: "", lastLogin: "" };
  upsertLocal(account);
  await Promise.all([mysqlUpsert(account), apiRequest("POST", { id, name, avatarUrl })]);
}

export async function listDiscordAccounts(): Promise<DiscordAccountCard[]> {
  const [sql, php] = await Promise.all([mysqlList(), apiRequest("GET")]);
  const rows = mergeById(parseAccounts(php), sql, readLocal(), testerAccounts());
  rows.sort((a, b) => {
    const ta = Date.parse(a.lastLogin || "") || 0;
    const tb = Date.parse(b.lastLogin || "") || 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b.name, "pl");
  });
  return toCards(rows);
}
