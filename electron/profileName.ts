import { apiRequest } from "./accountsApi";
import { recordDiscordAccount } from "./discordAccounts";
import { loadPromoDevice } from "./promoDevice";
import { loadState, saveState } from "./storage";
import mysql from "mysql2/promise";

const DB = {
  host: "host425499.lh.pl",
  user: "host425499_ariespanel",
  password: "Wu8BzxevpdGr86f5WrXr",
  database: "host425499_ariespanel",
};

export type ProfileSaveResult = {
  ok: boolean;
  name: string;
  error?: string;
};

function cleanName(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
}

async function mysqlSave(deviceId: string, name: string, discordId: string) {
  let conn: mysql.Connection | undefined;
  try {
    conn = await mysql.createConnection({
      host: DB.host,
      port: 3306,
      user: DB.user,
      password: DB.password,
      database: DB.database,
      connectTimeout: 4000,
    });
    await conn.query(`
      CREATE TABLE IF NOT EXISTS panel_profiles (
        device_id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        discord_id VARCHAR(32) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.execute(
      `INSERT INTO panel_profiles (device_id, name, discord_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), discord_id = IF(VALUES(discord_id) = '', discord_id, VALUES(discord_id))`,
      [deviceId, name, discordId],
    );
    if (discordId) {
      await conn.execute("UPDATE reward_stats SET name = ? WHERE discord_id = ?", [name, discordId]).catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  } finally {
    await conn?.end().catch(() => undefined);
  }
}

export async function savePanelName(rawName: string): Promise<ProfileSaveResult> {
  const name = cleanName(rawName);
  if (name.length < 2) return { ok: false, name: "", error: "invalid" };
  const deviceId = loadPromoDevice().id;
  const discordId = String(loadState().settings.discordId || "").replace(/\D/g, "");
  saveState({
    settings: {
      ...loadState().settings,
      username: name,
      profileNameSet: true,
    },
  });
  await Promise.all([
    mysqlSave(deviceId, name, discordId),
    apiRequest("POST", { action: "profileSave", deviceId, discordId, name }),
    discordId
      ? recordDiscordAccount({
          id: discordId,
          name,
          username: loadState().settings.discordUsername || name,
          globalName: name,
          avatarUrl: loadState().settings.discordAvatarUrl,
        })
      : Promise.resolve(),
  ]);
  return { ok: true, name };
}
