-- Install as bootstrap operator. Grant this NOLOGIN role only to a separately managed audit login.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sentinel_audit_export') THEN
CREATE ROLE sentinel_audit_export NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; END IF; END $$;
CREATE OR REPLACE VIEW public.resq_audit_export AS
SELECT id,organization_id,action,created_at FROM public.organization_audit;
REVOKE ALL ON public.resq_audit_export FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO sentinel_audit_export;
GRANT SELECT ON public.resq_audit_export TO sentinel_audit_export;
