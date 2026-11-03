-- Apply after the portal_experience canonical migration. Idempotent, no ownership changes.
BEGIN;
ALTER TABLE public.portal_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_notification_reads FORCE ROW LEVEL SECURITY;
ALTER TABLE public.promo_codes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions FORCE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON public.portal_preferences,public.promo_codes TO sentinel_runtime_access;
GRANT SELECT,INSERT ON public.portal_notification_reads,public.promo_redemptions TO sentinel_runtime_access;
COMMIT;
