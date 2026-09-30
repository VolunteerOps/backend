import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { Pool } from 'pg';
import { PostgresJobStore } from '../src/core/jobs.js';

// Explicit disposable loopback database only. No .env loading, no production fallback.
const connection = process.env.SENTINEL_TEST_DATABASE_URL;
test('PostgreSQL job claims, fencing, retry exhaustion, expiry and queue isolation', { skip: !connection }, async () => {
  const target = new URL(connection!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
  assert.match(target.pathname, /test/i, 'Use a disposable test database');
  const schema = `job_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: connection, max: 1 });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const pool = new Pool({ connectionString: connection, max: 4, options: `-c search_path=${schema} -c timezone=UTC` });
  const store = new PostgresJobStore(pool);
  try {
    await pool.query(`CREATE TABLE durable_jobs (
      id text PRIMARY KEY, organization_id text, priority int NOT NULL DEFAULT 1, last_claimed_at timestamp(3), queue text NOT NULL, kind text NOT NULL, payload jsonb NOT NULL,
      state text NOT NULL DEFAULT 'PENDING', attempts int NOT NULL DEFAULT 0,
      max_attempts int NOT NULL DEFAULT 2, fence int NOT NULL DEFAULT 0,
      lease_owner text, lease_until timestamp(3), available_at timestamp(3) NOT NULL DEFAULT now(),
      deadline timestamp(3), completed_at timestamp(3), last_error text)`);
    await pool.query(`INSERT INTO durable_jobs(id,queue,kind,payload) VALUES ('a','identity','TEST','{}'), ('b','bulk','TEST','{}')`);
    const claims = await Promise.all([store.claim('identity', 'one'), store.claim('identity', 'two')]);
    assert.equal(claims.filter(Boolean).length, 1);
    const old = claims.find(Boolean)!;
    await pool.query(`UPDATE durable_jobs SET lease_until = now() - interval '1 second' WHERE id = 'a'`);
    const fresh = (await store.claim('identity', 'three'))!;
    assert.equal(fresh.fence, old.fence + 1);
    assert.equal(await store.complete(old), false);
    assert.equal(await store.fail(old, 'OLD_WORKER'), false);
    assert.equal(await store.fail(fresh, 'RETRY_EXHAUSTED'), true);
    assert.equal(await store.claim('identity', 'four'), null);
    assert.equal((await pool.query(`SELECT state FROM durable_jobs WHERE id = 'a'`)).rows[0].state, 'DEAD');
    const bulk = (await store.claim('bulk', 'bulk-worker'))!;
    assert.equal(await store.complete(bulk), true);
    assert.equal(await store.complete(bulk), false);
    await pool.query(`INSERT INTO durable_jobs(id,queue,kind,payload,deadline)
      VALUES ('expired','identity','TEST','{}',now() - interval '1 second')`);
    assert.equal(await store.claim('identity', 'five'), null);
    assert.equal((await pool.query(`SELECT state FROM durable_jobs WHERE id = 'expired'`)).rows[0].state, 'EXPIRED');
    await pool.query(`INSERT INTO durable_jobs(id,queue,kind,payload,organization_id,priority)
      VALUES ('a1','fair','TEST','{}','a',1), ('a2','fair','TEST','{}','a',1),
        ('b1','fair','TEST','{}','b',1), ('b2','fair','TEST','{}','b',0)`);
    const firstFair = (await store.claim('fair', 'fair-worker'))!;
    const secondFair = (await store.claim('fair', 'fair-worker'))!;
    assert.notEqual(firstFair.id[0], secondFair.id[0], 'A tenant burst must give way to another tenant');
    assert.ok([firstFair.id, secondFair.id].includes('b2'), 'Urgent work precedes normal work within a tenant');
    await pool.query(`INSERT INTO durable_jobs(id,queue,kind,payload,deadline)
      VALUES ('utc','utc','TEST','{}', (clock_timestamp() AT TIME ZONE 'UTC') + interval '30 seconds')`);
    const utcJob = (await store.claim('utc', 'utc-worker'))!;
    assert.ok(utcJob.deadline!.getTime() - Date.now() > 20000, 'UTC deadline must not depend on the host timezone');
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});
