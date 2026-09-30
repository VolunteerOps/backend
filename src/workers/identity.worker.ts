import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { z } from 'zod';
import { config } from '../core/config.js';
import { databasePoolConfig } from '../core/database-config.js';
import { getFirebaseIdentityVerifier } from '../core/firebase.js';
import { executeJob, PermanentJobError, PostgresJobStore, type JobHandler } from '../core/jobs.js';
import { workerHealth } from '../core/worker-health.js';

const pool = new Pool(databasePoolConfig(config));
const store = new PostgresJobStore(pool);
// Reject a missing/unsafe Firebase configuration before claiming any durable work.
const verifier = getFirebaseIdentityVerifier();
const health = workerHealth(3002);
const owner = randomUUID();
const shutdown = new AbortController();
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => shutdown.abort());
const payloadSchema = z.object({ projectId: z.string().min(1), uid: z.string().min(1).max(128) }).strict();
const handlers = new Map<string, JobHandler>([['FIREBASE_REVOKE_SESSIONS', async payload => {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || parsed.data.projectId !== process.env.FIREBASE_PROJECT_ID) throw new PermanentJobError();
  await verifier.revokeAllSessions(parsed.data.uid);
}]]);

try {
  while (!shutdown.signal.aborted) {
    try {
      const job = await store.claim('identity', owner);
      if (job) await executeJob(store, job, handlers);
      health.progress();
      if (!job) await delay(1000, undefined, { signal: shutdown.signal });
    } catch {
      if (shutdown.signal.aborted) break;
      console.error('IDENTITY_WORKER_RETRY');
      await delay(2000, undefined, { signal: shutdown.signal }).catch(() => {});
    }
  }
} finally { health.close(); await pool.end(); }
