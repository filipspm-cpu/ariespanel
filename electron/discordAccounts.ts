import fs from "fs";
import path from "path";
import { app } from "electron";
import mysql from "mysql2/promise";

export type DiscordAccountCard = {
  name: string;
  avatarUrl: string;
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
  "https://host425499.lh.pl/accounts.php",
  "https://host425499.lh.pl/aries/accounts.php",
  "https://s425499.lh.pl/accounts.php",
];

function cardName(profile: { globalName?: string; username?: string; name?: string }) {
  return (profile.globalName || profile.username || profile.name || "Konto").trim() || "Konto";
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

function parseCards(payload: unknown): DiscordAccountCard[] | null {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { accounts?: unknown }).accounts)
      ? (payload as { accounts: unknown[] }).accounts
      : null;
  if (!rows) return null;
  return rows
    .map((row) => {
      const item = row as { name?: string; avatarUrl?: string; avatar_url?: string };
      const name = String(item.name || "").trim();
      if (!name) return null;
      return { name, avatarUrl: String(item.avatarUrl || item.avatar_url || "") };
    })
    .filter((row): row is DiscordAccountCard => Boolean(row));
}

function mergeCards(...lists: DiscordAccountCard[][]) {
  const seen = new Set<string>();
  const out: DiscordAccountCard[] = [];
  for (const list of lists) {
    for (const row of list) {
      const key = `${row.name.toLowerCase()}|${row.avatarUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function mysqlUpsert(account: StoredAccount): Promise<boolean> {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    await conn.execute(
      `INSERT INTO discord_accounts (discord_id, name, avatar_url) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), avatar_url = VALUES(avatar_url)`,
      [account.id, account.name, account.avatarUrl],
    );
    return true;
  } catch {
    return false;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

async function mysqlList(): Promise<DiscordAccountCard[] | null> {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    const [rows] = await conn.query(
      "SELECT name, avatar_url FROM discord_accounts ORDER BY updated_at DESC, name ASC",
    );
    return parseCards(rows);
  } catch {
    return null;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

async function apiRequest(method: "GET" | "POST", body?: unknown): Promise<unknown | null> {
  const attempts = API_URLS.map(async (url) => {
    const res = await withTimeout(
      fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Aries-Key": API_KEY,
          "User-Agent": "ARIES",
        },
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      }),
      4000,
    );
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
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
  const account = { id, name, avatarUrl };
  upsertLocal(account);
  await Promise.all([mysqlUpsert(account), apiRequest("POST", { id, name, avatarUrl })]);
}

export async function listDiscordAccounts(): Promise<DiscordAccountCard[]> {
  const [sql, php] = await Promise.all([mysqlList(), apiRequest("GET")]);
  const local = readLocal().map(({ name, avatarUrl }) => ({ name, avatarUrl }));
  return mergeCards(sql ?? [], parseCards(php) ?? [], local);
}
