import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import type { Actor } from '../src/modules/organizations/context.js';

const ownerUrl = process.env.SENTINEL_TEST_DATABASE_URL;
test('real PostgreSQL organization lifecycle, RLS, enrollment races and isolation', { skip: !ownerUrl }, async () => {
  const target = new URL(ownerUrl!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
  assert.match(target.pathname, /test/i);
  const suffix = randomUUID().replaceAll('-', '');
  const runtimePassword = randomUUID();
  const runtimeRole = `sentinel_test_${suffix}`;
  const owner = new Pool({ connectionString: ownerUrl, max: 1 });
  await owner.query(`CREATE ROLE "${runtimeRole}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${runtimePassword}'`);
  await owner.query(`GRANT USAGE ON SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${runtimeRole}"`);
  await owner.query('REVOKE UPDATE ON public.stored_objects FROM "'+runtimeRole+'"');
  await owner.query('GRANT UPDATE (state,completed_at,etag,version_id) ON public.stored_objects TO "'+runtimeRole+'"');
  await owner.query(readFileSync('deploy/database/responder-lock.sql','utf8').replaceAll('sentinel_runtime_access','\"'+runtimeRole+'\"'));
  target.username = runtimeRole; target.password = runtimePassword;
  process.env.DATABASE_URL = target.toString(); process.env.NODE_ENV = 'test';
  const { prisma } = await import('../src/core/prisma.js');
  const { withActor } = await import('../src/modules/organizations/context.js');
  const { PlatformService } = await import('../src/modules/platform/platform.service.js');
  const { OrganizationsService } = await import('../src/modules/organizations/organizations.service.js');
  const { bootstrapPlatformOwner, bindLegacyIdentity } = await import('../src/modules/platform/bootstrap.js');
  const { AuthService } = await import('../src/modules/auth/auth.service.js');
  const { SentinelService, saveForecastBatch } = await import('../src/modules/sentinel/sentinel.service.js');
  const { withRegion } = await import('../src/modules/sentinel/sentinel.context.js');
  const { ScopedStorageService } = await import('../src/modules/scoped-storage/scoped-storage.service.js');
  const { DevicesService } = await import('../src/modules/organizations/devices.service.js');
  const { deviceHeartbeatHandler } = await import('../src/workers/device-handler.js');
  const { pruneExpiredBatch } = await import('../src/core/retention.js');
  const { PostgresJobStore, executeJob } = await import('../src/core/jobs.js');
  const workerPool = new Pool({ connectionString: target.toString() });
  const store = new PostgresJobStore(workerPool);
  const retentionRole = 'retention_'+suffix;
  await owner.query('CREATE ROLE "'+retentionRole+'" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '+"'"+runtimePassword+"'");
  await owner.query('GRANT USAGE ON SCHEMA public TO "'+retentionRole+'"');
  await owner.query('GRANT SELECT, UPDATE, DELETE ON public.forecast_runs,public.ingress_receipts TO "'+retentionRole+'"');
  await owner.query('GRANT SELECT ON public.durable_jobs TO "'+retentionRole+'"');
  await owner.query('GRANT UPDATE (payload) ON public.durable_jobs TO "'+retentionRole+'"');
  await owner.query('GRANT SELECT ON public.member_devices,public.organization_memberships TO '+retentionRole);
  const retentionUrl = new URL(target);retentionUrl.username=retentionRole;
  const retentionPool = new Pool({connectionString:retentionUrl.toString(),max:1});
  const actorIds: number[] = [];
  const orgIds: string[] = [];
  async function actor(name: string): Promise<Actor> {
    const email = `${name}-${suffix}@example.org`;
    const user = await owner.query(`INSERT INTO users(email,full_name,updated_at) VALUES ($1,$2,now()) RETURNING id`, [email, name]);
    const userId = user.rows[0].id as number; actorIds.push(userId);
    await owner.query(`INSERT INTO firebase_identities(project_id,uid,user_id) VALUES ('demo-sentinel',$1,$2)`, [email, userId]);
    return { userId, identity: { projectId: 'demo-sentinel', uid: email, email,
      authTime: Math.floor(Date.now() / 1000), expiresAt: Math.floor(Date.now() / 1000) + 3600,
      signInProvider: 'password', secondFactor: 'totp' } };
  }
  try {
    const tech = await actor('tech'); const adminA = await actor('admin-a'); const adminB = await actor('admin-b');
    const volunteer = await actor('volunteer'); const stranger = await actor('stranger');
    const operator = await owner.connect();
    try {
      await assert.rejects(bootstrapPlatformOwner(operator, tech.identity, stranger.userId, 'Review mismatch must not grant owner access'), { code: 'IDENTITY_BINDING_REQUIRED' });
      await bootstrapPlatformOwner(operator, tech.identity, tech.userId, 'Reviewed test platform owner grant');
      await assert.rejects(bootstrapPlatformOwner(operator, stranger.identity, stranger.userId, 'Second bootstrap must not grant owner access'), { code: 'BOOTSTRAP_ALREADY_USED' });
      await bindLegacyIdentity(operator, adminA.identity, adminA.userId, 'Reviewed already-bound identity is idempotent');
      await assert.rejects(bindLegacyIdentity(operator, adminA.identity, adminB.userId, 'Reject conflicting immutable identity mapping'), { code: 'IDENTITY_CONFLICT' });
    } finally { operator.release(); }
    await owner.query(`UPDATE users SET role = 'SUPER_ADMIN' WHERE id = $1`, [stranger.userId]);
    await assert.rejects(PlatformService.list(stranger), { code: 'PLATFORM_GRANT_REQUIRED' });
    const passwordOnly = { ...tech, identity: { ...tech.identity, secondFactor: null } };
    const previousMfaPolicy = process.env.AUTH_REQUIRE_MFA;
    try {
      delete process.env.AUTH_REQUIRE_MFA;
      await assert.doesNotReject(PlatformService.list(passwordOnly));
      process.env.AUTH_REQUIRE_MFA = 'true';
      await assert.rejects(PlatformService.list(passwordOnly), { code: 'MFA_REQUIRED' });
      await assert.doesNotReject(PlatformService.list(tech));
    } finally {
      if (previousMfaPolicy === undefined) delete process.env.AUTH_REQUIRE_MFA;
      else process.env.AUTH_REQUIRE_MFA = previousMfaPolicy;
    }
    async function workspace(slug: string, admin: Actor) {
      let org = await PlatformService.provision(tech, { slug: `${slug}-${suffix}`, display_name: slug,
        allowed_providers: ['password'], require_mfa: false, reason: 'Approved test partnership' });
      orgIds.push(org.id);
      await assert.rejects(PlatformService.recordVerification(tech, org.id, { expected_version: 1, reason: 'Reviewed institution proof', evidence_reference: 'test-evidence-reference' }), { code: 'ORG_NOT_ACTIVE' });
      org = await PlatformService.transition(tech, org.id, 'ACTIVE', { expected_version: 1, reason: 'Approved partner activation' });
      org = await PlatformService.recordVerification(tech, org.id, { expected_version: org.version,
        reason: 'Reviewed institution proof', evidence_reference: 'test-evidence-reference' });
      const invitation = await PlatformService.nominate(tech, org.id, { recipient_email: admin.identity.email,
        role: 'ORG_ADMIN', region_ids: [], expires_in_hours: 1, reason: 'Nominated organization admin' });
      await OrganizationsService.accept(admin, invitation.token);
      return org;
    }
    const a = await workspace('agency-a', adminA); const b = await workspace('agency-b', adminB);
    assert.equal((await OrganizationsService.memberships(stranger)).memberships.length, 0);
    assert.equal((await OrganizationsService.memberships(adminA)).memberships.length, 1);
    await assert.rejects(OrganizationsService.roster(adminA, b.id), { code: 'MEMBERSHIP_REQUIRED' });
    assert.equal((await OrganizationsService.roster(adminA, a.id)).length, 1);
    const invite = await OrganizationsService.invite(adminA, a.id, { recipient_email: volunteer.identity.email,
      role: 'VOLUNTEER', region_ids: [], expires_in_hours: 1, reason: 'Reviewed volunteer invitation' });
    await assert.rejects(OrganizationsService.accept(stranger, invite.token), { code: 'INVITATION_UNAVAILABLE' });
    const accepted = await Promise.all([OrganizationsService.accept(volunteer, invite.token), OrganizationsService.accept(volunteer, invite.token)]);
    assert.equal(accepted[0].membership_id, accepted[1].membership_id);
    const otherInvite = await OrganizationsService.invite(adminB, b.id, { recipient_email: volunteer.identity.email,
      role: 'VOLUNTEER', region_ids: [], expires_in_hours: 1, reason: 'Reviewed second organization membership' });
    await OrganizationsService.accept(volunteer, otherInvite.token);
    assert.equal((await OrganizationsService.memberships(volunteer)).memberships.length, 2);
    const {EnterpriseService:Availability}=await import('../src/modules/enterprise/enterprise.service.js');
    const reservations=await Promise.allSettled([Availability.reserve(adminA,a.id,volunteer.userId,'mission-a',5,false),Availability.reserve(adminB,b.id,volunteer.userId,'mission-b',5,false)]);
    assert.equal(reservations.filter(r=>r.status==='fulfilled').length,1);
    const rejected=reservations.find(r=>r.status==='rejected') as PromiseRejectedResult;
    assert.equal(rejected.reason.code,'RESPONDER_UNAVAILABLE');
    assert.ok(!rejected.reason.message.includes('mission-'));
    if(reservations[0].status==='fulfilled')await Availability.reserve(adminA,a.id,volunteer.userId,'mission-a',5,true);
    else await Availability.reserve(adminB,b.id,volunteer.userId,'mission-b',5,true);
    const installation = randomUUID();
    const registered = await Promise.all(Array.from({ length: 2 }, () => DevicesService.register(volunteer, a.id,
      { installation_id: installation, platform: 'ANDROID' })));
    assert.equal(registered[0].id, registered[1].id);
    const deviceA = registered[0];
    const deviceB = await DevicesService.register(volunteer, b.id, { installation_id: installation, platform: 'ANDROID' });
    assert.notEqual(deviceA.id, deviceB.id);
    assert.deepEqual((await DevicesService.list(volunteer, a.id)).map(d => d.id), [deviceA.id]);
    assert.equal((await DevicesService.list(adminA, a.id)).length, 0);
    await assert.rejects(DevicesService.revoke(volunteer, b.id, deviceA.id), { statusCode: 404 });
    const heartbeat = { message_id: randomUUID(), consent_version: 1,
      recorded_at: new Date().toISOString(), battery_percent: 70 };
    await assert.rejects(DevicesService.heartbeat(volunteer, a.id, deviceA.id, heartbeat), { code: 'CONSENT_REQUIRED' });
    const consent = await DevicesService.consent(volunteer, a.id, deviceA.id,
      { expected_version: 1, sensing: true, location: true, relay: false });
    await assert.rejects(DevicesService.consent(volunteer, a.id, deviceA.id,
      { expected_version: 1, sensing: true, location: true, relay: false }), { code: 'STALE_VERSION' });
    heartbeat.consent_version = consent.consentVersion;
    const receipts = await Promise.all(Array.from({ length: 2 }, () => DevicesService.heartbeat(volunteer, a.id, deviceA.id, heartbeat)));
    assert.equal(receipts[0].receipt_id, receipts[1].receipt_id);
    assert.equal(receipts.filter(r => r.duplicate).length, 1);
    await assert.rejects(DevicesService.heartbeat(volunteer, a.id, deviceA.id, { ...heartbeat, battery_percent: 69 }), { code: 'REPLAY_CONFLICT' });
    const firstJob = (await store.claim('device', 'device-test'))!;
    assert.ok(firstJob);
    await executeJob(store, firstJob, new Map([['DEVICE_HEARTBEAT', deviceHeartbeatHandler]]));
    assert.equal((await DevicesService.list(volunteer, a.id))[0].batteryPercent, 70);
    await DevicesService.heartbeat(volunteer, a.id, deviceA.id, { ...heartbeat, message_id: randomUUID(), battery_percent: 65 });
    const revokedConsentJob = (await store.claim('device', 'device-test'))!;
    await DevicesService.consent(volunteer, a.id, deviceA.id,
      { expected_version: consent.consentVersion, sensing: false, location: false, relay: false });
    await executeJob(store, revokedConsentJob, new Map([['DEVICE_HEARTBEAT', deviceHeartbeatHandler]]));
    assert.equal((await DevicesService.list(volunteer, a.id))[0].batteryPercent, 70);
    assert.equal((await owner.query('SELECT state FROM durable_jobs WHERE id = $1', [revokedConsentJob.id])).rows[0].state, 'DEAD');
    await DevicesService.revoke(volunteer, a.id, deviceA.id);
    await DevicesService.revoke(volunteer, a.id, deviceA.id);
    await assert.rejects(DevicesService.register(volunteer, a.id,
      { installation_id: installation, platform: 'ANDROID' }), { code: 'DEVICE_REVOKED' });
    assert.equal((await prisma.memberDevice.findMany()).length, 0);
    assert.equal((await prisma.ingressReceipt.findMany()).length, 0);
    assert.equal((await OrganizationsService.roster(adminA, a.id)).length, 2);
    await assert.rejects(OrganizationsService.roster(volunteer, a.id), { code: 'CAPABILITY_REQUIRED' });

    const regionA = randomUUID(), regionB = randomUUID();
    const regionInput = { name: 'Test response region', bounds: { west: 36, east: 37, south: -2, north: -1 },
      policy: { version: 1, heat_c: 35, wind_mps: 18, hourly_rain_mm: 30, maximum_run_age_hours: 8 },
      reason: 'Reviewed test forecast coverage' };
    await SentinelService.configureRegion(adminA, a.id, regionA, regionInput);
    await SentinelService.configureRegion(adminB, b.id, regionB, regionInput);
    await assert.rejects(SentinelService.configureRegion(volunteer, a.id, randomUUID(), regionInput), { code: 'CAPABILITY_REQUIRED' });
    await assert.rejects(SentinelService.configureRegion(adminA, a.id, regionA, regionInput), { code: 'STALE_VERSION' });
    assert.equal((await SentinelService.latest(volunteer, a.id, regionA)).status, 'UNAVAILABLE');
    let storageInspections = 0, invalidStorageFacts = false;
    const storage = new ScopedStorageService(() => ({ bucket: 'private-test',
      upload: async () => ({ url: 'https://objects.example.org/signed-put', headers: { 'If-None-Match': '*' } }),
      inspect: async value => { storageInspections++; return { ...value, byteSize: invalidStorageFacts ? 1 : value.byteSize, etag: '"verified-etag"', versionId: 'v1' }; },
      download: async () => ({ url: 'https://objects.example.org/signed-get', headers: { 'If-Match': '"verified-etag"' } }),
    }));
    const uploadInput = { file_name: 'incident.txt', content_type: 'text/plain' as const, byte_size: 17,
      checksum_sha256: Buffer.alloc(32, 1).toString('base64') };
    const upload = await storage.create(volunteer, a.id, regionA, uploadInput);
    assert.equal((await prisma.storedObject.findMany()).length, 0, 'RLS denies rows without actor scope');
    await assert.rejects(storage.download(volunteer, a.id, regionA, upload.object_id), { code: 'OBJECT_NOT_READY' });
    await assert.rejects(storage.complete(adminA, a.id, regionA, upload.object_id), { statusCode: 404 });
    await assert.rejects(storage.complete(volunteer, b.id, regionB, upload.object_id), { statusCode: 404 });
    await assert.rejects(storage.create(volunteer, a.id, regionB, uploadInput), { statusCode: 404 });
    invalidStorageFacts = true;
    await assert.rejects(storage.complete(volunteer, a.id, regionA, upload.object_id), { code: 'OBJECT_MISMATCH' });
    invalidStorageFacts = false;
    assert.equal((await storage.complete(volunteer, a.id, regionA, upload.object_id)).state, 'QUARANTINED');
    const inspectionCount = storageInspections;
    assert.equal((await storage.complete(volunteer, a.id, regionA, upload.object_id)).state, 'QUARANTINED');
    assert.equal(storageInspections, inspectionCount, 'completion retry must be idempotent');
    await assert.rejects(storage.download(volunteer, a.id, regionA, upload.object_id), { code: 'OBJECT_NOT_READY' });
    await assert.rejects(withRegion(volunteer, a.id, regionA, false, tx => tx.storedObject.update({ where: { id: upload.object_id }, data: { state: 'CLEAN' } })));
    assert.equal((await owner.query("SELECT count(*)::int AS n FROM durable_jobs WHERE business_key = $1", ['storage-scan:' + upload.object_id])).rows[0].n, 1);
    await owner.query("UPDATE stored_objects SET state = 'CLEAN', scanned_at = now(), scan_code = 'CLEAN' WHERE id = $1", [upload.object_id]);
    assert.equal((await storage.download(volunteer, a.id, regionA, upload.object_id)).expires_in_seconds, 60);
    await assert.rejects(storage.download(adminA, a.id, regionA, upload.object_id), { statusCode: 404 });
    await assert.rejects(owner.query('UPDATE stored_objects SET region_id = $1 WHERE id = $2', [regionB, upload.object_id]), { code: '23503' });
    await owner.query('UPDATE organization_memberships SET region_ids = ARRAY[$1] WHERE organization_id = $2 AND user_id = $3', [regionB, a.id, volunteer.userId]);
    await assert.rejects(storage.download(volunteer, a.id, regionA, upload.object_id), { code: 'SCOPE_REQUIRED' });
    await owner.query("UPDATE organization_memberships SET region_ids = ARRAY[]::text[] WHERE organization_id = $1 AND user_id = $2", [a.id, volunteer.userId]);
    const staleUpload = await storage.create(volunteer, a.id, regionA, uploadInput);
    const revokeDuringVerification = new ScopedStorageService(() => ({ bucket: 'private-test',
      upload: async () => { throw new Error('unexpected upload'); },
      download: async () => { throw new Error('unexpected download'); },
      inspect: async value => {
        await owner.query("UPDATE organization_memberships SET status = 'SUSPENDED' WHERE organization_id = $1 AND user_id = $2", [a.id, volunteer.userId]);
        return { ...value, etag: '"verified-etag"', versionId: 'v1' };
      },
    }));
    await assert.rejects(revokeDuringVerification.complete(volunteer, a.id, regionA, staleUpload.object_id), { code: 'MEMBERSHIP_REQUIRED' });
    await owner.query("UPDATE organization_memberships SET status = 'ACTIVE' WHERE organization_id = $1 AND user_id = $2", [a.id, volunteer.userId]);

    await owner.query("UPDATE stored_objects SET expires_at = now() AT TIME ZONE 'UTC' - interval '1 minute' WHERE id = $1", [staleUpload.object_id]);
    await assert.rejects(storage.complete(volunteer, a.id, regionA, staleUpload.object_id), { code: 'UPLOAD_EXPIRED' });
    await owner.query("UPDATE organization_memberships SET status = 'SUSPENDED' WHERE organization_id = $1 AND user_id = $2", [a.id, volunteer.userId]);
    await assert.rejects(storage.download(volunteer, a.id, regionA, upload.object_id), { code: 'MEMBERSHIP_REQUIRED' });
    await owner.query("UPDATE organization_memberships SET status = 'ACTIVE' WHERE organization_id = $1 AND user_id = $2", [a.id, volunteer.userId]);
    for (let index = 0; index < 10; index++) await storage.create(volunteer, a.id, regionA, uploadInput);
    await assert.rejects(storage.create(volunteer, a.id, regionA, uploadInput), { code: 'STORAGE_QUOTA_EXCEEDED' });

    const initialization = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
    const distribution = { mean: 38, p10: 36, p25: 37, p50: 38, p75: 39, p90: 40 };
    const batch = { source: 'WEATHERNEXT_3' as const, model: 'weathernext_3_0_0' as const,
      surface: 'BIGQUERY' as const, resolutionDegrees: 0.1 as const, initTime: initialization,
      retrievedAt: new Date().toISOString(), jobId: 'fixture-provider-job', cells: [{
        longitude: 36.5, latitude: -1.5, initTime: initialization, leadHours: 2,
        validTime: new Date(Date.parse(initialization) + 7200000).toISOString(),
        values: { temperature_2m: distribution, wind_speed_10m: distribution, total_precipitation_1hr: distribution },
      }] };
    async function forecastJob() {
      const id = randomUUID();
      await owner.query(`INSERT INTO durable_jobs(id,queue,kind,business_key,payload,deadline)
        VALUES ($1,'forecast','TEST',$1,$2::jsonb,now() + interval '2 minutes')`, [id, JSON.stringify({ organizationId: a.id })]);
      return (await store.claim('forecast', 'forecast-test'))!;
    }
    const forecastClaim = await forecastJob();
    const runId = await saveForecastBatch(adminA, a.id, regionA, 1, batch, forecastClaim, new AbortController().signal);
    const duplicateClaim = await forecastJob();
    assert.equal(await saveForecastBatch(adminA, a.id, regionA, 1, batch, duplicateClaim, new AbortController().signal), runId);
    assert.equal((await SentinelService.latest(volunteer, a.id, regionA)).run?.id, runId);
    assert.equal((await SentinelService.insights(volunteer, a.id, regionA)).movement_order, null);
    await owner.query("UPDATE forecast_runs SET expires_at = (clock_timestamp() AT TIME ZONE 'UTC') - interval '1 second' WHERE id = $1", [runId]);
    const expiredForecast = await SentinelService.latest(volunteer, a.id, regionA);
    assert.equal(expiredForecast.status, 'STALE');
    assert.deepEqual(expiredForecast.cells, []);assert.deepEqual(expiredForecast.assessment?.indicators, []);
    // Maintenance can remove expired material, but cannot erase current data or active jobs.
    const liveForecast = randomUUID();
    await owner.query("INSERT INTO forecast_runs(id,organization_id,region_id,source,model,init_time,retrieved_at,expires_at,payload_hash,cells,quality) SELECT $1,organization_id,region_id,source,model,init_time,retrieved_at,(clock_timestamp() AT TIME ZONE 'UTC')+interval '1 hour',$2,cells,quality FROM forecast_runs WHERE id=$3", [liveForecast,randomUUID(),runId]);
    await owner.query("UPDATE ingress_receipts SET expires_at=(clock_timestamp() AT TIME ZONE 'UTC')-interval '1 second' WHERE id=$1", [receipts[0].receipt_id]);
    const retainedJob = randomUUID(), scrubbedJob = randomUUID();
    for (const [id,state] of [[retainedJob,'PENDING'],[scrubbedJob,'COMPLETED']]) {
      await owner.query("INSERT INTO durable_jobs(id,organization_id,queue,kind,business_key,payload,state,available_at) VALUES ($1,$2,'retention-test','TEST',$1,$3::jsonb,$4,(clock_timestamp() AT TIME ZONE 'UTC')-interval '8 days')", [id,a.id,JSON.stringify({email:'must-be-scrubbed@example.org'}),state]);
    }
    assert.equal((await withRegion(adminA,a.id,regionA,true,tx=>tx.forecastRun.deleteMany({where:{id:runId}}))).count,0);
    const maintenance = await retentionPool.connect();
    try {
      await maintenance.query('BEGIN');
      await maintenance.query("SELECT set_config('vops.retention','true',true)");
      await assert.rejects(maintenance.query("UPDATE forecast_runs SET cells='[]'::jsonb WHERE id=$1",[runId]),{code:'42501'});
      await maintenance.query('ROLLBACK');
    } finally { maintenance.release(); }
    const purged = await pruneExpiredBatch(retentionPool,1);
    assert.deepEqual(purged,{forecasts:1,receipts:1,job_payloads:1});
    assert.equal((await owner.query('SELECT id FROM forecast_runs WHERE id=$1',[runId])).rowCount,0);
    assert.equal((await owner.query('SELECT id FROM forecast_runs WHERE id=$1',[liveForecast])).rowCount,1);
    assert.deepEqual((await owner.query('SELECT payload FROM durable_jobs WHERE id=$1',[scrubbedJob])).rows[0].payload,{});
    assert.equal((await owner.query('SELECT payload FROM durable_jobs WHERE id=$1',[retainedJob])).rows[0].payload.email,'must-be-scrubbed@example.org');
    assert.deepEqual(await pruneExpiredBatch(retentionPool,1),{forecasts:0,receipts:0,job_payloads:0});
    assert.equal((await prisma.forecastRun.findMany()).length,0,'maintenance context must not survive a transaction');
    assert.equal((await SentinelService.latest(adminB, b.id, regionB)).status, 'UNAVAILABLE');
    await assert.rejects(SentinelService.latest(adminB, a.id, regionA), { code: 'MEMBERSHIP_REQUIRED' });
    await assert.rejects(SentinelService.latest(adminA, a.id, regionB), { statusCode: 404 });
    assert.equal((await prisma.forecastRun.findMany()).length, 0);
    await assert.rejects(owner.query(`INSERT INTO forecast_runs(id,organization_id,region_id,source,model,init_time,
      retrieved_at,expires_at,payload_hash,cells,quality) VALUES ($1,$2,$3,'TEST','TEST',now(),now(),now(),'test','[]','{}')`,
      [randomUUID(), a.id, regionB]), { code: '23503' });
    await owner.query(`INSERT INTO locations(organization_id,region_id,name,address,latitude,longitude)
      VALUES ($1,$2,'A location','Test address',0,0),($3,$4,'B location','Test address',0,0)`, [a.id, regionA, b.id, regionB]);
    assert.equal((await prisma.location.findMany()).length, 0);
    const locations = await withRegion(adminA, a.id, regionA, true, tx => tx.location.findMany());
    assert.deepEqual(locations.map(l => l.name), ['A location']);

    process.env.WEATHERNEXT_ACCESS_ENABLED = 'true';
    process.env.WEATHERNEXT_PROJECT_ID = 'sentinel-test'; process.env.WEATHERNEXT_DATASET_ID = 'fixture';
    process.env.WEATHERNEXT_MAX_BYTES_BILLED = '100000000';
    const queued = await SentinelService.refresh(adminA, a.id, regionA, { init_time: initialization, from_hour: 3, to_hour: 4 });
    const failedClaim = (await store.claim('forecast', 'failed-provider'))!;
    assert.equal(failedClaim.id, queued.job_id);
    await store.fail(failedClaim, 'SOURCE_ACCESS_DENIED', true);
    await assert.rejects(SentinelService.retry(volunteer, a.id, regionA, queued.job_id, 'Verified source access repair'), { code: 'CAPABILITY_REQUIRED' });
    await assert.rejects(SentinelService.retry(adminB, b.id, regionB, queued.job_id, 'Verified source access repair'), { statusCode: 404 });
    assert.equal((await SentinelService.retry(adminA, a.id, regionA, queued.job_id, 'Verified source access repair')).state, 'PENDING');
    await assert.rejects(SentinelService.retry(adminA, a.id, regionA, queued.job_id, 'Duplicate retry cannot reset active work'), { code: 'JOB_NOT_RETRYABLE' });
    const recoveredClaim = (await store.claim('forecast', 'recovered-provider'))!;
    assert.ok(recoveredClaim.fence > failedClaim.fence);
    assert.equal(await store.complete(failedClaim), false);
    assert.equal(await store.complete(recoveredClaim), true);
    delete process.env.WEATHERNEXT_ACCESS_ENABLED;

    // RLS applies even when application query filters are deliberately omitted.
    assert.equal((await prisma.organizationMembership.findMany()).length, 0);
    const isolated = await withActor(adminA, tx => tx.organizationMembership.findMany());
    assert.deepEqual(isolated.map(row => row.userId), [adminA.userId]);
    const alternating = await Promise.all(Array.from({ length: 12 }, (_, i) => {
      const selected = i % 2 === 0 ? adminA : adminB;
      return withActor(selected, async tx => {
        const rows = await tx.organizationMembership.findMany();
        assert.deepEqual(rows.map(row => row.userId), [selected.userId]);
      });
    }));
    assert.equal(alternating.length, 12);
    await assert.rejects(withActor(adminA, tx => tx.platformGrant.create({ data: { userId: adminA.userId } })));
    const audits = await OrganizationsService.audit(adminA, a.id);
    assert.ok(audits.length >= 4);
    await assert.rejects(withActor(adminA, tx => tx.organizationAudit.delete({ where: { id: audits[0].id } })));
    const adminMembership = (await OrganizationsService.roster(adminA, a.id)).find(row => row.userId === adminA.userId)!;
    await assert.rejects(OrganizationsService.updateMembership(adminA, a.id, adminMembership.id,
      { status: 'REMOVED', expected_version: 1, reason: 'Testing last admin protection' }), { code: 'LAST_ADMIN_REQUIRED' });
    await OrganizationsService.updateMembership(adminA, a.id, accepted[0].membership_id,
      { status: 'REMOVED', expected_version: 1, reason: 'Reviewed membership removal' });
    await assert.rejects(OrganizationsService.accept(volunteer, invite.token), { code: 'MEMBERSHIP_REQUIRED' });
    const revoked = await OrganizationsService.invite(adminA, a.id, { recipient_email: stranger.identity.email,
      role: 'VOLUNTEER', region_ids: [], expires_in_hours: 1, reason: 'Pending invitation to revoke' });
    await OrganizationsService.revokeInvitation(adminA, a.id, revoked.id, 'Invitation withdrawn after review');
    await OrganizationsService.revokeInvitation(adminA, a.id, revoked.id, 'Repeated withdrawal is idempotent');
    await assert.rejects(OrganizationsService.accept(stranger, revoked.token), { code: 'INVITATION_UNAVAILABLE' });
    const expired = await OrganizationsService.invite(adminA, a.id, { recipient_email: stranger.identity.email,
      role: 'VOLUNTEER', region_ids: [], expires_in_hours: 1, reason: 'Expiration validation test' });
    await owner.query(`UPDATE organization_invitations SET expires_at = now() - interval '1 second' WHERE id = $1`, [expired.id]);
    await assert.rejects(OrganizationsService.accept(stranger, expired.token), { code: 'INVITATION_EXPIRED' });
    const coordinator = await actor('coordinator');
    const coordinatorInvite = await OrganizationsService.invite(adminA, a.id, { recipient_email: coordinator.identity.email,
      role: 'COORDINATOR', region_ids: [], expires_in_hours: 1, reason: 'Reviewed coordinator admission' });
    const coordinatorMember = await OrganizationsService.accept(coordinator, coordinatorInvite.token);
    const pending = await OrganizationsService.invite(coordinator, a.id, { recipient_email: stranger.identity.email,
      role: 'VOLUNTEER', region_ids: [], expires_in_hours: 1, reason: 'Invitation before issuer removal' });
    await OrganizationsService.updateMembership(adminA, a.id, coordinatorMember.membership_id,
      { status: 'REMOVED', expected_version: 1, reason: 'Withdraw coordinator access' });
    await assert.rejects(OrganizationsService.accept(stranger, pending.token), { code: 'INVITATION_UNAVAILABLE' });
    // Stage 2 independent profile, directory, inbox and join-request journeys.
    const { PersonalService }=await import('../src/modules/personal/personal.service.js');
    const { RecruitmentService }=await import('../src/modules/personal/recruitment.service.js');
    const personal=await actor('personal');
    const profile=await PersonalService.saveProfile(personal,{expected_version:0,display_name:'Chosen Name',biography:'First aid volunteer',region:'Nairobi',skills:['FIRST_AID'],availability:'WEEKENDS',private_details:{phone:'+254000000000',address:'Private home'}});
    assert.equal((await OrganizationsService.memberships(personal)).memberships.length,0);
    assert.equal((await PersonalService.home(personal)).profile?.displayName,'Chosen Name');
    assert.deepEqual(await withActor(adminA,tx=>tx.volunteerProfile.findMany()),[]);
    assert.deepEqual((await PersonalService.directory(adminA,a.id,{})).items,[]);
    await assert.rejects(PersonalService.directory(personal,a.id,{}),{code:'MEMBERSHIP_REQUIRED'});
    await PersonalService.directorySettings(personal,{expected_version:1,discoverable:true,public_preview:true,show_availability:true});
    const publicRows=await PersonalService.directory(adminA,a.id,{skill:'FIRST_AID',region:'Nairobi'});
    assert.equal(publicRows.items.length,1);
    assert.equal(publicRows.items[0].id,profile.publicId);
    assert.ok(!JSON.stringify(publicRows).includes('Private home'));
    assert.ok(!JSON.stringify(publicRows).includes('+254'));
    const share=await PersonalService.share(personal,1);
    assert.equal((await PersonalService.preview(share.token)).display_name,'Chosen Name');
    await PersonalService.revokeShare(personal,share.id);
    await assert.rejects(PersonalService.preview(share.token),{statusCode:404});
    const share2=await PersonalService.share(personal,1);
    await PersonalService.consent(personal,{purpose:'PUBLIC_PROFILE',policy_version:'directory-v1',granted:false});
    await assert.rejects(PersonalService.preview(share2.token),{statusCode:404});
    await assert.rejects(PersonalService.consent(personal,{purpose:'SENSING',policy_version:'device-v1',granted:false}),{code:'DEVICE_CONSENT_REQUIRED'});
    const exportIds=Array.from({length:1002},()=>randomUUID());
    await owner.query("INSERT INTO consent_records(id,user_id,purpose,policy_version,granted) SELECT unnest($1::text[]),$2,'UPDATES','export-test',false",[exportIds,personal.userId]);
    const exportFirst=await PersonalService.export(personal);
    assert.equal(exportFirst.consents.length,1000);assert.ok(exportFirst.consents_next_cursor);
    const exportLast=await PersonalService.export(personal,exportFirst.consents_next_cursor!);
    assert.equal(exportLast.consents_next_cursor,null);
    const exported=[...exportFirst.consents,...exportLast.consents];
    assert.equal(new Set(exported.map(c=>c.id)).size,1005);
    assert.ok(exported.every(c=>c.userId===personal.userId));
    assert.equal((await PersonalService.export(stranger)).consents.length,0);

    const recruit=await RecruitmentService.recruit(adminA,a.id,profile.publicId,'Recruiting a discoverable responder');
    assert.equal((await OrganizationsService.inbox(personal))[0].id,recruit.id);
    await assert.rejects(OrganizationsService.accept(stranger,'',recruit.id),{code:'INVITATION_UNAVAILABLE'});
    await OrganizationsService.decline(personal,recruit.id);
    assert.equal((await PersonalService.home(personal)).invitations.length,0);
    assert.equal((await OrganizationsService.inbox(personal))[0].deliveryStatus,'CANCELLED');
    await assert.rejects(OrganizationsService.accept(personal,recruit.token),{code:'INVITATION_UNAVAILABLE'});
    await PersonalService.block(personal,a.id,'Repeated unsolicited contact reported');
    assert.equal((await PersonalService.directory(adminA,a.id,{})).items.length,0);
    await assert.rejects(RecruitmentService.recruit(adminA,a.id,profile.publicId,'Blocked recruitment must fail'),{statusCode:404});
    const published=await RecruitmentService.publish(adminB,b.id,true,b.version,'Opening public recruitment for test');b.version=published.version;
    assert.equal((await RecruitmentService.workspaces(personal)).items[0].id,b.id);
    const join=await RecruitmentService.request(personal,b.id,'I would like to volunteer with your team');
    assert.equal((await RecruitmentService.request(personal,b.id,'Retry the same request safely')).id,join.id);
    await assert.rejects(RecruitmentService.review(adminA,b.id,join.id,'INVITE',1,'Wrong organization review'),{code:'MEMBERSHIP_REQUIRED'});
    const reviewed=await RecruitmentService.review(adminB,b.id,join.id,'INVITE',1,'Approved volunteer recruitment request');
    assert.ok(reviewed.invitation);
    assert.equal((await OrganizationsService.memberships(personal)).memberships.length,0);
    const enrolled=await OrganizationsService.accept(personal,'',reviewed.invitation!.id);
    assert.equal((await OrganizationsService.accept(personal,'',reviewed.invitation!.id)).membership_id,enrolled.membership_id);
    await OrganizationsService.leave(personal,b.id);
    assert.equal((await PersonalService.home(personal)).profile?.publicId,profile.publicId);
    await assert.rejects(OrganizationsService.accept(personal,'',reviewed.invitation!.id),{code:'MEMBERSHIP_REQUIRED'});
    await PersonalService.deletion(personal,false);
    assert.equal((await PersonalService.home(personal)).deletion?.status,'REQUESTED');
    assert.equal((await PersonalService.directory(adminB,b.id,{})).items.length,0);
    await PersonalService.deletion(personal,true);
    const {EnterpriseService}=await import('../src/modules/enterprise/enterprise.service.js');
    const application=await EnterpriseService.apply(personal,{name:'Approved Partner',domain:'example.org',message:'Partnership application for review'});
    await assert.rejects(EnterpriseService.applications(personal,true),{code:'PLATFORM_GRANT_REQUIRED'});
    await EnterpriseService.review(tech,application.id,'APPROVED','Approved verified partnership',b.id);
    await assert.rejects(EnterpriseService.grant(tech,tech.userId,false,'Remove the last owner unsafely'),{code:'LAST_OWNER_REQUIRED'});
    const claim=await EnterpriseService.domain(adminB,b.id,'partner-'+suffix+'.example.org','Verify this exact institution domain');
    await assert.rejects(EnterpriseService.verifyDomain(adminB,b.id,claim.id,async()=>[['wrong-proof']]),{code:'DOMAIN_PROOF_MISMATCH'});
    const proof=await EnterpriseService.verifyDomain(adminB,b.id,claim.id,async()=>[[claim.value]]);
    assert.ok(proof.verified_until>new Date());
    await EnterpriseService.dispute(tech,claim.id,'Domain ownership disputed by institution');
    await assert.rejects(EnterpriseService.verifyDomain(adminB,b.id,claim.id,async()=>[[claim.value]]),{code:'DOMAIN_PROOF_UNAVAILABLE'});
    const support=await EnterpriseService.support(tech,b.id,{user_id:tech.userId,expires_in_minutes:5,reason:'Investigate institution configuration'});
    assert.equal((await EnterpriseService.supportRead(tech,support.id)).organization.id,b.id);
    await EnterpriseService.revokeSupport(tech,support.id,'Support investigation completed');
    await assert.rejects(EnterpriseService.supportRead(tech,support.id),{code:'SUPPORT_GRANT_REQUIRED'});
    const bilateral=await EnterpriseService.coordinate(adminA,a.id,{partner_organization_id:b.id,lead_organization_id:a.id,resource_reference:'incident-fixture',expires_in_hours:1,reason:'Request bilateral coordination'});
    await assert.rejects(EnterpriseService.coordinationAction(adminA,a.id,bilateral.id,true,'Cannot approve both sides'),{statusCode:403});
    await EnterpriseService.coordinationAction(adminB,b.id,bilateral.id,true,'Partner accepts coordination');
    await EnterpriseService.coordinationAction(adminA,a.id,bilateral.id,false,'Lead revokes coordination');
    await assert.rejects(EnterpriseService.coordinationAction(adminB,b.id,bilateral.id,true,'Cannot revive revoked coordination'),{statusCode:404});
    const suspended = await PlatformService.transition(tech, a.id, 'SUSPENDED', { expected_version: a.version, reason: 'Suspending test partner access' });
    await assert.rejects(OrganizationsService.roster(adminA, a.id), { code: 'ORG_NOT_ACTIVE' });
    await assert.rejects(PlatformService.transition(tech, a.id, 'ACTIVE', { expected_version: a.version, reason: 'Reject stale activation version' }), { code: 'STALE_VERSION' });
    assert.equal(suspended.status, 'SUSPENDED');
    const offboard=await PlatformService.transition(tech,a.id,'OFFBOARDING',{expected_version:suspended.version,reason:'Reviewed institution handover starts'});
    const archived=await PlatformService.completeOffboarding(tech,a.id,{expected_version:offboard.version,reason:'All institution handover checks completed',evidence_reference:'reviewed-handover-evidence'});
    assert.equal(archived.status,'ARCHIVED');
    assert.equal((await AuthService.getMe(adminA.userId)).isActive,true);
    assert.equal((await OrganizationsService.roster(adminB, b.id)).filter(m=>m.status==='ACTIVE').length, 2);
    assert.equal((await OrganizationsService.detail(volunteer, b.id)).id, b.id);
    const newIdentity = { ...stranger.identity, uid: `bootstrap-${suffix}`, email: `bootstrap-${suffix}@example.org` };
    const bootstraps = await Promise.all([AuthService.bootstrap(newIdentity, 'New Volunteer'), AuthService.bootstrap(newIdentity, 'New Volunteer')]);
    assert.equal(bootstraps[0].id, bootstraps[1].id);
    actorIds.push(bootstraps[0].id);
    assert.equal((await OrganizationsService.memberships({ userId: bootstraps[0].id, identity: newIdentity })).memberships.length, 0);
    await owner.query('UPDATE users SET is_active = false WHERE id = $1', [stranger.userId]);
    await assert.rejects(OrganizationsService.memberships(stranger), { code: 'SESSION_REVOKED' });
    // Rollback also clears transaction-local authorization variables.
    await assert.rejects(withActor(adminA, async tx => { await tx.$queryRaw`SELECT set_config('vops.organization_id', ${a.id}, true)`; throw new Error('rollback'); }));
    assert.equal((await prisma.organization.findMany()).length, 0);
  } finally {
    await retentionPool.end();
    await workerPool.end();
    await prisma.$disconnect();
    await owner.query(`DELETE FROM durable_jobs WHERE organization_id = ANY($1::text[]) OR payload->>'organizationId' = ANY($1::text[])`, [orgIds]);
    await owner.query('DELETE FROM partner_applications WHERE user_id=ANY($1::int[])',[actorIds]);
    for(const table of ['responder_reservations','domain_claims','support_access_grants','coordination_grants']) await owner.query('DELETE FROM '+table+' WHERE organization_id=ANY($1::text[])',[orgIds]);
    for(const table of ['personal_audit','recruitment_reports','join_requests','recruitment_blocks','account_deletion_requests','consent_records','profile_shares','directory_preferences','volunteer_profiles']) {
      await owner.query('DELETE FROM '+table+' WHERE user_id = ANY($1::int[])',[actorIds]);
    }
    for (const table of ['stored_objects', 'forecast_runs', 'locations', 'organization_units', 'ingress_receipts', 'member_devices', 'organization_audit', 'organization_invitations', 'organization_memberships']) {
      await owner.query(`DELETE FROM ${table} WHERE organization_id = ANY($1::text[])`, [orgIds]);
    }
    await owner.query(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [orgIds]);
    await owner.query(`DELETE FROM platform_grants WHERE user_id = ANY($1::int[])`, [actorIds]);
    await owner.query(`DELETE FROM firebase_identities WHERE user_id = ANY($1::int[])`, [actorIds]);
    await owner.query(`DELETE FROM audit_logs WHERE user_id = ANY($1::int[])`, [actorIds]);
    await owner.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [actorIds]);
    await owner.query(`DROP OWNED BY "${runtimeRole}"`);
    await owner.query(`DROP ROLE "${runtimeRole}"`);
    await owner.query('DROP OWNED BY "'+retentionRole+'"');
    await owner.query('DROP ROLE "'+retentionRole+'"');
    await owner.end();
  }
});
