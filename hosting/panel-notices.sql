-- ARIES panel — ogłoszenia i changelog (phpMyAdmin, wklej całość).
-- Baza: host425499_ariespanel
-- Duplicate ignoruj, jeśli odpalasz drugi raz.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS panel_notices (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  kind VARCHAR(16) NOT NULL DEFAULT 'announcement',
  title VARCHAR(191) NOT NULL,
  body TEXT NOT NULL,
  author_id VARCHAR(32) NOT NULL DEFAULT '',
  author_name VARCHAR(191) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notices_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS panel_notice_settings (
  k VARCHAR(32) NOT NULL PRIMARY KEY,
  v VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO panel_notice_settings (k, v) VALUES ('popup', '1')
  ON DUPLICATE KEY UPDATE v = v;
INSERT INTO panel_notice_settings (k, v) VALUES ('seeded', '0')
  ON DUPLICATE KEY UPDATE v = v;
