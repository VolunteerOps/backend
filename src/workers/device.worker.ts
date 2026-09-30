import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { config } from '../core/config.js';
import { databasePoolConfig } from '../core/database-config.js';
import { prisma } from '../core/prisma.js';
import { executeJob, PostgresJobStore } from '../core/jobs.js';
import { workerHealth } from '../core/worker-health.js';
import { deviceHeartbeatHandler } from './device-handler.js';

const pool = new Pool(databasePoolConfig(config));
const store = new PostgresJobStore(pool);
const health = workerHealth(3002);
const owner = randomUUID();
const shutdown = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => shutdown.abort());
const handlers = new Map([['DEVICE_HEARTBEAT', deviceHeartbeatHandler]]);
try {
  while (!shutdown.signal.aborted) {
    try {
      const job = await store.claim('device', owner);
      if (job) await executeJob(store, job, handlers);
      health.progress();
      if (!job) await delay(1000, undefined, { signal: shutdown.signal });
    } catch {
      if (shutdown.signal.aborted) break;
      console.error('DEVICE_WORKER_RETRY');
      await delay(2000, undefined, { signal: shutdown.signal }).catch(() => {});
    }
  }
} finally { health.close(); await prisma.$disconnect(); await pool.end(); }
