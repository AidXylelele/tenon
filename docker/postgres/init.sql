\set app_password `sed -E 's|^postgres://[^:]+:([^@]+)@.*$|\1|' /run/secrets/api-database-url`

CREATE ROLE tenon_app LOGIN PASSWORD :'app_password';

GRANT USAGE ON SCHEMA public TO tenon_app;

ALTER DEFAULT PRIVILEGES FOR ROLE tenon GRANT USAGE ON SCHEMAS TO tenon_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tenon GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tenon_app;
ALTER DEFAULT PRIVILEGES FOR ROLE tenon GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO tenon_app;
