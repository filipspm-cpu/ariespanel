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

-- Liderzy. Puste pola to frakcje bez lidera. Nie rusza flagi frozen.
INSERT INTO panel_factions (id, leader) VALUES
  ('lspd', ''),
  ('ems', 'Janek Leon [#94585]'),
  ('lscsd', 'Jacob Magnat [#39521]'),
  ('sang', 'Mietek Blue [#18768]'),
  ('gov', 'John Ewans [#40952]'),
  ('wn', 'Monika Bundy [#124332]'),
  ('fib', 'Lucas Anderson [#536]'),
  ('ballas', 'Kawik Codeine [#58280]'),
  ('vagos', 'Grygolek Arkadia [#82305]'),
  ('families', 'Shadowek Vybili [#45118]'),
  ('bloods', ''),
  ('marabunta', '')
ON DUPLICATE KEY UPDATE leader = VALUES(leader);
