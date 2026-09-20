-- ARIES panel — pełny SQL (phpMyAdmin, wklej całość).
-- Baza: host425499_ariespanel
-- Promokod: wpisujący 10 000 $, właściciel 20 000 $.
-- Stare wypłaty 30 000 $ zostają. Błędy Duplicate ignoruj, jeśli odpalasz drugi raz.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS discord_accounts (
  discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL,
  avatar_url VARCHAR(512) NOT NULL,
  ip VARCHAR(45) NOT NULL DEFAULT '',
  last_login DATETIME NULL DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS account_roles (
  discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
  name VARCHAR(191) NOT NULL DEFAULT '',
  discord VARCHAR(191) NOT NULL DEFAULT '',
  rank VARCHAR(96) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promo_codes (
  discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
  code VARCHAR(24) NOT NULL UNIQUE,
  name VARCHAR(191) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promo_redemptions (
  discord_id VARCHAR(32) NOT NULL PRIMARY KEY,
  code VARCHAR(24) NOT NULL,
  owner_id VARCHAR(32) NOT NULL,
  amount INT NOT NULL DEFAULT 10000,
  device_id VARCHAR(64) NOT NULL DEFAULT '',
  device_hash VARCHAR(64) NOT NULL DEFAULT '',
  ip VARCHAR(45) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_promo_owner (owner_id),
  INDEX idx_promo_device (device_id),
  INDEX idx_promo_ip (ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reward_claims (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  discord_id VARCHAR(32) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reward_user (discord_id),
  INDEX idx_reward_claim_kind (discord_id, kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feedback (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  discord_id VARCHAR(32) NOT NULL,
  name VARCHAR(191) NOT NULL DEFAULT '',
  kind VARCHAR(16) NOT NULL DEFAULT 'bug',
  title VARCHAR(191) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'open',
  channel VARCHAR(32) NOT NULL DEFAULT 'other',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_feedback_discord (discord_id),
  INDEX idx_feedback_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS aries_add_col;
DELIMITER $$
CREATE PROCEDURE aries_add_col(IN tbl VARCHAR(64), IN col VARCHAR(64), IN defn TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', defn);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$
DELIMITER ;

CALL aries_add_col('discord_accounts', 'ip', 'VARCHAR(45) NOT NULL DEFAULT ''''');
CALL aries_add_col('discord_accounts', 'last_login', 'DATETIME NULL DEFAULT NULL');
CALL aries_add_col('promo_redemptions', 'device_id', 'VARCHAR(64) NOT NULL DEFAULT ''''');
CALL aries_add_col('promo_redemptions', 'device_hash', 'VARCHAR(64) NOT NULL DEFAULT ''''');
CALL aries_add_col('promo_redemptions', 'ip', 'VARCHAR(45) NOT NULL DEFAULT ''''');
CALL aries_add_col('promo_redemptions', 'owner_id', 'VARCHAR(32) NOT NULL DEFAULT ''''');
CALL aries_add_col('reward_stats', 'referrals', 'INT NOT NULL DEFAULT 0');
CALL aries_add_col('feedback', 'status', 'VARCHAR(16) NOT NULL DEFAULT ''open''');
CALL aries_add_col('feedback', 'channel', 'VARCHAR(32) NOT NULL DEFAULT ''other''');
DROP PROCEDURE IF EXISTS aries_add_col;

ALTER TABLE account_roles MODIFY rank VARCHAR(96) NOT NULL;
ALTER TABLE promo_redemptions MODIFY amount INT NOT NULL DEFAULT 10000;

DROP PROCEDURE IF EXISTS aries_add_idx;
DELIMITER $$
CREATE PROCEDURE aries_add_idx(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN cols VARCHAR(191))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` ADD INDEX `', idx, '` (', cols, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$
DELIMITER ;

CALL aries_add_idx('promo_redemptions', 'idx_promo_owner', 'owner_id');
CALL aries_add_idx('promo_redemptions', 'idx_promo_device', 'device_id');
CALL aries_add_idx('promo_redemptions', 'idx_promo_ip', 'ip');
CALL aries_add_idx('reward_claims', 'idx_reward_user', 'discord_id');
CALL aries_add_idx('reward_claims', 'idx_reward_claim_kind', 'discord_id, kind');
DROP PROCEDURE IF EXISTS aries_add_idx;

DROP PROCEDURE IF EXISTS aries_drop_idx;
DELIMITER $$
CREATE PROCEDURE aries_drop_idx(IN tbl VARCHAR(64), IN idx VARCHAR(64))
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND INDEX_NAME = idx
  ) THEN
    SET @sql = CONCAT('ALTER TABLE `', tbl, '` DROP INDEX `', idx, '`');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$
DELIMITER ;

-- Właściciel może dostać wiele wypłat promo (po 20 000 $).
CALL aries_drop_idx('reward_claims', 'uniq_reward_claim');
DROP PROCEDURE IF EXISTS aries_drop_idx;

-- Stare kind=promo na koncie wpisującego → przenieś do właściciela (nie rusza promo-enter).
UPDATE reward_claims AS c
INNER JOIN promo_redemptions AS r
  ON r.discord_id = c.discord_id AND c.kind = 'promo'
SET c.discord_id = r.owner_id
WHERE c.status = 'pending'
  AND r.owner_id <> ''
  AND r.owner_id <> c.discord_id;

SET FOREIGN_KEY_CHECKS = 1;

-- MAIN DEVELOPER (M-DEV) — tylko tutaj, panel tego nie nada:
-- UPDATE account_roles SET rank = 'main-developer' WHERE discord_id = 'TUTAJ_DISCORD_ID';
