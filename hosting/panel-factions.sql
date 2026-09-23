-- ARIES panel — liderzy i zamrożenie frakcji (phpMyAdmin, wklej całość).
-- Baza: host425499_ariespanel
-- Tabela powstaje też sama przy pierwszym odczycie z panelu.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS panel_factions (
  id VARCHAR(32) NOT NULL PRIMARY KEY,
  leader VARCHAR(64) NOT NULL DEFAULT '',
  frozen TINYINT NOT NULL DEFAULT 0,
  updated_by VARCHAR(191) NOT NULL DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
