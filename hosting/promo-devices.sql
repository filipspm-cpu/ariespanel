-- Jedno użycie cudzego kodu na komputer / IP.
-- PHP też doda te kolumny sam, to jest zapas na phpMyAdmin.

ALTER TABLE promo_redemptions ADD COLUMN device_id VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE promo_redemptions ADD COLUMN device_hash VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE promo_redemptions ADD COLUMN ip VARCHAR(45) NOT NULL DEFAULT '';
