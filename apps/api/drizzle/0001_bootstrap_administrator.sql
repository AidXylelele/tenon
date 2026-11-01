DO $seed$
DECLARE
  address text := lower(regexp_replace(coalesce(nullif(current_setting('app.bootstrap_admin_email', true), ''), 'admin@example.com'), '^\s+|\s+$', '', 'g'));
BEGIN
  -- The pattern of zod's z.email(), which checks every address the API accepts.
  IF address !~ $re$^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$$re$ THEN
    RAISE EXCEPTION 'app.bootstrap_admin_email "%" is not an email address', address;
  END IF;

  INSERT INTO "user" ("id", "email", "name", "role", "created_at")
  SELECT gen_random_uuid(), address, 'Administrator', 'admin', now()
  WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE "role" = 'admin');
END
$seed$;
