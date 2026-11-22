INSERT INTO "user" ("id", "email", "name", "role", "status", "created_at")
SELECT
  gen_random_uuid(),
  lower(trim(current_setting('tenon.admin_email', true))),
  'Administrator',
  'admin',
  'active',
  now()
WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "role" = 'admin');
