-- MAIN DEVELOPER (M-DEV) — tylko przez bazę, panel tego nie nada i nie zdejmie.

-- Nadaj rangę (zostawia developer/vip/beta jeśli już są):
UPDATE account_roles
SET rank = TRIM(BOTH ',' FROM CONCAT(
  'main-developer',
  ',',
  REPLACE(REPLACE(REPLACE(rank, 'main-developer', ''), ',,', ','), ',,', ',')
))
WHERE discord_id = 'TUTAJ_DISCORD_ID';

-- Albo ustaw samą tę rangę:
-- UPDATE account_roles SET rank = 'main-developer' WHERE discord_id = 'TUTAJ_DISCORD_ID';

-- Zdejmij MAIN DEVELOPER (inne rangi zostają):
-- UPDATE account_roles
-- SET rank = TRIM(BOTH ',' FROM REPLACE(REPLACE(rank, 'main-developer', ''), ',,', ','))
-- WHERE discord_id = 'TUTAJ_DISCORD_ID';
