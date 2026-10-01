import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { ObjectAddress } from './object-store.js';
/** A late PUT cannot race cleanup: upload credentials expire in minutes; pending cleanup waits a day.
 * CLEAN evidence is never automatically removed. Retain tombstones for metadata reconciliation. */
export async function reconcileStorage(pool: Pick<Pool, 'query'>, store: { remove(object: ObjectAddress): Promise<void> }) {
  const rows = await pool.query(`SELECT id, bucket, object_key, state FROM stored_objects
    WHERE (state = 'PENDING' AND expires_at < timezone('UTC',clock_timestamp()) - interval '1 day')
       OR (state = 'REJECTED' AND scanned_at < timezone('UTC',clock_timestamp()) - interval '7 days')
    ORDER BY expires_at, id LIMIT 20`);
  let deleted = 0;
  for (const row of rows.rows) {
    // Delete is idempotent. A crash before the metadata write leaves a retryable tombstone candidate.
    await store.remove({ bucket: row.bucket, objectKey: row.object_key });
    const result = await pool.query("UPDATE stored_objects SET state = 'DELETED' WHERE id = $1 AND state = $2", [row.id, row.state]);
    deleted += result.rowCount ?? 0;
  }
  // Repair missing outbox jobs, including legacy READY rows; never trust legacy READY as CLEAN.
  const legacy = await pool.query(`SELECT id, organization_id FROM stored_objects o
    WHERE state IN ('READY','QUARANTINED') AND NOT EXISTS
      (SELECT 1 FROM durable_jobs j WHERE j.business_key = 'storage-scan:' || o.id::text)
    ORDER BY created_at, id LIMIT 20`);
  for (const row of legacy.rows) await pool.query(`INSERT INTO durable_jobs
    (id,organization_id,queue,kind,business_key,payload,max_attempts,deadline)
    VALUES ($1,$2,'storage','STORAGE_SCAN_V1',$3,$4,8,timezone('UTC',clock_timestamp())+interval '1 day') ON CONFLICT DO NOTHING`,
    [randomUUID(),row.organization_id,'storage-scan:'+row.id,JSON.stringify({version:1,objectId:row.id})]);
  return { deleted, repaired: legacy.rows.length };
}
