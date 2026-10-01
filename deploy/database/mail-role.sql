-- Apply as the database operator after creating the dedicated sentinel_mail LOGIN.
-- No profile, private contact, token hash, or other organization's operational data is exposed.
GRANT USAGE ON SCHEMA public TO sentinel_mail;
REVOKE ALL ON public.durable_jobs FROM sentinel_mail;
CREATE OR REPLACE VIEW public.resq_invitation_jobs AS
 SELECT * FROM public.durable_jobs WHERE queue='invitation-email' AND kind='INVITATION_EMAIL_V1'
 WITH LOCAL CHECK OPTION;
REVOKE ALL ON public.resq_invitation_jobs FROM PUBLIC;
GRANT SELECT ON public.resq_invitation_jobs TO sentinel_mail;
GRANT UPDATE (state,attempts,fence,lease_owner,lease_until,last_claimed_at,completed_at,available_at,last_error)
 ON public.resq_invitation_jobs TO sentinel_mail;
CREATE OR REPLACE VIEW public.resq_pending_invitation_email AS
SELECT i.id,i.recipient_email,o.display_name
FROM public.organization_invitations i JOIN public.organizations o ON o.id=i.organization_id
JOIN public.users issuer ON issuer.id=i.issuer_user_id
LEFT JOIN public.organization_memberships m ON m.id=i.issuer_membership_id AND m.organization_id=i.organization_id
LEFT JOIN public.platform_grants g ON g.user_id=i.issuer_user_id
WHERE i.accepted_at IS NULL AND i.revoked_at IS NULL AND i.declined_at IS NULL AND i.expires_at>timezone('UTC',now())
AND o.status='ACTIVE' AND o.enrollment_ready AND issuer.is_active
AND ((i.issuer_membership_id IS NULL AND g.active AND g.role='TECH_ADMIN') OR
 (m.status='ACTIVE' AND m.version=i.issuer_membership_version AND m.user_id=i.issuer_user_id AND cardinality(m.region_ids)=0 AND
 (m.role='ORG_ADMIN' OR (m.role='COORDINATOR' AND i.role IN ('TEAM_LEAD','VOLUNTEER')))))
AND NOT EXISTS (SELECT 1 FROM public.recruitment_blocks b JOIN public.users u ON u.id=b.user_id
 WHERE b.organization_id=i.organization_id AND lower(u.email)=i.recipient_email);
REVOKE ALL ON public.resq_pending_invitation_email FROM PUBLIC;
GRANT SELECT ON public.resq_pending_invitation_email TO sentinel_mail;
CREATE OR REPLACE FUNCTION public.resq_mark_invitation_sent(invitation text,job text,claim integer,worker text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 WITH changed AS (UPDATE public.organization_invitations i SET delivery_status='PROVIDER_ACCEPTED'
 WHERE i.id=invitation AND EXISTS (SELECT 1 FROM public.durable_jobs j WHERE j.id=job AND j.fence=claim AND j.lease_owner=worker
 AND j.state='RUNNING' AND j.lease_until>timezone('UTC',clock_timestamp()) AND j.queue='invitation-email'
 AND j.kind='INVITATION_EMAIL_V1' AND j.payload->>'invitationId'=i.id) RETURNING id)
 SELECT EXISTS (SELECT 1 FROM changed)
$$;
REVOKE ALL ON FUNCTION public.resq_mark_invitation_sent(text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resq_mark_invitation_sent(text,text,integer,text) TO sentinel_mail;
