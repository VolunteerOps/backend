import type { Pool } from 'pg';

export interface RetentionResult { forecasts: number; receipts: number; job_payloads: number }
/** Expiry is enforced again by RLS. Audit records and job idempotency keys remain. */
export async function pruneExpiredBatch(pool: Pick<Pool, 'connect'>, limit = 250): Promise<RetentionResult> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('INVALID_RETENTION_LIMIT');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout = '5s'");
    const role = await client.query<{ unsafe: boolean }>(`SELECT EXISTS (
      SELECT 1 FROM pg_roles WHERE (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)
        AND pg_has_role(current_user, oid, 'MEMBER')) OR EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN ('forecast_runs','ingress_receipts','durable_jobs')
        AND pg_has_role(current_user, c.relowner, 'MEMBER')) AS unsafe`);
    if (role.rows.length !== 1 || role.rows[0].unsafe) throw new Error('UNSAFE_RETENTION_ROLE');
    await client.query("SELECT set_config('vops.retention', 'true', true), set_config('vops.user_id','',true), set_config('vops.organization_id','',true), set_config('vops.region_id','',true), set_config('vops.roster','',true), set_config('vops.platform','',true)");
    const forecasts = await client.query(`WITH expired AS (
      SELECT id FROM public.forecast_runs WHERE expires_at <= (clock_timestamp() AT TIME ZONE 'UTC')
        ORDER BY expires_at, id FOR UPDATE SKIP LOCKED LIMIT $1
    ) DELETE FROM public.forecast_runs f USING expired WHERE f.id = expired.id`, [limit]);
    const receipts = await client.query(`WITH expired AS (
      SELECT id FROM public.ingress_receipts WHERE expires_at <= (clock_timestamp() AT TIME ZONE 'UTC')
        ORDER BY expires_at, id FOR UPDATE SKIP LOCKED LIMIT $1
    ) DELETE FROM public.ingress_receipts r USING expired WHERE r.id = expired.id`, [limit]);
    // Keep terminal job tombstones/business keys, but remove actor and input payloads after seven days.
    // Active/leased jobs are never scrubbed, even when their original enqueue time is old.
    const jobs = await client.query(`WITH expired AS (
      SELECT id FROM public.durable_jobs WHERE state IN ('COMPLETED','DEAD','EXPIRED')
        AND payload <> '{}'::jsonb
        AND COALESCE(completed_at, last_claimed_at, available_at) <
          (clock_timestamp() AT TIME ZONE 'UTC') - interval '7 days'
        ORDER BY COALESCE(completed_at, last_claimed_at, available_at), id FOR UPDATE SKIP LOCKED LIMIT $1
    ) UPDATE public.durable_jobs j SET payload = '{}'::jsonb FROM expired WHERE j.id = expired.id
      AND j.state IN ('COMPLETED','DEAD','EXPIRED')`, [limit]);
    await client.query('COMMIT');
    return { forecasts: forecasts.rowCount ?? 0, receipts: receipts.rowCount ?? 0, job_payloads: jobs.rowCount ?? 0 };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}
