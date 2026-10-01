-- Aggregate-only diagnostics; no payloads, object keys or user identifiers.
CREATE OR REPLACE VIEW public.resq_operations_metrics AS
SELECT queue, count(*) FILTER (WHERE state = 'PENDING')::integer AS pending,
 count(*) FILTER (WHERE state = 'RUNNING' AND lease_until < timezone('UTC',clock_timestamp()))::integer AS expired_leases,
 count(*) FILTER (WHERE state = 'DEAD')::integer AS dead_jobs,
 coalesce(max(extract(epoch FROM (timezone('UTC',clock_timestamp())-available_at))) FILTER (WHERE state = 'PENDING'),0)::integer AS oldest_seconds
FROM public.durable_jobs GROUP BY queue;
REVOKE ALL ON public.resq_operations_metrics FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO sentinel_monitor;
GRANT SELECT ON public.resq_operations_metrics TO sentinel_monitor;

CREATE OR REPLACE VIEW public.resq_storage_metrics AS
SELECT count(*) FILTER (WHERE state IN ('QUARANTINED','READY'))::integer AS quarantined,
coalesce(max(extract(epoch FROM (timezone('UTC',clock_timestamp())-completed_at))) FILTER (WHERE state IN ('QUARANTINED','READY')),0)::integer AS quarantine_age_seconds,
coalesce(sum(byte_size) FILTER (WHERE state != 'DELETED'),0)::bigint AS reserved_bytes,
pg_database_size(current_database()) AS database_bytes
FROM public.stored_objects;
REVOKE ALL ON public.resq_storage_metrics FROM PUBLIC;
GRANT SELECT ON public.resq_storage_metrics TO sentinel_monitor;
