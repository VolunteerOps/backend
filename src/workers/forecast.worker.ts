import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { z } from 'zod';
import { config } from '../core/config.js';
import { databasePoolConfig } from '../core/database-config.js';
import { prisma } from '../core/prisma.js';
import { ApiError } from '../core/errors.js';
import { executeJob, PermanentJobError, PostgresJobStore, type JobHandler } from '../core/jobs.js';
import { workerHealth } from '../core/worker-health.js';
import { configuredForecastProvider, refreshSchema, saveForecastBatch } from '../modules/sentinel/sentinel.service.js';
import { boundsSchema } from '../modules/sentinel/providers/weathernext3.contract.js';
import { generateWatchBrief } from '../modules/sentinel/specialised.service.js';
import { withRegion } from '../modules/sentinel/sentinel.context.js';
const payloadSchema = z.object({
  organizationId: z.string().uuid(), regionId: z.string().uuid(), bounds: boundsSchema,
  policyVersion: z.number().int().positive(), request: refreshSchema,
  actor: z.object({ userId: z.number().int().positive(), identity: z.object({
    projectId: z.string(), uid: z.string(), email: z.string().email(), authTime: z.number().int(),
    expiresAt: z.number().int(), signInProvider: z.string(), secondFactor: z.enum(['totp', 'phone']).nullable(),
  }).strict() }).strict(),
}).strict();
const watchPayloadSchema = z.object({
  organizationId: z.string().uuid(), regionId: z.string().uuid(),
  actor: z.object({ userId: z.number().int().positive(), identity: z.object({
    projectId: z.string(), uid: z.string(), email: z.string().email(), authTime: z.number().int(),
    expiresAt: z.number().int(), signInProvider: z.string(), secondFactor: z.enum(['totp', 'phone']).nullable(),
  }).strict() }).strict(),
}).strict();
const watchHandler: JobHandler = async (payload, _signal, job) => {
  const parsed = watchPayloadSchema.safeParse(payload);
  if (!parsed.success) throw new PermanentJobError();
  await generateWatchBrief(parsed.data.actor as never, parsed.data.organizationId, parsed.data.regionId, job.id);
};
const provider = configuredForecastProvider();
const pool = new Pool(databasePoolConfig(config)), store = new PostgresJobStore(pool);
const health = workerHealth(3002), owner = randomUUID(), shutdown = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => shutdown.abort());
const handler: JobHandler = async (payload, signal, job) => {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new PermanentJobError();
  const p = parsed.data;
  try {
    // Validate current authorization before any billed provider query; validate again before committing results.
    await withRegion(p.actor, p.organizationId, p.regionId, true, async () => {});
    const batch = await provider.fetch({ initTime: p.request.init_time, fromHour: p.request.from_hour,
      toHour: p.request.to_hour, bounds: p.bounds }, signal);
    await saveForecastBatch(p.actor, p.organizationId, p.regionId, p.policyVersion, batch, job, signal);
  } catch (error) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.statusCode)) throw new PermanentJobError();
    throw error;
  }
};
try {
  while (!shutdown.signal.aborted) {
    try {
      const job = await store.claim('forecast', owner);
      if (job) await executeJob(store, job, new Map<string, JobHandler>([['WEATHERNEXT_REFRESH', handler], ['WATCH_BRIEF', watchHandler]]));
      health.progress();
      if (!job) await delay(1000, undefined, { signal: shutdown.signal });
    } catch {
      if (shutdown.signal.aborted) break;
      console.error('FORECAST_WORKER_RETRY');
      await delay(2000, undefined, { signal: shutdown.signal }).catch(() => {});
    }
  }
} finally { health.close(); await prisma.$disconnect(); await pool.end(); }
