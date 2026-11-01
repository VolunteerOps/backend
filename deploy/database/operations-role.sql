-- Apply after the stage3_operations contract migration, using the database operator.
-- This grants only the existing restricted API runtime group; no additional login is created.
BEGIN;
ALTER TABLE public.pro_sponsorships FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.pro_sponsorships TO sentinel_runtime_access;
ALTER TABLE public.operation_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.operation_receipts FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.operation_records TO sentinel_runtime_access;
GRANT SELECT,INSERT ON public.operation_receipts TO sentinel_runtime_access;
GRANT USAGE,SELECT ON SEQUENCE public.operation_records_sequence_seq TO sentinel_runtime_access;
CREATE OR REPLACE FUNCTION public.resq_responder_release_own(resource text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actor integer:=nullif(current_setting('vops.user_id',true),'')::integer;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.organization_memberships WHERE organization_id=current_setting('vops.organization_id',true) AND user_id=actor AND status='ACTIVE') THEN RAISE EXCEPTION 'MEMBERSHIP_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('resq:responder:'||actor,0));
 DELETE FROM public.responder_reservations WHERE user_id=actor AND organization_id=current_setting('vops.organization_id',true) AND resource_reference=resource;
END $$;
REVOKE ALL ON FUNCTION public.resq_responder_release_own(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resq_responder_release_own(text) TO sentinel_runtime_access;
COMMIT;
