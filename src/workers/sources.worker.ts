import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { config } from '../core/config.js';
import { databasePoolConfig } from '../core/database-config.js';
import { prisma } from '../core/prisma.js';
import { executeJob, PostgresJobStore, type JobHandler } from '../core/jobs.js';
import { workerHealth } from '../core/worker-health.js';
import { fetchUsgs } from '../modules/sentinel/providers/usgs.js';
import { fetchIncidentFeeds } from '../modules/sentinel/providers/incident-feeds.js';
import { importWorkerIncidents } from '../modules/sentinel/incidents.service.js';

if (process.env.SENTINEL_USGS_ENABLED !== 'true') throw new Error('USGS_WORKER_DISABLED');
const pool = new Pool({ ...databasePoolConfig(config), max: 1 }), store = new PostgresJobStore(pool);
const health = workerHealth(3002), owner = randomUUID(), shutdown = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => shutdown.abort());
const incidentHandler: JobHandler = async (_payload, signal) => {
  if (process.env.INCIDENT_FEEDS_ENABLED !== 'true') return;
  const { incidents } = await fetchIncidentFeeds(signal);
  if (!incidents.length) return;
  if(!Number.isSafeInteger(Number(process.env.INCIDENT_FEED_OWNER_USER_ID))||Number(process.env.INCIDENT_FEED_OWNER_USER_ID)<=0)throw new Error('INCIDENT_FEED_OWNER_REQUIRED');
  await prisma.$transaction(tx=>importWorkerIncidents(tx as never,Number(process.env.INCIDENT_FEED_OWNER_USER_ID),incidents),{timeout:30000});

};
const handlers = new Map<string, JobHandler>([['INCIDENT_PULL', incidentHandler], ['USGS_PULL', async (_payload, signal, job) => {
  const revisions = await fetchUsgs(signal);
  await prisma.$transaction(async tx => {
    const lease = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM durable_jobs WHERE id = ${job.id}
      AND fence = ${job.fence} AND lease_owner = ${job.lease_owner} AND state = 'RUNNING'
      AND lease_until > (clock_timestamp() AT TIME ZONE 'UTC') AND deadline > (clock_timestamp() AT TIME ZONE 'UTC') FOR UPDATE`;
    if (lease.length !== 1 || signal.aborted) throw new Error('LEASE_EXPIRED');
    await tx.$queryRaw`SELECT set_config('vops.provider_ingest', 'USGS', true)`;
    if (revisions.length) await tx.hazardRevision.createMany({ data: revisions.map(({ tsunamiWarning: _ignored, ...revision }) => revision), skipDuplicates: true });
    const completed = await tx.$executeRaw`UPDATE durable_jobs SET state = 'COMPLETED',
      completed_at = (clock_timestamp() AT TIME ZONE 'UTC'), lease_owner = NULL, lease_until = NULL
      WHERE id = ${job.id} AND fence = ${job.fence} AND lease_owner = ${job.lease_owner}
        AND lease_until > (clock_timestamp() AT TIME ZONE 'UTC') AND deadline > (clock_timestamp() AT TIME ZONE 'UTC')`;
    if (completed !== 1 || signal.aborted) throw new Error('LEASE_EXPIRED');
  }, { timeout: 10000 });
}]]);
try {
  while (!shutdown.signal.aborted) {
    try {
      // Durable minute keys coalesce multiple schedulers and survive process restarts.
      await pool.query(`INSERT INTO durable_jobs(id,queue,kind,business_key,payload,deadline)
        VALUES ($1,'public-feed','USGS_PULL','usgs:' || floor(extract(epoch FROM now()) / 60)::text,
          '{}'::jsonb,(clock_timestamp() AT TIME ZONE 'UTC') + interval '2 minutes')
        ON CONFLICT (business_key) DO NOTHING`, [randomUUID()]);
      if (process.env.INCIDENT_FEEDS_ENABLED === 'true') await pool.query(`INSERT INTO durable_jobs(id,queue,kind,business_key,payload,deadline)
        VALUES ($1,'public-feed','INCIDENT_PULL','incidents:' || floor(extract(epoch FROM now()) / 900)::text,
          '{}'::jsonb,(clock_timestamp() AT TIME ZONE 'UTC') + interval '20 minutes')
        ON CONFLICT (business_key) DO NOTHING`, [randomUUID()]);
      const job = await store.claim('public-feed', owner);
      if (job) await executeJob(store, job, handlers);
      health.progress();
      await delay(job ? 100 : 1000, undefined, { signal: shutdown.signal });
    } catch {
      if (shutdown.signal.aborted) break;
      console.error('PUBLIC_SOURCE_WORKER_RETRY');
      await delay(2000, undefined, { signal: shutdown.signal }).catch(() => {});
    }
  }
} finally { health.close(); await prisma.$disconnect(); await pool.end(); }
