import { Pool } from 'pg';
import { config } from '../core/config.js';
import { databasePoolConfig } from '../core/database-config.js';
import { logger } from '../core/logger.js';
const pool = new Pool({ ...databasePoolConfig(config), max: 1 });
try {
  const result = await pool.query('SELECT * FROM public.resq_operations_metrics');
  const storage = (await pool.query('SELECT * FROM public.resq_storage_metrics')).rows[0];
  logger.info('STORAGE_METRICS', storage);
  if (storage.quarantine_age_seconds > 300 || Number(storage.database_bytes) > 4_000_000_000) { logger.error('STORAGE_ALERT', storage); process.exitCode = 1; }
  if (process.env.READINESS_URL) { try { const response = await fetch(process.env.READINESS_URL, { signal: AbortSignal.timeout(10000), redirect: 'error' }); if (!response.ok) throw Error('NOT_READY'); } catch { logger.error('READINESS_ALERT'); process.exitCode = 1; } }
  for (const url of (process.env.WORKER_HEALTH_URLS ?? '').split(',').filter(Boolean)) {
    try { const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' }); if (!response.ok) throw Error('WORKER_STALE'); }
    catch { logger.error('WORKER_FRESHNESS_ALERT'); process.exitCode = 1; }
  }
  const alerts = result.rows.filter(row => Number(row.expired_leases) > 0 || Number(row.dead_jobs) > 0 || Number(row.oldest_seconds) > Number(process.env.QUEUE_ALERT_SECONDS ?? 300));
  logger.info('OPERATIONS_METRICS', { queues: result.rows });
  if (alerts.length) { logger.error('OPERATIONS_ALERT', { queues: alerts }); process.exitCode = 1; }
} finally { await pool.end(); }
