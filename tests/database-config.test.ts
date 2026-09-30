import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databasePoolConfig } from '../src/core/database-config.js';
import { assessDatabaseReadiness, type DatabaseFacts } from '../src/core/database-readiness.js';

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://runtime:test-only@db.example/operations?sslmode=verify-full',
};

test('direct database pools are bounded and enforce verified TLS', () => {
  const result = databasePoolConfig(production);
  assert.equal(result.max, 10);
  assert.equal(result.connectionTimeoutMillis, 5000);
  assert.equal(result.statement_timeout, 10000);
  assert.deepEqual(result.ssl, { rejectUnauthorized: true });
  assert.equal(new URL(result.connectionString!).searchParams.has('sslmode'), false);
});

test('DIRECT_URL is never used as the runtime connection', () => {
  const result = databasePoolConfig({ ...production, DIRECT_URL: 'postgresql://owner:test@migration.example/operations' });
  assert.equal(new URL(result.connectionString!).hostname, 'db.example');
});

test('custom CA retains hostname and certificate verification', () => {
  assert.deepEqual(databasePoolConfig({ ...production, DATABASE_TLS_CA: 'test-ca' }).ssl,
    { rejectUnauthorized: true, ca: 'test-ca' });
});

for (const suffix of ['', '?sslmode=disable', '?sslmode=require', '?sslmode=prefer',
  '?sslmode=verify-full&ssl=false', '?sslmode=verify-full&uselibpqcompat=true',
  '?sslmode=verify-full&sslmode=disable', '?sslmode=verify-full&sslrootcert=local-file',
  '?sslmode=verify-full&SSLMODE=disable']) {
  test(`production refuses unsafe or ambiguous TLS: ${suffix || 'missing'}`, () => {
    assert.throws(() => databasePoolConfig({ ...production, DATABASE_URL: `postgresql://db.example/operations${suffix}` }));
  });
}

for (const DATABASE_URL of ['prisma+postgres://accelerate.example/?api_key=test', 'https://db.example/operations',
  'postgresql://db.example/', 'postgresql://db.example/operations#fragment']) {
  test(`rejects unsupported database URL ${DATABASE_URL.split(':')[0]}`, () => {
    assert.throws(() => databasePoolConfig({ DATABASE_URL }));
  });
}

test('local test databases can explicitly disable TLS', () => {
  assert.equal(databasePoolConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/fixtures?sslmode=disable' }).ssl, false);
});

for (const DATABASE_POOL_MAX of ['0', '51', '-1', '2.5', 'NaN', '']) {
  test(`rejects invalid pool size ${DATABASE_POOL_MAX}`, () => {
    assert.throws(() => databasePoolConfig({ ...production, DATABASE_POOL_MAX }));
  });
}

const facts: DatabaseFacts = {
  server_version_num: 180000,
  postgis_version: '3.6.0',
  unsafe_role: false,
  owns_application_tables: false,
  tls: true,
};

test('database diagnostic accepts PG18/PostGIS with a non-owner runtime role', () => {
  assert.equal(assessDatabaseReadiness(facts, true).ready, true);
});

test('database diagnostic lists every failed prerequisite', () => {
  assert.deepEqual(assessDatabaseReadiness({
    server_version_num: 170000, postgis_version: null, unsafe_role: true, owns_application_tables: true, tls: false,
  }, true).blockers, [
    'POSTGRESQL_18_REQUIRED', 'POSTGIS_REQUIRED', 'NON_PRIVILEGED_RUNTIME_ROLE_REQUIRED',
    'NON_OWNER_RUNTIME_ROLE_REQUIRED', 'DATABASE_TLS_REQUIRED',
  ]);
});

test('malformed version and missing privilege facts fail closed', () => {
  assert.equal(assessDatabaseReadiness({ ...facts, server_version_num: NaN }, false).ready, false);
  assert.equal(assessDatabaseReadiness({ ...facts, unsafe_role: undefined } as unknown as DatabaseFacts, false).ready, false);
});