-- Run as the migration owner; provision a separate LOGIN and grant this permission role.
-- This role cannot read current forecasts/receipts, change consent, or modify audit records.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sentinel_retention_access') THEN
    CREATE ROLE sentinel_retention_access NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO sentinel_retention_access;
GRANT SELECT, DELETE ON public.forecast_runs, public.ingress_receipts TO sentinel_retention_access;
-- Row locking needs UPDATE privilege; RLS has no UPDATE policy for either immutable table.
GRANT UPDATE ON public.forecast_runs, public.ingress_receipts TO sentinel_retention_access;
GRANT SELECT ON public.durable_jobs TO sentinel_retention_access;
GRANT UPDATE (payload) ON public.durable_jobs TO sentinel_retention_access;
-- PostgreSQL checks relation privileges for every policy subquery. These stay RLS-filtered.
GRANT SELECT ON public.member_devices, public.organization_memberships TO sentinel_retention_access;
