import mysql from "mysql2/promise";
import { apiRequestUrls } from "./accountsApi";
import { loadState } from "./storage";
import { loadTesters } from "./testers";
import { MONEY_TIERS, PROMO_CASH, totalAchievementPoints, type AchievementStats } from "./achievementCatalog";

const DB = {
  host: "host425499.lh.pl",
  user: "host425499_ariespanel",
  password: "Wu8BzxevpdGr86f5WrXr",
  database: "host425499_ariespanel",
};

const REWARD_URLS = [
  "https://filipekweb.pl/aries/rewards.php",
  "https://www.filipekweb.pl/aries/rewards.php",
];

export type Payout = {
  id: number;
  kind: string;
  amount: number;
  status: "pending" | "paid";
  createdAt: string;
};

export type RewardsState = {
  ok: boolean;
  error?: string;
  code: string;
  redeemed: boolean;
  redeemedCode: string;
  referrals: number;
  points: number;
  stats: AchievementStats;
  pendingCash: number;
  paidCash: number;
  payouts: Payout[];
  claimedKinds: string[];
};

export type AccountRewards = {
  id: string;
  code: string;
  referrals: number;
  redeemed: boolean;
  pendingCash: number;
  paidCash: number;
  points: number;
};

const emptyStats = (): AchievementStats => ({
  reports: 0,
  events: 0,
  onlineHours: 0,
  nightReports: 0,
  activeDays: 0,
  referrals: 0,
});

function emptyState(error?: string): RewardsState {
  return {
    ok: !error,
    error,
    code: "",
    redeemed: false,
    redeemedCode: "",
    referrals: 0,
    points: 0,
    stats: emptyStats(),
    pendingCash: 0,
    paidCash: 0,
    payouts: [],
    claimedKinds: [],
  };
}

function asId(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function caller() {
  const settings = loadState().settings;
  return {
    discordId: asId(settings.discordId),
    name: String(settings.discordGlobalName || settings.username || "Konto").slice(0, 191),
  };
}

function isDeveloper(id: string) {
  return loadTesters().some((row) => row.id === id && /dev/i.test(row.role));
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let body = "";
  for (let i = 0; i < 6; i++) body += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `ARIES-${body}`;
}

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
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

async function conn() {
  return mysql.createConnection({
    host: DB.host,
    port: 3306,
    user: DB.user,
    password: DB.password,
    database: DB.database,
    connectTimeout: 5000,
  });
}

async function ensure(db: mysql.Connection) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS promo_codes (
      discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
      code VARCHAR(24) NOT NULL UNIQUE,
      name VARCHAR(191) NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS promo_redemptions (
      discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
      code VARCHAR(24) NOT NULL,
      owner_id VARCHAR(32) NOT NULL,
      amount INT NOT NULL DEFAULT 30000,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_promo_owner (owner_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS reward_stats (
      discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL DEFAULT '',
      reports INT NOT NULL DEFAULT 0,
      events INT NOT NULL DEFAULT 0,
      online_ms BIGINT NOT NULL DEFAULT 0,
      night_reports INT NOT NULL DEFAULT 0,
      active_days INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS reward_claims (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      discord_id VARCHAR(32) NOT NULL,
      kind VARCHAR(32) NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_reward_claim (discord_id, kind),
      INDEX idx_reward_user (discord_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

type SqlRow = Record<string, unknown>;

async function php(action: string, extra: Record<string, unknown>) {
  return apiRequestUrls(REWARD_URLS, "POST", { action, ...extra });
}

function pointsFrom(stats: AchievementStats) {
  return totalAchievementPoints(stats);
}

async function readState(db: mysql.Connection, discordId: string, name: string): Promise<RewardsState> {
  const [[codeRow]] = (await db.query("SELECT code FROM promo_codes WHERE discord_id = ? LIMIT 1", [discordId])) as [
    SqlRow[],
    unknown,
  ];
  const [[redeemRow]] = (await db.query(
    "SELECT code FROM promo_redemptions WHERE discord_id = ? LIMIT 1",
    [discordId],
  )) as [SqlRow[], unknown];
  const [[refRow]] = (await db.query(
    "SELECT COUNT(*) AS c FROM promo_redemptions WHERE owner_id = ?",
    [discordId],
  )) as [SqlRow[], unknown];
  const [[statRow]] = (await db.query("SELECT * FROM reward_stats WHERE discord_id = ? LIMIT 1", [discordId])) as [
    SqlRow[],
    unknown,
  ];
  const [claimRows] = (await db.query(
    "SELECT id, kind, amount, status, created_at FROM reward_claims WHERE discord_id = ? ORDER BY id ASC",
    [discordId],
  )) as [SqlRow[], unknown];

  const referrals = Number(refRow?.c || 0);
  const stats: AchievementStats = {
    reports: Number(statRow?.reports || 0),
    events: Number(statRow?.events || 0),
    onlineHours: Math.floor(Number(statRow?.online_ms || 0) / 3_600_000),
    nightReports: Number(statRow?.night_reports || 0),
    activeDays: Number(statRow?.active_days || 0),
    referrals,
  };
  const payouts: Payout[] = (claimRows || []).map((row) => ({
    id: Number(row.id),
    kind: String(row.kind || ""),
    amount: Number(row.amount || 0),
    status: String(row.status) === "paid" ? "paid" : "pending",
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : "",
  }));
  const pendingCash = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
  const paidCash = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  if (name) {
    await db.execute("UPDATE promo_codes SET name = ? WHERE discord_id = ?", [name, discordId]).catch(() => undefined);
    await db.execute("UPDATE reward_stats SET name = ? WHERE discord_id = ?", [name, discordId]).catch(() => undefined);
  }
  return {
    ok: true,
    code: String(codeRow?.code || ""),
    redeemed: Boolean(redeemRow?.code),
    redeemedCode: String(redeemRow?.code || ""),
    referrals,
    points: pointsFrom(stats),
    stats,
    pendingCash,
    paidCash,
    payouts,
    claimedKinds: payouts.map((p) => p.kind),
  };
}

async function withDb<T>(fn: (db: mysql.Connection) => Promise<T>): Promise<T | null> {
  let db: mysql.Connection | undefined;
  try {
    db = await withTimeout(conn(), 6000);
    await ensure(db);
    return await fn(db);
  } catch {
    return null;
  } finally {
    await db?.end().catch(() => undefined);
  }
}

function parseState(payload: unknown): RewardsState | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Partial<RewardsState> & { ok?: unknown };
  if (data.ok !== true && !data.code && !data.stats) return null;
  const stats = { ...emptyStats(), ...(data.stats || {}) };
  return {
    ok: data.ok === true,
    error: typeof data.error === "string" ? data.error : undefined,
    code: String(data.code || ""),
    redeemed: Boolean(data.redeemed),
    redeemedCode: String(data.redeemedCode || ""),
    referrals: Number(data.referrals || 0),
    points: Number(data.points || pointsFrom(stats)),
    stats,
    pendingCash: Number(data.pendingCash || 0),
    paidCash: Number(data.paidCash || 0),
    payouts: Array.isArray(data.payouts) ? data.payouts : [],
    claimedKinds: Array.isArray(data.claimedKinds) ? data.claimedKinds : [],
  };
}

export async function getRewardsState(): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  const sql = await withDb((db) => readState(db, discordId, name));
  if (sql) return sql;
  const remote = parseState(await php("rewardsState", { discordId, name }));
  return remote || emptyState("network");
}

export async function generatePromoCode(): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  const sql = await withDb(async (db) => {
    const [[existing]] = (await db.query("SELECT code FROM promo_codes WHERE discord_id = ? LIMIT 1", [discordId])) as [
      SqlRow[],
      unknown,
    ];
    if (existing?.code) return readState(db, discordId, name);
    for (let i = 0; i < 8; i++) {
      const code = makeCode();
      try {
        await db.execute("INSERT INTO promo_codes (discord_id, code, name) VALUES (?, ?, ?)", [discordId, code, name]);
        break;
      } catch {
        /* unique collision */
      }
    }
    return readState(db, discordId, name);
  });
  if (sql) return sql;
  return parseState(await php("promoGenerate", { discordId, name })) || emptyState("network");
}

export async function redeemPromoCode(raw: string): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  const code = normalizeCode(raw);
  if (!/^ARIES-[A-Z0-9]{6}$/.test(code)) {
    const state = await getRewardsState();
    return { ...state, ok: false, error: "invalid" };
  }
  const sql = await withDb(async (db) => {
    const [[mine]] = (await db.query("SELECT code FROM promo_codes WHERE discord_id = ? LIMIT 1", [discordId])) as [
      SqlRow[],
      unknown,
    ];
    if (String(mine?.code || "") === code) {
      const state = await readState(db, discordId, name);
      return { ...state, ok: false, error: "own" };
    }
    const [[already]] = (await db.query("SELECT code FROM promo_redemptions WHERE discord_id = ? LIMIT 1", [
      discordId,
    ])) as [SqlRow[], unknown];
    if (already?.code) {
      const state = await readState(db, discordId, name);
      return { ...state, ok: false, error: "used" };
    }
    const [[owner]] = (await db.query("SELECT discord_id FROM promo_codes WHERE code = ? LIMIT 1", [code])) as [
      SqlRow[],
      unknown,
    ];
    const ownerId = String(owner?.discord_id || "");
    if (!ownerId) {
      const state = await readState(db, discordId, name);
      return { ...state, ok: false, error: "missing" };
    }
    await db.execute("INSERT INTO promo_redemptions (discord_id, code, owner_id, amount) VALUES (?, ?, ?, ?)", [
      discordId,
      code,
      ownerId,
      PROMO_CASH,
    ]);
    await db.execute(
      "INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, 'promo', ?, 'pending')",
      [discordId, PROMO_CASH],
    );
    const state = await readState(db, discordId, name);
    return { ...state, ok: true };
  });
  if (sql) return sql;
  return parseState(await php("promoRedeem", { discordId, name, code })) || emptyState("network");
}

export async function syncRewardStats(input: {
  reports: number;
  events: number;
  onlineMs: number;
  nightReports: number;
  activeDays: number;
}): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  const reports = Math.max(0, Math.floor(input.reports || 0));
  const events = Math.max(0, Math.floor(input.events || 0));
  const onlineMs = Math.max(0, Math.floor(input.onlineMs || 0));
  const nightReports = Math.max(0, Math.floor(input.nightReports || 0));
  const activeDays = Math.max(0, Math.floor(input.activeDays || 0));
  const sql = await withDb(async (db) => {
    await db.execute(
      `INSERT INTO reward_stats (discord_id, name, reports, events, online_ms, night_reports, active_days)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         reports = GREATEST(reports, VALUES(reports)),
         events = GREATEST(events, VALUES(events)),
         online_ms = GREATEST(online_ms, VALUES(online_ms)),
         night_reports = GREATEST(night_reports, VALUES(night_reports)),
         active_days = GREATEST(active_days, VALUES(active_days))`,
      [discordId, name, reports, events, onlineMs, nightReports, activeDays],
    );
    return readState(db, discordId, name);
  });
  if (sql) return sql;
  return (
    parseState(
      await php("rewardsSync", {
        discordId,
        name,
        reports,
        events,
        onlineMs,
        nightReports,
        activeDays,
      }),
    ) || emptyState("network")
  );
}

export async function claimMoneyTier(tierId: string): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  const tier = MONEY_TIERS.find((row) => row.id === tierId);
  if (!tier) {
    const state = await getRewardsState();
    return { ...state, ok: false, error: "invalid" };
  }
  const sql = await withDb(async (db) => {
    const state = await readState(db, discordId, name);
    if (state.points < tier.points) return { ...state, ok: false, error: "points" };
    if (state.claimedKinds.includes(tier.id)) return { ...state, ok: false, error: "claimed" };
    await db.execute("INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, ?, ?, 'pending')", [
      discordId,
      tier.id,
      tier.amount,
    ]);
    const next = await readState(db, discordId, name);
    return { ...next, ok: true };
  });
  if (sql) return sql;
  return parseState(await php("rewardsClaim", { discordId, name, kind: tier.id })) || emptyState("network");
}

export async function markRewardsPaid(targetId: string): Promise<AccountRewards[]> {
  const { discordId } = caller();
  if (!isDeveloper(discordId)) return listAccountRewards();
  const id = asId(targetId);
  if (!id) return listAccountRewards();
  await withDb(async (db) => {
    await db.execute("UPDATE reward_claims SET status = 'paid' WHERE discord_id = ? AND status = 'pending'", [id]);
    return true;
  });
  await php("rewardsPaid", { discordId, targetId: id });
  return listAccountRewards();
}

export async function listAccountRewards(): Promise<AccountRewards[]> {
  const sql = await withDb(async (db) => {
    const [rows] = (await db.query(
      `SELECT a.discord_id AS id,
              COALESCE(p.code, '') AS code,
              (SELECT COUNT(*) FROM promo_redemptions r WHERE r.owner_id = a.discord_id) AS referrals,
              (SELECT COUNT(*) FROM promo_redemptions r2 WHERE r2.discord_id = a.discord_id) AS redeemed,
              COALESCE((SELECT SUM(amount) FROM reward_claims c WHERE c.discord_id = a.discord_id AND c.status = 'pending'), 0) AS pendingCash,
              COALESCE((SELECT SUM(amount) FROM reward_claims c2 WHERE c2.discord_id = a.discord_id AND c2.status = 'paid'), 0) AS paidCash,
              COALESCE(s.reports, 0) AS reports,
              COALESCE(s.events, 0) AS events,
              COALESCE(s.online_ms, 0) AS online_ms,
              COALESCE(s.night_reports, 0) AS night_reports,
              COALESCE(s.active_days, 0) AS active_days
       FROM (
         SELECT discord_id FROM discord_accounts
         UNION SELECT discord_id FROM promo_codes
         UNION SELECT discord_id FROM reward_stats
         UNION SELECT discord_id FROM reward_claims
       ) a
       LEFT JOIN promo_codes p ON p.discord_id = a.discord_id
       LEFT JOIN reward_stats s ON s.discord_id = a.discord_id`,
    )) as [SqlRow[], unknown];
    return (rows || []).map((row) => {
      const stats: AchievementStats = {
        reports: Number(row.reports || 0),
        events: Number(row.events || 0),
        onlineHours: Math.floor(Number(row.online_ms || 0) / 3_600_000),
        nightReports: Number(row.night_reports || 0),
        activeDays: Number(row.active_days || 0),
        referrals: Number(row.referrals || 0),
      };
      return {
        id: String(row.id || ""),
        code: String(row.code || ""),
        referrals: Number(row.referrals || 0),
        redeemed: Number(row.redeemed || 0) > 0,
        pendingCash: Number(row.pendingCash || 0),
        paidCash: Number(row.paidCash || 0),
        points: pointsFrom(stats),
      };
    });
  });
  if (sql) return sql;
  const payload = await php("rewardsAccounts", { discordId: caller().discordId });
  if (payload && typeof payload === "object" && Array.isArray((payload as { accounts?: unknown }).accounts)) {
    return (payload as { accounts: AccountRewards[] }).accounts;
  }
  return [];
}
