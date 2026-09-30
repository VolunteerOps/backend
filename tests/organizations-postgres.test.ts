import assert from 'node:assert/strict';
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
    await assert.rejects(PlatformService.list({ ...tech, identity: { ...tech.identity, secondFactor: null } }), { code: 'MFA_REQUIRED' });
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
    const suspended = await PlatformService.transition(tech, a.id, 'SUSPENDED', { expected_version: a.version, reason: 'Suspending test partner access' });
    await assert.rejects(OrganizationsService.roster(adminA, a.id), { code: 'ORG_NOT_ACTIVE' });
    await assert.rejects(PlatformService.transition(tech, a.id, 'ACTIVE', { expected_version: a.version, reason: 'Reject stale activation version' }), { code: 'STALE_VERSION' });
    assert.equal(suspended.status, 'SUSPENDED');
    assert.equal((await OrganizationsService.roster(adminB, b.id)).length, 2);
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
    for (const table of ['forecast_runs', 'locations', 'organization_units', 'ingress_receipts', 'member_devices', 'organization_audit', 'organization_invitations', 'organization_memberships']) {
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
