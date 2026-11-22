DO $$
DECLARE
  address text := NULLIF(trim(current_setting('tenon.admin_email', true)), '');
BEGIN
  IF EXISTS (SELECT 1 FROM "user" WHERE "role" = 'admin') THEN
    RETURN;
  END IF;

  IF address IS NULL OR address !~ '^[^@\s]+@[^@\s]+$' THEN
    RAISE EXCEPTION 'No administrator exists and tenon.admin_email is not an email address: set ADMIN_EMAIL, which the migrate service passes as PGOPTIONS="-c tenon.admin_email=<address>"';
  END IF;

  INSERT INTO "user" ("id", "email", "name", "role", "status", "created_at")
  VALUES (gen_random_uuid(), lower(address), 'Administrator', 'admin', 'active', now());
END
$$;
