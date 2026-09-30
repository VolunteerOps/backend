import { Pool } from 'pg';
import { config } from '../core/config.js';
import { databasePoolConfig } from '../core/database-config.js';
import { pruneExpiredBatch } from '../core/retention.js';

// Run every five minutes using a scheduler with a dedicated non-owner database login.
// Every batch commits independently; overlapping invocations use SKIP LOCKED.
const pool = new Pool({ ...databasePoolConfig(config), max: 1 });
const started = Date.now();
const total = { forecasts: 0, receipts: 0, job_payloads: 0 };
try {
  for (let batch = 0; batch < 20 && Date.now() - started < 20_000; batch++) {
    const result = await pruneExpiredBatch(pool);
    for (const key of Object.keys(total) as Array<keyof typeof total>) total[key] += result[key];
    if (Object.values(result).every(count => count < 250)) break;
  }
  console.log(JSON.stringify({ event: 'SENTINEL_RETENTION_COMPLETED', ...total }));
} catch {
  console.error('SENTINEL_RETENTION_FAILED');
  process.exitCode = 1;
} finally { await pool.end(); }
