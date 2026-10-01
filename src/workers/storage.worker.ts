import { reconcileStorage } from '../modules/scoped-storage/storage-lifecycle.js';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { z } from 'zod';
import { config } from '../core/config.js';
import { databasePoolConfig } from '../core/database-config.js';
import { executeJob, PermanentJobError, PostgresJobStore, type JobHandler } from '../core/jobs.js';
import { workerHealth } from '../core/worker-health.js';
import { configuredObjectStore } from '../modules/scoped-storage/object-store.js';
import { matchesContentType, matchesDigest, scanWithClamd } from '../modules/scoped-storage/content-scan.js';
const pool = new Pool(databasePoolConfig(config));
const store = new PostgresJobStore(pool), health = workerHealth(3002), owner = randomUUID(), shutdown = new AbortController();
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => shutdown.abort());
const payload = z.object({ version: z.literal(1), objectId: z.string().uuid() }).strict();
const handler: JobHandler = async (input, signal, job) => {
  const parsed = payload.safeParse(input); if (!parsed.success) throw new PermanentJobError();
  const result = await pool.query('SELECT * FROM stored_objects WHERE id = $1', [parsed.data.objectId]);
  const row = result.rows[0]; if (!row || ['CLEAN','REJECTED','DELETED'].includes(row.state)) return;
  if (!['QUARANTINED','READY'].includes(row.state)) throw new PermanentJobError();
  const bytes = await configuredObjectStore().readForScan({ bucket: row.bucket, objectKey: row.object_key, contentType: row.content_type,
    byteSize: row.byte_size, checksumSha256: row.checksum_sha256, fileName: row.file_name, etag: row.etag, versionId: row.version_id });
  const code = !matchesDigest(bytes, row.checksum_sha256) ? 'CHECKSUM_MISMATCH' : !matchesContentType(bytes, row.content_type) ? 'TYPE_MISMATCH' : await scanWithClamd(bytes, signal);
  // Fence scan publication too, so an expired worker cannot overwrite a newer verdict.
  await pool.query(`UPDATE stored_objects SET state = $2, scanned_at = timezone('UTC', clock_timestamp()), scan_code = $3
    WHERE id = $1 AND state IN ('QUARANTINED','READY') AND EXISTS (SELECT 1 FROM durable_jobs
      WHERE id = $4 AND fence = $5 AND lease_owner = $6 AND state = 'RUNNING' AND lease_until > timezone('UTC', clock_timestamp()))`,
    [row.id, code === 'CLEAN' ? 'CLEAN' : 'REJECTED', code, job.id, job.fence, job.lease_owner]);
};
try {
  const role = (await pool.query('SELECT current_user AS name')).rows[0];
  if (role.name !== 'sentinel_scanner') throw new Error('SCANNER_ROLE_REQUIRED');
  let nextReconcile = 0;
  while (!shutdown.signal.aborted) {
    try {
      if (Date.now() >= nextReconcile) { await reconcileStorage(pool, configuredObjectStore()); nextReconcile = Date.now() + 60000; }
      const job = await store.claim('storage', owner);
      if (job) await executeJob(store, job, new Map([['STORAGE_SCAN_V1', handler]]));
      health.progress(); if (!job) await delay(1000, undefined, { signal: shutdown.signal });
    } catch { if (!shutdown.signal.aborted) { console.error('STORAGE_WORKER_RETRY'); await delay(2000, undefined, { signal: shutdown.signal }).catch(() => {}); } }
  }
} finally { health.close(); await pool.end(); }
