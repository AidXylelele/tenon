INSERT INTO "user" ("id", "email", "name", "role", "created_at")
SELECT gen_random_uuid(),
       lower(coalesce(nullif(current_setting('app.bootstrap_admin_email', true), ''), 'admin@example.com')),
       'Administrator',
       'admin',
       now()
WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "role" = 'admin');
