import { traceContext } from './trace-context.js';
import type { Pool } from 'pg';
import { logger } from './logger.js';

export interface ClaimedJob {
  id: string; kind: string; payload: unknown; attempts: number; fence: number;
  lease_owner: string; deadline: Date | null;
}
export interface JobStore {
  claim(queue: string, owner: string): Promise<ClaimedJob | null>;
  complete(job: ClaimedJob): Promise<boolean>;
  fail(job: ClaimedJob, code: string, permanent?: boolean): Promise<boolean>;
}

export function retryDelayMs(attempts: number) {
  return Math.min(300_000, 1000 * 2 ** Math.min(18, Math.max(0, attempts - 1)));
}

/** A single SQL statement claims each job; no external work holds a transaction. */
export class PostgresJobStore implements JobStore {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async claim(queue: string, owner: string): Promise<ClaimedJob | null> {
    // Bound maintenance work, including workers that died on their final attempt.
    await this.pool.query(`WITH expired AS (
      SELECT id FROM durable_jobs WHERE queue = $1 AND state IN ('PENDING', 'RUNNING')
        AND (state = 'PENDING' OR lease_until <= (clock_timestamp() AT TIME ZONE 'UTC'))
        AND (deadline <= (clock_timestamp() AT TIME ZONE 'UTC') OR attempts >= max_attempts)
      ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT 100
    ) UPDATE durable_jobs j SET state = CASE WHEN j.deadline <= (clock_timestamp() AT TIME ZONE 'UTC') THEN 'EXPIRED' ELSE 'DEAD' END,
      lease_owner = NULL, lease_until = NULL, completed_at = (clock_timestamp() AT TIME ZONE 'UTC')
      FROM expired WHERE j.id = expired.id`, [queue]);
    const result = await this.pool.query<ClaimedJob>(`WITH candidate AS (
      SELECT candidate_job.id FROM durable_jobs candidate_job WHERE queue = $1
        AND (state = 'PENDING' OR (state = 'RUNNING' AND lease_until <= (clock_timestamp() AT TIME ZONE 'UTC')))
        AND available_at <= (clock_timestamp() AT TIME ZONE 'UTC') AND attempts < max_attempts
        AND (deadline IS NULL OR deadline > (clock_timestamp() AT TIME ZONE 'UTC'))
      ORDER BY COALESCE((SELECT max(served.last_claimed_at) FROM durable_jobs served
        WHERE served.queue = candidate_job.queue AND served.organization_id IS NOT DISTINCT FROM candidate_job.organization_id), '-infinity'::timestamp),
        priority - floor(extract(epoch FROM ((clock_timestamp() AT TIME ZONE 'UTC') - available_at)) / 30), available_at, id
      FOR UPDATE OF candidate_job SKIP LOCKED LIMIT 1
    ) UPDATE durable_jobs j SET state = 'RUNNING', attempts = j.attempts + 1,
      fence = j.fence + 1, lease_owner = $2, last_claimed_at = (clock_timestamp() AT TIME ZONE 'UTC'),
      lease_until = (clock_timestamp() AT TIME ZONE 'UTC') + interval '60 seconds'
      FROM candidate WHERE j.id = candidate.id
      RETURNING j.id, j.kind, j.payload, j.attempts, j.fence, j.lease_owner, j.deadline AT TIME ZONE 'UTC' AS deadline`, [queue, owner]);
    return result.rows[0] ?? null;
  }

  async complete(job: ClaimedJob) {
    const result = await this.pool.query(`UPDATE durable_jobs SET state = 'COMPLETED',
      completed_at = (clock_timestamp() AT TIME ZONE 'UTC'), lease_owner = NULL, lease_until = NULL, last_error = NULL
      WHERE id = $1 AND fence = $2 AND lease_owner = $3 AND state = 'RUNNING'
        AND lease_until > (clock_timestamp() AT TIME ZONE 'UTC') AND (deadline IS NULL OR deadline > (clock_timestamp() AT TIME ZONE 'UTC'))`,
    [job.id, job.fence, job.lease_owner]);
    return result.rowCount === 1;
  }

  async fail(job: ClaimedJob, code: string, permanent = false) {
    // Error codes only: provider messages can contain credentials or personal data.
    if (!/^[A-Z0-9_]{1,64}$/.test(code)) code = 'JOB_FAILED';
    const result = await this.pool.query(`UPDATE durable_jobs SET
      state = CASE WHEN deadline <= (clock_timestamp() AT TIME ZONE 'UTC') THEN 'EXPIRED'
        WHEN $5 OR attempts >= max_attempts THEN 'DEAD' ELSE 'PENDING' END,
      available_at = (clock_timestamp() AT TIME ZONE 'UTC') + ($4 * interval '1 millisecond'),
      last_error = $6, lease_owner = NULL, lease_until = NULL
      WHERE id = $1 AND fence = $2 AND lease_owner = $3 AND state = 'RUNNING'
        AND lease_until > (clock_timestamp() AT TIME ZONE 'UTC')`,
    [job.id, job.fence, job.lease_owner, retryDelayMs(job.attempts), permanent, code]);
    return result.rowCount === 1;
  }
}

export class PermanentJobError extends Error {}
export type JobHandler = (payload: unknown, signal: AbortSignal, job: ClaimedJob) => Promise<void>;

export async function executeJob(store: JobStore, job: ClaimedJob, handlers: ReadonlyMap<string, JobHandler>) {
  const started = performance.now();
  const handler = handlers.get(job.kind);
  if (!handler) { await store.fail(job, 'UNSUPPORTED_JOB_KIND', true); return; }
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    if (job.deadline && job.deadline.getTime() <= Date.now()) {
      await store.fail(job, 'DEADLINE_EXCEEDED', true); return;
    }
    // Leave time for the fenced completion write before the 60-second lease expires.
    await Promise.race([
      traceContext.run({ job_id: job.id }, () => handler(job.payload, controller.signal, job)),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => { controller.abort(); reject(new Error('JOB_TIMEOUT')); }, 20_000);
      }),
    ]);
    const completed = await store.complete(job);
    logger.info('JOB_RESULT', { job_id: job.id, kind: job.kind, fence: job.fence, attempt: job.attempts, outcome: completed ? 'completed' : 'lease_lost', duration_ms: Math.round(performance.now() - started) });
  } catch (error) {
    const code = error instanceof PermanentJobError ? 'INVALID_JOB_PAYLOAD' : 'JOB_FAILED';
    await store.fail(job, code, error instanceof PermanentJobError);
    logger.warn('JOB_RESULT', { job_id: job.id, kind: job.kind, fence: job.fence, attempt: job.attempts, outcome: code, duration_ms: Math.round(performance.now() - started) });
  } finally {
    if (timeout) clearTimeout(timeout);
    controller.abort();
  }
}

