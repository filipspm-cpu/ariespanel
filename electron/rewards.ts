import mysql from "mysql2/promise";
import { apiRequestUrls } from "./accountsApi";
import { loadPromoDevice, markPromoDeviceRedeemed } from "./promoDevice";
import { loadState } from "./storage";
import { loadTesters, setAccountRank } from "./testers";
import {
  MONEY_TIERS,
  PROMO_ENTER_CASH,
  PROMO_OWNER_CASH,
  findCatalogTask,
  totalAchievementPoints,
  type AchievementStat,
  type AchievementStats,
} from "./achievementCatalog";

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

export type CustomAchievement = {
  id: string;
  category: string;
  label: string;
  hint: string;
  stat: AchievementStat;
  need: number;
  points: number;
  rarity: string;
  custom: true;
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
  customTasks: CustomAchievement[];
  leaderboard: AccountRewards[];
  deviceLocked?: boolean;
};

export type AccountRewards = {
  id: string;
  name: string;
  avatarUrl: string;
  code: string;
  referrals: number;
  redeemed: boolean;
  pendingCash: number;
  paidCash: number;
  points: number;
};

export type CustomAchievementInput = {
  label: string;
  hint?: string;
  category?: string;
  stat: string;
  need: number;
  points: number;
  rarity?: string;
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
    customTasks: [],
    leaderboard: [],
    deviceLocked: loadPromoDevice().redeemed,
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

async function grantVipRank(discordId: string, name: string) {
  const row = loadTesters().find((item) => item.id === discordId);
  const parts = String(row?.role || "")
    .split(/[,|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.some((part) => /vip/i.test(part))) parts.push("vip");
  await setAccountRank(discordId, parts.join(",") || "vip", name || row?.name);
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
      device_id VARCHAR(64) NOT NULL DEFAULT '',
      device_hash VARCHAR(64) NOT NULL DEFAULT '',
      ip VARCHAR(45) NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_promo_owner (owner_id),
      INDEX idx_promo_device (device_id),
      INDEX idx_promo_ip (ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query("ALTER TABLE promo_redemptions ADD COLUMN device_id VARCHAR(64) NOT NULL DEFAULT ''").catch(() => undefined);
  await db.query("ALTER TABLE promo_redemptions ADD COLUMN device_hash VARCHAR(64) NOT NULL DEFAULT ''").catch(() => undefined);
  await db.query("ALTER TABLE promo_redemptions ADD COLUMN ip VARCHAR(45) NOT NULL DEFAULT ''").catch(() => undefined);
  await db.query(`
    CREATE TABLE IF NOT EXISTS reward_stats (
      discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
      name VARCHAR(191) NOT NULL DEFAULT '',
      reports INT NOT NULL DEFAULT 0,
      events INT NOT NULL DEFAULT 0,
      online_ms BIGINT NOT NULL DEFAULT 0,
      night_reports INT NOT NULL DEFAULT 0,
      active_days INT NOT NULL DEFAULT 0,
      referrals INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query("ALTER TABLE reward_stats ADD COLUMN referrals INT NOT NULL DEFAULT 0").catch(() => undefined);
  await db.query(`
    CREATE TABLE IF NOT EXISTS reward_claims (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      discord_id VARCHAR(32) NOT NULL,
      kind VARCHAR(32) NOT NULL,
      amount INT NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_reward_user (discord_id),
      INDEX idx_reward_claim_kind (discord_id, kind)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await db.query("ALTER TABLE reward_claims DROP INDEX uniq_reward_claim").catch(() => undefined);
  await db.query("ALTER TABLE reward_claims ADD INDEX idx_reward_claim_kind (discord_id, kind)").catch(() => undefined);
  await db
    .query(
      `UPDATE reward_claims AS c
       INNER JOIN promo_redemptions AS r
         ON r.discord_id = c.discord_id AND c.kind = 'promo'
       SET c.discord_id = r.owner_id
       WHERE c.status = 'pending'
         AND r.owner_id <> ''
         AND r.owner_id <> c.discord_id`,
    )
    .catch(() => undefined);
  await db.query(`
    CREATE TABLE IF NOT EXISTS achievement_defs (
      id VARCHAR(48) NOT NULL PRIMARY KEY,
      label VARCHAR(191) NOT NULL,
      hint VARCHAR(255) NOT NULL DEFAULT '',
      category VARCHAR(32) NOT NULL DEFAULT 'wlasne',
      stat VARCHAR(32) NOT NULL,
      need INT NOT NULL,
      points INT NOT NULL,
      rarity VARCHAR(16) NOT NULL DEFAULT 'brown',
      created_by VARCHAR(32) NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

type SqlRow = Record<string, unknown>;

async function php(action: string, extra: Record<string, unknown>) {
  return apiRequestUrls(REWARD_URLS, "POST", { action, ...extra });
}

const STATS: AchievementStat[] = ["reports", "events", "onlineHours", "nightReports", "activeDays", "referrals"];
const RARITIES = ["brown", "silver", "gold", "rainbow"];
const CATEGORIES = ["dyzur", "rekrutacja", "staz", "wlasne"];

function asStat(value: unknown): AchievementStat {
  const key = String(value || "");
  return STATS.includes(key as AchievementStat) ? (key as AchievementStat) : "onlineHours";
}

function asRarity(value: unknown) {
  const key = String(value || "").toLowerCase();
  return RARITIES.includes(key) ? key : "brown";
}

function asCategory(value: unknown) {
  const key = String(value || "").toLowerCase();
  return CATEGORIES.includes(key) ? key : "wlasne";
}

function mapCustom(row: SqlRow): CustomAchievement {
  return {
    id: String(row.id || ""),
    category: asCategory(row.category),
    label: String(row.label || "Osiągnięcie"),
    hint: String(row.hint || ""),
    stat: asStat(row.stat),
    need: Math.max(1, Number(row.need) || 1),
    points: Math.max(1, Number(row.points) || 1),
    rarity: asRarity(row.rarity),
    custom: true,
  };
}

async function loadCustom(db: mysql.Connection): Promise<CustomAchievement[]> {
  const [rows] = (await db.query("SELECT * FROM achievement_defs ORDER BY created_at ASC")) as [SqlRow[], unknown];
  return (rows || []).map(mapCustom).filter((row) => row.id);
}

function pointsFrom(stats: AchievementStats, extra: CustomAchievement[] = []) {
  return totalAchievementPoints(stats, extra);
}

async function bumpStat(
  db: mysql.Connection,
  discordId: string,
  name: string,
  stat: AchievementStat,
  need: number,
) {
  const reports = stat === "reports" ? need : 0;
  const events = stat === "events" ? need : 0;
  const onlineMs = stat === "onlineHours" ? need * 3_600_000 : 0;
  const nightReports = stat === "nightReports" ? need : 0;
  const activeDays = stat === "activeDays" ? need : 0;
  const referrals = stat === "referrals" ? need : 0;
  await db.execute(
    `INSERT INTO reward_stats (discord_id, name, reports, events, online_ms, night_reports, active_days, referrals)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       reports = GREATEST(reports, VALUES(reports)),
       events = GREATEST(events, VALUES(events)),
       online_ms = GREATEST(online_ms, VALUES(online_ms)),
       night_reports = GREATEST(night_reports, VALUES(night_reports)),
       active_days = GREATEST(active_days, VALUES(active_days)),
       referrals = GREATEST(referrals, VALUES(referrals))`,
    [discordId, name, reports, events, onlineMs, nightReports, activeDays, referrals],
  );
}

async function readState(db: mysql.Connection, discordId: string, name: string): Promise<RewardsState> {
  const customTasks = await loadCustom(db);
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

  const referrals = Math.max(Number(refRow?.c || 0), Number(statRow?.referrals || 0));
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
    points: pointsFrom(stats, customTasks),
    stats,
    pendingCash,
    paidCash,
    payouts,
    claimedKinds: payouts.map((p) => p.kind),
    customTasks,
    leaderboard: [],
    deviceLocked: loadPromoDevice().redeemed,
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
  const error = typeof data.error === "string" && data.error ? data.error : undefined;
  if (data.ok !== true && !data.code && !data.stats && !error) return null;
  const stats = { ...emptyStats(), ...(data.stats || {}) };
  return {
    ok: data.ok === true,
    error,
    code: String(data.code || ""),
    redeemed: Boolean(data.redeemed),
    redeemedCode: String(data.redeemedCode || ""),
    referrals: Number(data.referrals || 0),
    points: Number(data.points || pointsFrom(stats, Array.isArray(data.customTasks) ? data.customTasks : [])),
    stats,
    pendingCash: Number(data.pendingCash || 0),
    paidCash: Number(data.paidCash || 0),
    payouts: Array.isArray(data.payouts) ? data.payouts : [],
    claimedKinds: Array.isArray(data.claimedKinds) ? data.claimedKinds : [],
    customTasks: Array.isArray(data.customTasks) ? data.customTasks : [],
    leaderboard: Array.isArray(data.leaderboard) ? data.leaderboard : [],
    deviceLocked: Boolean(data.deviceLocked) || loadPromoDevice().redeemed,
  };
}

export async function getRewardsState(): Promise<RewardsState> {
  const { discordId, name } = caller();
  const remote = parseState(await php("rewardsState", { discordId, name }));
  if (remote) return remote;
  const sql = await withDb(async (db) => {
    const state = discordId ? await readState(db, discordId, name) : emptyState("login");
    if (!discordId) state.customTasks = await loadCustom(db);
    state.leaderboard = await boardFrom(db);
    return state;
  });
  return sql || emptyState("network");
}

export async function generatePromoCode(): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  const remote = parseState(await php("promoGenerate", { discordId, name }));
  if (remote) return remote;
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
  return sql || emptyState("network");
}

export async function redeemPromoCode(raw: string): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  const code = normalizeCode(raw);
  if (!/^ARIES-[A-Z0-9]{6}$/.test(code)) {
    const state = await getRewardsState();
    return { ...state, ok: false, error: "invalid" };
  }
  const device = loadPromoDevice();
  if (device.redeemed) {
    const state = await getRewardsState();
    if (!state.redeemed) return { ...state, ok: false, error: "device" };
  }
  const finish = (state: RewardsState) => {
    if (state.ok && state.redeemed) markPromoDeviceRedeemed();
    if (state.error === "device" || state.error === "ip") markPromoDeviceRedeemed();
    return state;
  };
  const remote = parseState(
    await php("promoRedeem", { discordId, name, code, deviceId: device.id, deviceHash: device.hash }),
  );
  if (remote) return finish(remote);
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
    const [[taken]] = (await db.query(
      `SELECT discord_id FROM promo_redemptions
       WHERE (device_id <> '' AND device_id = ?) OR (device_hash <> '' AND device_hash = ?)
       LIMIT 1`,
      [device.id, device.hash],
    )) as [SqlRow[], unknown];
    if (taken?.discord_id && String(taken.discord_id) !== discordId) {
      const state = await readState(db, discordId, name);
      return { ...state, ok: false, error: "device" };
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
    try {
      await db.execute(
        "INSERT INTO promo_redemptions (discord_id, code, owner_id, amount, device_id, device_hash) VALUES (?, ?, ?, ?, ?, ?)",
        [discordId, code, ownerId, PROMO_ENTER_CASH, device.id, device.hash],
      );
    } catch {
      await db.execute("INSERT INTO promo_redemptions (discord_id, code, owner_id, amount) VALUES (?, ?, ?, ?)", [
        discordId,
        code,
        ownerId,
        PROMO_ENTER_CASH,
      ]);
    }
    await db.execute(
      "INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, 'promo', ?, 'pending')",
      [ownerId, PROMO_OWNER_CASH],
    );
    await db.execute(
      "INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, 'promo-enter', ?, 'pending')",
      [discordId, PROMO_ENTER_CASH],
    );
    const state = await readState(db, discordId, name);
    return { ...state, ok: true };
  });
  return finish(sql || emptyState("network"));
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
  const remote = parseState(
    await php("rewardsSync", {
      discordId,
      name,
      reports,
      events,
      onlineMs,
      nightReports,
      activeDays,
    }),
  );
  if (remote) return remote;
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
  return sql || emptyState("network");
}

export async function claimMoneyTier(tierId: string): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  const tier = MONEY_TIERS.find((row) => row.id === tierId);
  if (!tier) {
    const state = await getRewardsState();
    return { ...state, ok: false, error: "invalid" };
  }
  const remote = parseState(await php("rewardsClaim", { discordId, name, kind: tier.id }));
  if (remote) {
    if (remote.ok && tier.prize === "vip") await grantVipRank(discordId, name);
    return remote;
  }
  const sql = await withDb(async (db) => {
    const state = await readState(db, discordId, name);
    if (state.points < tier.points) return { ...state, ok: false, error: "points" };
    if (state.claimedKinds.includes(tier.id)) return { ...state, ok: false, error: "claimed" };
    const status = tier.prize === "vip" ? "paid" : "pending";
    await db.execute("INSERT INTO reward_claims (discord_id, kind, amount, status) VALUES (?, ?, ?, ?)", [
      discordId,
      tier.id,
      tier.amount,
      status,
    ]);
    if (tier.prize === "vip") await grantVipRank(discordId, name);
    const next = await readState(db, discordId, name);
    next.leaderboard = await boardFrom(db);
    return { ...next, ok: true };
  });
  return sql || emptyState("network");
}

export async function markRewardsPaid(targetId: string): Promise<AccountRewards[]> {
  const { discordId } = caller();
  if (!isDeveloper(discordId)) return listAccountRewards();
  const id = asId(targetId);
  if (!id) return listAccountRewards();
  await php("rewardsPaid", { discordId, targetId: id });
  await withDb(async (db) => {
    await db.execute("UPDATE reward_claims SET status = 'paid' WHERE discord_id = ? AND status = 'pending'", [id]);
    return true;
  });
  return listAccountRewards();
}

async function boardFrom(db: mysql.Connection): Promise<AccountRewards[]> {
  const extra = await loadCustom(db);
  const [rows] = (await db.query(
    `SELECT a.discord_id AS id,
            COALESCE(NULLIF(d.name, ''), NULLIF(s.name, ''), NULLIF(p.name, ''), a.discord_id) AS name,
            COALESCE(d.avatar_url, '') AS avatarUrl,
            COALESCE(p.code, '') AS code,
            (SELECT COUNT(*) FROM promo_redemptions r WHERE r.owner_id = a.discord_id) AS referrals,
            (SELECT COUNT(*) FROM promo_redemptions r2 WHERE r2.discord_id = a.discord_id) AS redeemed,
            COALESCE((SELECT SUM(amount) FROM reward_claims c WHERE c.discord_id = a.discord_id AND c.status = 'pending'), 0) AS pendingCash,
            COALESCE((SELECT SUM(amount) FROM reward_claims c2 WHERE c2.discord_id = a.discord_id AND c2.status = 'paid'), 0) AS paidCash,
            COALESCE(s.reports, 0) AS reports,
            COALESCE(s.events, 0) AS events,
            COALESCE(s.online_ms, 0) AS online_ms,
            COALESCE(s.night_reports, 0) AS night_reports,
            COALESCE(s.active_days, 0) AS active_days,
            COALESCE(s.referrals, 0) AS granted_referrals
     FROM (
       SELECT discord_id FROM discord_accounts
       UNION SELECT discord_id FROM promo_codes
       UNION SELECT discord_id FROM reward_stats
       UNION SELECT discord_id FROM reward_claims
     ) a
     LEFT JOIN promo_codes p ON p.discord_id = a.discord_id
     LEFT JOIN reward_stats s ON s.discord_id = a.discord_id
     LEFT JOIN discord_accounts d ON d.discord_id = a.discord_id`,
  )) as [SqlRow[], unknown];
  return (rows || [])
    .map((row) => {
      const stats: AchievementStats = {
        reports: Number(row.reports || 0),
        events: Number(row.events || 0),
        onlineHours: Math.floor(Number(row.online_ms || 0) / 3_600_000),
        nightReports: Number(row.night_reports || 0),
        activeDays: Number(row.active_days || 0),
        referrals: Math.max(Number(row.referrals || 0), Number(row.granted_referrals || 0)),
      };
      return {
        id: String(row.id || ""),
        name: String(row.name || row.id || "Konto"),
        avatarUrl: String(row.avatarUrl || ""),
        code: String(row.code || ""),
        referrals: stats.referrals,
        redeemed: Number(row.redeemed || 0) > 0,
        pendingCash: Number(row.pendingCash || 0),
        paidCash: Number(row.paidCash || 0),
        points: pointsFrom(stats, extra),
      };
    })
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "pl"));
}

export async function listAccountRewards(): Promise<AccountRewards[]> {
  const payload = await php("rewardsAccounts", { discordId: caller().discordId });
  if (payload && typeof payload === "object" && Array.isArray((payload as { accounts?: unknown }).accounts)) {
    return (payload as { accounts: AccountRewards[] }).accounts.sort(
      (a, b) => b.points - a.points || String(a.name || a.id).localeCompare(String(b.name || b.id), "pl"),
    );
  }
  return (await withDb((db) => boardFrom(db))) || [];
}

export async function createCustomAchievement(input: CustomAchievementInput): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  if (!isDeveloper(discordId)) {
    const state = await getRewardsState();
    return { ...state, ok: false, error: "forbidden" };
  }
  const label = String(input.label || "").trim().slice(0, 80);
  if (label.length < 2) {
    const state = await getRewardsState();
    return { ...state, ok: false, error: "invalid" };
  }
  const remote = parseState(await php("rewardsDefine", { discordId, name, ...input }));
  if (remote) return remote;
  const sql = await withDb(async (db) => {
    const id = `custom-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    await db.execute(
      `INSERT INTO achievement_defs (id, label, hint, category, stat, need, points, rarity, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        label,
        String(input.hint || "").trim().slice(0, 255),
        asCategory(input.category),
        asStat(input.stat),
        Math.max(1, Math.floor(Number(input.need) || 1)),
        Math.max(1, Math.min(5000, Math.floor(Number(input.points) || 1))),
        asRarity(input.rarity),
        discordId,
      ],
    );
    const state = await readState(db, discordId, name);
    state.leaderboard = await boardFrom(db);
    return { ...state, ok: true };
  });
  return sql || emptyState("network");
}

export async function deleteCustomAchievement(id: string): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  if (!isDeveloper(discordId)) {
    const state = await getRewardsState();
    return { ...state, ok: false, error: "forbidden" };
  }
  const key = String(id || "");
  if (!key.startsWith("custom-")) {
    const state = await getRewardsState();
    return { ...state, ok: false, error: "invalid" };
  }
  const remote = parseState(await php("rewardsUndefine", { discordId, name, id: key }));
  if (remote) return remote;
  const sql = await withDb(async (db) => {
    await db.execute("DELETE FROM achievement_defs WHERE id = ?", [key]);
    const state = await readState(db, discordId, name);
    state.leaderboard = await boardFrom(db);
    return { ...state, ok: true };
  });
  return sql || emptyState("network");
}

export async function grantAchievement(taskId: string): Promise<RewardsState> {
  const { discordId, name } = caller();
  if (!discordId) return emptyState("login");
  if (!isDeveloper(discordId)) {
    const state = await getRewardsState();
    return { ...state, ok: false, error: "forbidden" };
  }
  const id = String(taskId || "").trim();
  const remote = parseState(await php("rewardsGrant", { discordId, name, id }));
  if (remote) return remote;
  const sql = await withDb(async (db) => {
    const extra = await loadCustom(db);
    const task = findCatalogTask(id, extra);
    if (!task) {
      const state = await readState(db, discordId, name);
      return { ...state, ok: false, error: "invalid" };
    }
    await bumpStat(db, discordId, name, task.stat, task.need);
    const next = await readState(db, discordId, name);
    next.leaderboard = await boardFrom(db);
    return { ...next, ok: true };
  });
  return sql || emptyState("network");
}
