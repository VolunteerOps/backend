-- Run as the bootstrap operator after migrations, in the target database.
-- This creates a NOLOGIN permission role. A separately provisioned LOGIN role
-- receives this role; set its password through your secret manager or psql \password.
-- Do not grant ownership, BYPASSRLS, CREATE, or migration tables to runtime.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sentinel_runtime_access') THEN
    CREATE ROLE sentinel_runtime_access NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO sentinel_runtime_access;
GRANT SELECT, INSERT, UPDATE ON
  public.users, public.firebase_identities, public.durable_jobs,
  public.organizations, public.organization_units, public.organization_memberships,
  public.organization_invitations, public.organization_audit, public.platform_grants,
  public.member_devices, public.ingress_receipts, public.forecast_runs, public.hazard_revisions,
  public.audit_logs
TO sentinel_runtime_access;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sentinel_runtime_access;
-- Legacy operational tables stay inaccessible until their scoped service cutover.
-- Re-run explicit grants when a reviewed migration introduces a required table.

GRANT SELECT, INSERT ON public.contact_submissions TO sentinel_runtime_access;

GRANT SELECT, INSERT ON public.stored_objects TO sentinel_runtime_access;
GRANT UPDATE (state, completed_at, etag, version_id) ON public.stored_objects TO sentinel_runtime_access;

-- Expose only the schema hash, never migration SQL or the full contract.
CREATE OR REPLACE VIEW public.resq_schema_readiness AS SELECT core_hash FROM prisma_contract.marker WHERE space = 'app';
GRANT SELECT ON public.resq_schema_readiness TO sentinel_runtime_access;

-- Stage 2: owner-only records and recruitment projections have canonical RLS policies.
GRANT SELECT, INSERT, UPDATE ON public.volunteer_profiles, public.directory_preferences, public.profile_shares, public.recruitment_blocks, public.join_requests, public.account_deletion_requests, public.recruitment_reports TO sentinel_runtime_access;
GRANT SELECT, INSERT ON public.consent_records, public.personal_audit TO sentinel_runtime_access;

GRANT SELECT, INSERT, UPDATE ON public.domain_claims, public.support_access_grants, public.coordination_grants, public.partner_applications TO sentinel_runtime_access;
