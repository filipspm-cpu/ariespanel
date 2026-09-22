import fs from "fs";
import path from "path";
import { app } from "electron";
import mysql from "mysql2/promise";
import { apiRequest } from "./accountsApi";
import { loadState } from "./storage";
import { loadTesters } from "./testers";

export type NoticeKind = "changelog" | "announcement";

export type PanelNotice = {
  id: number;
  kind: NoticeKind;
  title: string;
  body: string;
  authorName: string;
  createdAt: string;
};

export type NoticesResult = {
  ok: boolean;
  editor: boolean;
  popup: boolean;
  notices: PanelNotice[];
  error?: string;
};

const DB = {
  host: "host425499.lh.pl",
  user: "host425499_ariespanel",
  password: "Wu8BzxevpdGr86f5WrXr",
  database: "host425499_ariespanel",
};

const RELEASE_NOTE: Omit<PanelNotice, "id"> = {
  kind: "changelog",
  title: "1.0.104",
  body: "• Opis promokodu nie wspomina już o zapamiętywaniu adresu IP",
  authorName: "Filipek",
  createdAt: "2026-09-22T19:05:00.000Z",
};

const SEED: Array<Omit<PanelNotice, "id">> = [
  RELEASE_NOTE,
  {
    kind: "changelog",
    title: "1.0.103",
    body: "• Auto kliker dla beta testerów w Gra → Auto kliker\n• Lewy lub prawy przycisk, odstęp, limit kliknięć i skrót (domyślnie F6)\n• Skrót działa, gdy gra jest na wierzchu",
    authorName: "Filipek",
    createdAt: "2026-09-22T18:00:00.000Z",
  },
  {
    kind: "announcement",
    title: "Promuj Aries panel",
    body: "Pokaż ARIES znajomym z serwera. Im więcej osób korzysta z panelu, tym łatwiej trzymać raporty, makra i nakładkę w jednym miejscu.",
    authorName: "Filipek",
    createdAt: "2026-09-21T00:00:00.000Z",
  },
  {
    kind: "changelog",
    title: "1.0.99",
    body: "• Na starcie panelu widać changelog i ogłoszenia\n• Main developer dodaje wpisy w zakładce Ogłoszenia",
    authorName: "Filipek",
    createdAt: "2026-09-21T00:00:00.000Z",
  },
  {
    kind: "changelog",
    title: "1.0.98",
    body: "• Zakładka Konta znowu pokazuje połączone konta Discord\n• Przy pierwszym uruchomieniu panel pyta o nazwę i zapisuje ją w bazie\n• Sugestie i błędy można kopiować oraz trwale usuwać\n• Asystent forum odpowiada na pytania z regulaminu",
    authorName: "Filipek",
    createdAt: "2026-09-20T21:00:00.000Z",
  },
];

type LocalStore = {
  popup: boolean;
  seeded: boolean;
  notices: PanelNotice[];
};

function localPath() {
  return path.join(app.getPath("userData"), "panel-notices.json");
}

function normalizeKind(raw: unknown): NoticeKind {
  return String(raw || "").toLowerCase() === "changelog" ? "changelog" : "announcement";
}

function asNotice(row: unknown): PanelNotice | null {
  const item = (row || {}) as {
    id?: number | string;
    kind?: string;
    title?: string;
    body?: string;
    authorName?: string;
    author_name?: string;
    createdAt?: string;
    created_at?: string;
  };
  const title = String(item.title || "").trim();
  const body = String(item.body || "").trim();
  if (!title || !body) return null;
  const id = Number(item.id);
  return {
    id: Number.isFinite(id) && id !== 0 ? id : Date.now() * -1,
    kind: normalizeKind(item.kind),
    title,
    body,
    authorName: String(item.authorName || item.author_name || "").trim() || "ARIES",
    createdAt: String(item.createdAt || item.created_at || ""),
  };
}

function parseNotices(payload: unknown): PanelNotice[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { notices?: unknown }).notices)
      ? (payload as { notices: unknown[] }).notices
      : [];
  return rows.map(asNotice).filter((row): row is PanelNotice => Boolean(row));
}

function seedRows(): PanelNotice[] {
  return SEED.map((item, index) => ({
    id: -1 - index,
    kind: item.kind,
    title: item.title,
    body: item.body,
    authorName: item.authorName,
    createdAt: item.createdAt,
  }));
}

function emptyStore(): LocalStore {
  return { popup: true, seeded: false, notices: [] };
}

function readStore(): LocalStore {
  try {
    const raw = JSON.parse(fs.readFileSync(localPath(), "utf8")) as unknown;
    if (Array.isArray(raw)) {
      return { popup: true, seeded: true, notices: parseNotices(raw) };
    }
    if (!raw || typeof raw !== "object") return emptyStore();
    const data = raw as { popup?: unknown; seeded?: unknown; notices?: unknown };
    const notices = parseNotices(data.notices);
    return {
      popup: data.popup !== false,
      seeded: Boolean(data.seeded) || notices.length > 0,
      notices,
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: LocalStore) {
  fs.writeFileSync(
    localPath(),
    JSON.stringify({ popup: store.popup, seeded: true, notices: store.notices }, null, 2),
    "utf8",
  );
}

function localList(popup = true): LocalStore {
  const store = readStore();
  if (!store.seeded) {
    const seeded: LocalStore = { popup: store.popup, seeded: true, notices: seedRows() };
    writeStore(seeded);
    return { ...seeded, popup: popup && seeded.popup };
  }
  return { ...store, popup: popup && store.popup };
}

function ensureReleaseNote(rows: PanelNotice[]): PanelNotice[] {
  if (rows.some((row) => row.kind === "changelog" && row.title === RELEASE_NOTE.title)) return rows;
  return [{ id: -103, ...RELEASE_NOTE }, ...rows];
}

function sortNotices(rows: PanelNotice[]) {
  return [...rows].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "announcement" ? -1 : 1;
    const ta = Date.parse(a.createdAt || "") || 0;
    const tb = Date.parse(b.createdAt || "") || 0;
    if (tb !== ta) return tb - ta;
    return b.id - a.id;
  });
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

function asPopup(payload: unknown, fallback = true) {
  if (!payload || typeof payload !== "object") return fallback;
  const value = (payload as { popup?: unknown }).popup;
  if (value === false || value === 0 || value === "0") return false;
  if (value === true || value === 1 || value === "1") return true;
  return fallback;
}

function result(ok: boolean, editor: boolean, notices: PanelNotice[], popup: boolean, error?: string): NoticesResult {
  return { ok, editor, popup, notices: sortNotices(notices), error };
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
    CREATE TABLE IF NOT EXISTS panel_notices (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      kind VARCHAR(16) NOT NULL DEFAULT 'announcement',
      title VARCHAR(191) NOT NULL,
      body TEXT NOT NULL,
      author_id VARCHAR(32) NOT NULL DEFAULT '',
      author_name VARCHAR(191) NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await conn.query(`
    CREATE TABLE IF NOT EXISTS panel_notice_settings (
      k VARCHAR(32) NOT NULL PRIMARY KEY,
      v VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function mysqlSetting(conn: mysql.Connection, key: string) {
  const [rows] = await conn.query("SELECT v FROM panel_notice_settings WHERE k = ? LIMIT 1", [key]);
  return String((rows as { v?: string }[])[0]?.v || "");
}

async function mysqlSetSetting(conn: mysql.Connection, key: string, value: string) {
  await conn.execute(
    "INSERT INTO panel_notice_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)",
    [key, value],
  );
}

async function mysqlSeed(conn: mysql.Connection) {
  if ((await mysqlSetting(conn, "seeded")) === "1") return;
  const [countRows] = await conn.query("SELECT COUNT(*) AS c FROM panel_notices");
  const count = Number((countRows as { c?: number }[])[0]?.c || 0);
  if (count === 0) {
    for (const item of SEED) {
      await conn.execute(
        "INSERT INTO panel_notices (kind, title, body, author_id, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [item.kind, item.title, item.body, "1305449847125708811", item.authorName, new Date(item.createdAt)],
      );
    }
  }
  await mysqlSetSetting(conn, "seeded", "1");
}

async function mysqlList(): Promise<{ notices: PanelNotice[]; popup: boolean } | null> {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    await mysqlSeed(conn);
    const [rows] = await conn.query(
      "SELECT id, kind, title, body, author_name, created_at FROM panel_notices ORDER BY created_at DESC, id DESC",
    );
    const popup = (await mysqlSetting(conn, "popup")) !== "0";
    return { notices: parseNotices(rows), popup };
  } catch {
    return null;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

async function mysqlCreate(kind: NoticeKind, title: string, body: string, authorId: string, authorName: string) {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    await conn.execute("INSERT INTO panel_notices (kind, title, body, author_id, author_name) VALUES (?, ?, ?, ?, ?)", [
      kind,
      title,
      body,
      authorId,
      authorName,
    ]);
    return true;
  } catch {
    return false;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

async function mysqlDelete(id: number, title: string) {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    if (id > 0) await conn.execute("DELETE FROM panel_notices WHERE id = ?", [id]);
    if (title) await conn.execute("DELETE FROM panel_notices WHERE title = ?", [title]);
    return true;
  } catch {
    return false;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

async function mysqlSetPopup(enabled: boolean) {
  let conn: mysql.Connection | undefined;
  try {
    conn = await withTimeout(mysqlConn(), 5000);
    await ensureTable(conn);
    await mysqlSetSetting(conn, "popup", enabled ? "1" : "0");
    return true;
  } catch {
    return false;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

function isRemoteList(payload: unknown) {
  return Boolean(payload && typeof payload === "object" && Array.isArray((payload as { notices?: unknown }).notices));
}

export async function listNotices(): Promise<NoticesResult> {
  const { discordId } = caller();
  const editor = isMainDeveloper(discordId);
  const remote = await apiRequest("POST", { action: "noticesList", discordId }).catch(() => null);
  if (isRemoteList(remote)) {
    const notices = parseNotices(remote);
    const popup = asPopup(remote, true);
    writeStore({ popup, seeded: true, notices });
    return result(true, editor, ensureReleaseNote(notices), popup);
  }
  const sql = await mysqlList();
  if (sql) {
    writeStore({ popup: sql.popup, seeded: true, notices: sql.notices });
    return result(true, editor, ensureReleaseNote(sql.notices), sql.popup);
  }
  const local = localList();
  return result(true, editor, ensureReleaseNote(local.notices), local.popup);
}

export async function createNotice(input: { kind?: string; title?: string; body?: string }): Promise<NoticesResult> {
  const { discordId, name } = caller();
  const editor = isMainDeveloper(discordId);
  if (!discordId) return { ...(await listNotices()), ok: false, error: "login" };
  if (!editor) return { ...(await listNotices()), ok: false, editor: false, error: "forbidden" };
  const kind = normalizeKind(input.kind);
  const title = String(input.title || "")
    .trim()
    .slice(0, 191);
  const body = String(input.body || "")
    .trim()
    .slice(0, 4000);
  if (title.length < 3 || body.length < 3) {
    return { ...(await listNotices()), ok: false, error: "invalid" };
  }
  const remote = await apiRequest("POST", {
    action: "noticesCreate",
    discordId,
    name,
    kind,
    title,
    body,
  }).catch(() => null);
  if (isRemoteList(remote) && (remote as { ok?: unknown }).ok === true) {
    const notices = parseNotices(remote);
    const popup = asPopup(remote, readStore().popup);
    writeStore({ popup, seeded: true, notices });
    return result(true, true, ensureReleaseNote(notices), popup);
  }
  const saved = await mysqlCreate(kind, title, body, discordId, name);
  if (saved) return listNotices();
  const store = localList();
  const next: PanelNotice[] = [
    {
      id: Date.now(),
      kind,
      title,
      body,
      authorName: name,
      createdAt: new Date().toISOString(),
    },
    ...store.notices,
  ];
  writeStore({ popup: store.popup, seeded: true, notices: next });
  return result(true, true, ensureReleaseNote(next), store.popup);
}

export async function deleteNotice(id: number, title?: string): Promise<NoticesResult> {
  const { discordId } = caller();
  const editor = isMainDeveloper(discordId);
  if (!discordId) return { ...(await listNotices()), ok: false, error: "login" };
  if (!editor) return { ...(await listNotices()), ok: false, editor: false, error: "forbidden" };
  const key = Math.floor(Number(id) || 0);
  const label = String(title || "").trim();
  if (!key && !label) return { ...(await listNotices()), ok: false, error: "invalid" };
  const remote = await apiRequest("POST", { action: "noticesDelete", discordId, id: key, title: label }).catch(() => null);
  if (isRemoteList(remote) && (remote as { ok?: unknown }).ok === true) {
    const notices = parseNotices(remote);
    const popup = asPopup(remote, readStore().popup);
    writeStore({ popup, seeded: true, notices });
    return result(true, true, ensureReleaseNote(notices), popup);
  }
  await mysqlDelete(key, label);
  const store = localList(readStore().popup);
  const next = store.notices.filter((row) => row.id !== key && (!label || row.title !== label));
  writeStore({ popup: store.popup, seeded: true, notices: next });
  return result(true, true, ensureReleaseNote(next), store.popup);
}

export async function setNoticesPopup(enabled: boolean): Promise<NoticesResult> {
  const { discordId } = caller();
  const editor = isMainDeveloper(discordId);
  if (!discordId) return { ...(await listNotices()), ok: false, error: "login" };
  if (!editor) return { ...(await listNotices()), ok: false, editor: false, error: "forbidden" };
  const popup = Boolean(enabled);
  const remote = await apiRequest("POST", { action: "noticesSetPopup", discordId, popup }).catch(() => null);
  if (isRemoteList(remote) && (remote as { ok?: unknown }).ok === true) {
    const notices = parseNotices(remote);
    writeStore({ popup: asPopup(remote, popup), seeded: true, notices });
    return result(true, true, ensureReleaseNote(notices), asPopup(remote, popup));
  }
  await mysqlSetPopup(popup);
  const store = localList(popup);
  writeStore({ popup, seeded: true, notices: store.notices });
  return result(true, true, ensureReleaseNote(store.notices), popup);
}
