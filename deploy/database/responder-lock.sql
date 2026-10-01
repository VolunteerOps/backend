-- Execute as the operator. Only a boolean availability result crosses workspaces.
CREATE OR REPLACE FUNCTION public.resq_responder_reserve(responder integer,resource text,minutes integer,release boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE org text:=current_setting('vops.organization_id',true); actor integer:=nullif(current_setting('vops.user_id',true),'')::integer; occupied boolean;
BEGIN
 IF minutes<1 OR minutes>1440 OR length(resource)<1 OR length(resource)>200 THEN RAISE EXCEPTION 'INVALID_RESERVATION'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.organizations o ON o.id=m.organization_id JOIN public.users u ON u.id=m.user_id
 WHERE m.organization_id=org AND m.user_id=actor AND m.status='ACTIVE' AND m.role IN ('ORG_ADMIN','COORDINATOR') AND cardinality(m.region_ids)=0 AND o.status='ACTIVE' AND o.enrollment_ready AND u.is_active)
 OR NOT EXISTS(SELECT 1 FROM public.organization_memberships m JOIN public.users u ON u.id=m.user_id WHERE m.organization_id=org AND m.user_id=responder AND m.status='ACTIVE' AND u.is_active)
 THEN RAISE EXCEPTION 'RESERVATION_SCOPE_DENIED'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('resq:responder:'||responder,0));
 IF release THEN DELETE FROM public.responder_reservations WHERE user_id=responder AND organization_id=org AND resource_reference=resource; RETURN true; END IF;
 -- Suspension or removed membership invalidates that institution's reservation immediately.
 DELETE FROM public.responder_reservations r WHERE r.user_id=responder AND (r.expires_at<=timezone('UTC',now()) OR NOT EXISTS(
 SELECT 1 FROM public.organizations o JOIN public.organization_memberships m ON m.organization_id=o.id WHERE o.id=r.organization_id AND o.status='ACTIVE' AND m.user_id=responder AND m.status='ACTIVE'));
 SELECT EXISTS(SELECT 1 FROM public.responder_reservations WHERE user_id=responder AND (organization_id<>org OR resource_reference<>resource)) INTO occupied;
 IF occupied THEN RETURN false; END IF;
 INSERT INTO public.responder_reservations(user_id,organization_id,resource_reference,expires_at) VALUES(responder,org,resource,timezone('UTC',now())+make_interval(mins=>minutes))
 ON CONFLICT(user_id) DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.resq_responder_reserve(integer,text,integer,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resq_responder_reserve(integer,text,integer,boolean) TO sentinel_runtime_access;
GRANT SELECT ON public.responder_reservations TO sentinel_runtime_access;
