-- Apply after the stage4_personal_usage canonical migration.
BEGIN;
ALTER TABLE public.usage_ledger FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.usage_ledger TO sentinel_runtime_access;
COMMIT;
