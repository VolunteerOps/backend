-- Explicitly approved exception: a full backup must see rows across tenants.
-- Create sentinel_backup LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS
-- with a random password supplied interactively; never commit its password.
GRANT CONNECT ON DATABASE volunteerops TO sentinel_backup;
GRANT USAGE ON SCHEMA public, prisma_contract TO sentinel_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public, prisma_contract TO sentinel_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, prisma_contract TO sentinel_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE sentinel_migrator IN SCHEMA public, prisma_contract GRANT SELECT ON TABLES TO sentinel_backup;
ALTER DEFAULT PRIVILEGES FOR ROLE sentinel_migrator IN SCHEMA public, prisma_contract GRANT SELECT ON SEQUENCES TO sentinel_backup;
ALTER ROLE sentinel_backup SET default_transaction_read_only = on;
ALTER ROLE sentinel_backup SET statement_timeout = '5min';
