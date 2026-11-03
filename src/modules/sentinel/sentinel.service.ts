import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ApiError } from '../../core/errors.js';
import { withActor, requireOrganization, type Actor } from '../organizations/context.js';
import { withRegion } from './sentinel.context.js';
import { boundsSchema, forecastHorizon, type ForecastCell } from './providers/weathernext3.contract.js';
import { assessForecast, forecastPolicySchema } from './forecast-assessment.js';
import { WeatherNext3BigQuery, type ForecastBatch } from './providers/weathernext3.bigquery.js';
import { type ClaimedJob, PermanentJobError } from '../../core/jobs.js';

export const regionConfigSchema = z.object({
  name: z.string().trim().min(2).max(120), bounds: boundsSchema, policy: forecastPolicySchema,
  reason: z.string().trim().min(10).max(500),
}).strict();
export const latestRefreshSchema=z.object({hours:z.number().int().min(1).max(48).default(24)}).strict();
export const refreshSchema = z.object({
  init_time: z.string().datetime(), from_hour: z.number().int().min(1).max(360),
  to_hour: z.number().int().min(1).max(360),
}).strict().superRefine((value, context) => {
  try {
    if (value.to_hour < value.from_hour || value.to_hour - value.from_hour > 47 || value.to_hour > forecastHorizon(value.init_time)) {
      context.addIssue({ code: 'custom', path:['to_hour'], message: 'Choose an end hour after the start hour, covering no more than 48 hours and staying within the published forecast period.' });
    }
  } catch { context.addIssue({ code: 'custom', path:['init_time'], message: 'The minutes must be 00, for example 18:00 rather than 18:35. Use the latest forecast option to select a published forecast automatically.' }); }
});
export function configuredForecastSettings() {
  if (!process.env.WEATHERNEXT_PROJECT_ID || !process.env.WEATHERNEXT_DATASET_ID ||
      !process.env.WEATHERNEXT_MAX_BYTES_BILLED || process.env.WEATHERNEXT_ACCESS_ENABLED !== 'true') {
    throw new ApiError(503, 'WEATHERNEXT_NOT_CONFIGURED', 'WeatherNext project, dataset, access and query budget must be configured');
  }
  return {
    projectId: process.env.WEATHERNEXT_PROJECT_ID, billingProjectId: process.env.WEATHERNEXT_BILLING_PROJECT_ID, datasetId: process.env.WEATHERNEXT_DATASET_ID,
    location: process.env.WEATHERNEXT_LOCATION || 'US',
    maximumBytesBilled: Number(process.env.WEATHERNEXT_MAX_BYTES_BILLED), maxRows: 10000,
  };
}
export function configuredForecastProvider(){return new WeatherNext3BigQuery(configuredForecastSettings());}
export const SentinelService = {
  async hazards(actor: Actor, organizationId: string, regionId: string) {
    return withRegion(actor, organizationId, regionId, false, async tx => {
      const region = await tx.organizationUnit.findUniqueOrThrow({ where: { id: regionId } });
      const b = boundsSchema.parse(region.forecastBounds);
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`WITH latest AS (
        SELECT DISTINCT ON (source, external_id) * FROM hazard_revisions
        ORDER BY source, external_id, revision_at DESC, received_at DESC
      ) SELECT id, source, external_id, revision_at, observed_at, longitude::float8 AS longitude,
        latitude::float8 AS latitude, magnitude::float8 AS magnitude, depth_km::float8 AS depth_km,
        status, title, source_url FROM latest
      WHERE status <> 'deleted' AND observed_at > (clock_timestamp() AT TIME ZONE 'UTC') - interval '24 hours'
        AND latitude BETWEEN ${b.south} AND ${b.north}
        AND CASE WHEN ${b.west} < ${b.east} THEN longitude BETWEEN ${b.west} AND ${b.east}
          ELSE longitude >= ${b.west} OR longitude <= ${b.east} END
      ORDER BY observed_at DESC, id LIMIT 501`;
      return { source: 'USGS', observations: rows.slice(0, 500), truncated: rows.length > 500,
        interpretation: 'Reported earthquake observations; no guaranteed advance warning or tsunami warning.' };
    });
  },
  async regions(actor: Actor, organizationId: string) {
    return withActor(actor, async tx => {
      const { member } = await requireOrganization(tx, actor, organizationId, 'organization.read');
      return tx.organizationUnit.findMany({ where: { organizationId, active: true,
        ...(member.regionIds.length ? { id: { in: member.regionIds } } : {}) },
        select: { id: true, name: true, forecastBounds: true, forecastPolicy: true }, take: 100, orderBy: { id: 'asc' } });
    });
  },
  async configureRegion(actor: Actor, organizationId: string, regionId: string, input: z.infer<typeof regionConfigSchema>) {
    const data = regionConfigSchema.parse(input);
    return withActor(actor, async tx => {
      await requireOrganization(tx, actor, organizationId, 'sentinel.configure');
      await tx.$queryRaw`SELECT set_config('vops.operations', 'true', true), set_config('vops.all_regions', 'true', true)`;
      const current = await tx.organizationUnit.findFirst({ where: { organizationId, id: regionId } });
      const previous = current?.forecastPolicy ? forecastPolicySchema.parse(current.forecastPolicy) : null;
      if (data.policy.version !== (previous?.version ?? 0) + 1) throw ApiError.conflict('Policy version must increment by one', 'STALE_VERSION');
      const region = current ? await tx.organizationUnit.update({ where: { id: regionId },
        data: { name: data.name, forecastBounds: data.bounds, forecastPolicy: data.policy } }) :
        await tx.organizationUnit.create({ data: { id: regionId, organizationId, name: data.name,
          forecastBounds: data.bounds, forecastPolicy: data.policy } });
      await tx.organizationAudit.createMany({ data: { id: randomUUID(), organizationId, actorUserId: actor.userId,
        action: 'FORECAST_REGION_CONFIGURED', reason: data.reason, metadata: { region_id: regionId, policy_version: data.policy.version } } });
      return region;
    });
  },
  async refreshLatest(actor:Actor,organizationId:string,regionId:string,hours:number) {
    const snapshot=await withRegion(actor,organizationId,regionId,true,async tx=>{
      const row=await tx.organizationUnit.findUniqueOrThrow({where:{id:regionId}});
      return {bounds:boundsSchema.parse(row.forecastBounds),policy:forecastPolicySchema.parse(row.forecastPolicy)};
    });
    // No database transaction is held open during the provider lookup. Recheck authority and policy afterwards.
    const request=await configuredForecastProvider().latestRequest(snapshot.bounds,hours,snapshot.policy.maximum_run_age_hours,AbortSignal.timeout(40000));
    const job=await SentinelService.refresh(actor,organizationId,regionId,{init_time:request.initTime,from_hour:request.fromHour,to_hour:request.toHour},snapshot);
    return {...job,init_time:request.initTime,from_hour:request.fromHour,to_hour:request.toHour};
  },
  async refresh(actor: Actor, organizationId: string, regionId: string, input: z.infer<typeof refreshSchema>, selected?:{bounds:z.infer<typeof boundsSchema>;policy:z.infer<typeof forecastPolicySchema>}) {
    configuredForecastProvider();
    const data = refreshSchema.parse(input);
    if (Date.parse(data.init_time) > Date.now() || Date.now() - Date.parse(data.init_time) > 48 * 3600000) {
      throw new ApiError(400,Date.parse(data.init_time)>Date.now()?'FORECAST_CYCLE_FUTURE':'STALE_FORECAST_RUN','Choose the latest forecast option, or a recently published forecast.');
    }
    return withRegion(actor, organizationId, regionId, true, async tx => {
      const region = await tx.organizationUnit.findUniqueOrThrow({ where: { id: regionId } });
      const bounds = boundsSchema.parse(region.forecastBounds);
      const policy = forecastPolicySchema.parse(region.forecastPolicy);
      if(selected&&(JSON.stringify(bounds)!==JSON.stringify(selected.bounds)||policy.version!==selected.policy.version))throw new ApiError(409,'VERSION_CONFLICT','The region changed while finding a forecast.');
      if (Date.now() - Date.parse(data.init_time) >= policy.maximum_run_age_hours * 3600000) {
        throw new ApiError(400, 'STALE_FORECAST_RUN', 'The selected run is older than this region permits');
      }
      const businessKey = JSON.stringify(['forecast', organizationId, regionId, data, policy.version]);
      const existing = await tx.durableJob.findUnique({ where: { businessKey } });
      if (existing) return { job_id: existing.id, state: existing.state };
      const job = await tx.durableJob.create({ data: { id: randomUUID(), organizationId, priority: 2, queue: 'forecast', kind: 'WEATHERNEXT_REFRESH',
        businessKey, deadline: new Date(Date.now() + 180000), maxAttempts: 2,
        payload: JSON.parse(JSON.stringify({ actor, organizationId, regionId, bounds, policyVersion: policy.version, request: data })) } });
      await tx.organizationAudit.createMany({ data: { id: randomUUID(), organizationId, actorUserId: actor.userId,
        action: 'FORECAST_REFRESH_REQUESTED', reason: 'Coordinator requested bounded forecast refresh', metadata: { region_id: regionId, job_id: job.id } } });
      return { job_id: job.id, state: job.state };
    });
  },
  async latest(actor: Actor, organizationId: string, regionId: string) {
    return withRegion(actor, organizationId, regionId, false, async tx => {
      const region = await tx.organizationUnit.findUniqueOrThrow({ where: { id: regionId } });
      const run = await tx.forecastRun.findFirst({ where: { organizationId, regionId },
        orderBy: [{ initTime: 'desc' }, { retrievedAt: 'desc' }] });
      if (!run) return { status: 'UNAVAILABLE' as const, region: { id: region.id, name: region.name }, run: null,
        cells: [] as ForecastCell[], assessment: null };
      const cells = run.cells as unknown as ForecastCell[];
      const policy = forecastPolicySchema.parse(region.forecastPolicy);
      let assessment = assessForecast(cells, policy);
      const expiresAt = new Date(Math.min(run.expiresAt.getTime(), run.initTime.getTime() + policy.maximum_run_age_hours * 3600000));
      if (expiresAt.getTime() <= Date.now()) assessment = { ...assessment, indicators: [], stale_cells: cells.length };
      return { status: expiresAt.getTime() <= Date.now() ? 'STALE' as const : 'AVAILABLE' as const,
        region: { id: region.id, name: region.name },
        run: { id: run.id, source: run.source, model: run.model, init_time: run.initTime,
          retrieved_at: run.retrievedAt, expires_at: expiresAt, quality: run.quality },
        cells: expiresAt.getTime() <= Date.now() ? [] : cells, assessment };
    });
  },
  async insights(actor: Actor, organizationId: string, regionId: string) {
    const latest = await this.latest(actor, organizationId, regionId);
    const counts: Record<string, number> = {};
    for (const indicator of latest.assessment?.indicators ?? []) counts[indicator.kind] = (counts[indicator.kind] ?? 0) + 1;
    return { status: latest.status, region: latest.region, run: latest.run,
      forecast_indicators: counts, validation: 'UNVALIDATED_INDICATORS',
      message: latest.status === 'AVAILABLE' ? 'Review forecast trends alongside official warnings. These indicators do not authorize movement.' :
        'Current forecast coverage is unavailable. Follow official local emergency guidance.',
      movement_order: null, missing_values: latest.assessment?.missing_values ?? null };
  },
  async retry(actor: Actor, organizationId: string, regionId: string, jobId: string, reason: string) {
    configuredForecastProvider();
    const reviewedReason = z.string().trim().min(10).max(500).parse(reason);
    return withRegion(actor, organizationId, regionId, true, async tx => {
      const job = await tx.durableJob.findUnique({ where: { id: jobId } });
      const payload = job?.payload as { organizationId?: string; regionId?: string; request?: unknown } | undefined;
      if (!job || job.queue !== 'forecast' || job.kind !== 'WEATHERNEXT_REFRESH' || payload?.organizationId !== organizationId || payload.regionId !== regionId) throw ApiError.notFound('Job');
      if (!['DEAD', 'EXPIRED'].includes(job.state)) throw ApiError.conflict('Only failed or expired forecast jobs may be retried', 'JOB_NOT_RETRYABLE');
      const request = refreshSchema.parse(payload.request);
      const region = await tx.organizationUnit.findUniqueOrThrow({ where: { id: regionId } });
      const bounds = boundsSchema.parse(region.forecastBounds), policy = forecastPolicySchema.parse(region.forecastPolicy);
      if (Date.parse(request.init_time) > Date.now() || Date.now() - Date.parse(request.init_time) >= policy.maximum_run_age_hours * 3600000) throw new ApiError(400, 'STALE_FORECAST_RUN', 'Request a newer initialization instead of retrying expired evidence');
      const changed = await tx.durableJob.updateMany({ where: { id: jobId, state: { in: ['DEAD', 'EXPIRED'] }, fence: job.fence }, data: {
        state: 'PENDING', attempts: 0, fence: { increment: 1 }, leaseOwner: null, leaseUntil: null,
        availableAt: new Date(), deadline: new Date(Date.now() + 180000), completedAt: null, lastError: null,
        payload: JSON.parse(JSON.stringify({ actor, organizationId, regionId, bounds, policyVersion: policy.version, request })),
      } });
      if (changed.count !== 1) throw ApiError.conflict('Job state changed; reload before retrying', 'STALE_VERSION');
      await tx.organizationAudit.createMany({ data: { id: randomUUID(), organizationId, actorUserId: actor.userId,
        action: 'FORECAST_REFRESH_RETRIED', reason: reviewedReason, metadata: { job_id: jobId, previous_attempts: job.attempts, previous_fence: job.fence } } });
      return { job_id: jobId, state: 'PENDING' as const };
    });
  },
  async job(actor: Actor, organizationId: string, regionId: string, jobId: string) {
    return withRegion(actor, organizationId, regionId, true, async tx => {
      const job = await tx.durableJob.findUnique({ where: { id: jobId } });
      const payload = job?.payload as { organizationId?: string; regionId?: string } | undefined;
      if (!job || job.queue !== 'forecast' || payload?.organizationId !== organizationId || payload.regionId !== regionId) throw ApiError.notFound('Job');
      return { id: job.id, state: job.state, attempts: job.attempts, last_error: job.lastError };
    });
  },
};

export async function saveForecastBatch(actor: Actor, organizationId: string, regionId: string,
  policyVersion: number, batch: ForecastBatch, job: ClaimedJob, signal: AbortSignal) {
  return withRegion(actor, organizationId, regionId, true, async tx => {
    const region = await tx.organizationUnit.findUniqueOrThrow({ where: { id: regionId } });
    const policy = forecastPolicySchema.parse(region.forecastPolicy);
    if (policy.version !== policyVersion || signal.aborted) throw new PermanentJobError();
    const lease = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM durable_jobs WHERE id = ${job.id}
      AND fence = ${job.fence} AND lease_owner = ${job.lease_owner} AND state = 'RUNNING'
      AND lease_until > (clock_timestamp() AT TIME ZONE 'UTC') AND deadline > (clock_timestamp() AT TIME ZONE 'UTC') FOR UPDATE`;
    if (lease.length !== 1) throw new PermanentJobError();
    const payloadHash = createHash('sha256').update(JSON.stringify(batch.cells)).digest('hex');
    const id = createHash('sha256').update(JSON.stringify([organizationId, regionId, batch.source, batch.initTime, payloadHash])).digest('hex');
    const existing = await tx.forecastRun.findUnique({ where: { id } });
    if (!existing) {
      await tx.forecastRun.create({ data: { id, organizationId, regionId, source: batch.source, model: batch.model,
        initTime: new Date(batch.initTime), retrievedAt: new Date(batch.retrievedAt),
        expiresAt: new Date(Date.parse(batch.initTime) + policy.maximum_run_age_hours * 3600000),
        payloadHash, cells: JSON.parse(JSON.stringify(batch.cells)),
        quality: { surface: batch.surface, resolution_degrees: batch.resolutionDegrees, cells: batch.cells.length,
          provider_job_id: batch.jobId, policy_version: policy.version, validation: 'UNVALIDATED_INDICATORS' } } });
      await tx.organizationAudit.createMany({ data: { id: randomUUID(), organizationId, actorUserId: actor.userId,
        action: 'FORECAST_REVISION_ACCEPTED', reason: 'Validated WeatherNext schema and bounded region',
        metadata: { region_id: regionId, run_id: id } } });
    }
    const completed = await tx.$executeRaw`UPDATE durable_jobs SET state = 'COMPLETED',
      completed_at = (clock_timestamp() AT TIME ZONE 'UTC'), lease_owner = NULL, lease_until = NULL
      WHERE id = ${job.id} AND fence = ${job.fence} AND lease_owner = ${job.lease_owner}
        AND lease_until > (clock_timestamp() AT TIME ZONE 'UTC') AND deadline > (clock_timestamp() AT TIME ZONE 'UTC')`;
    if (completed !== 1 || signal.aborted) throw new Error('FORECAST_LEASE_EXPIRED');
    return id;
  });
}
