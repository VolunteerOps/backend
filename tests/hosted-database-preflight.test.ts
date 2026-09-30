import test from 'node:test';
import assert from 'node:assert/strict';
import { hostedConnectionConfig, assessHostedDatabase, type HostedDatabaseFacts } from '../scripts/check-hosted-database.js';
import type { DatabaseFacts } from '../src/core/database-readiness.js';

const capabilities: HostedDatabaseFacts = {
  server_version_num: 180006,
  postgis_installed_version: '3.6.2',
  postgis_available_version: '3.6.2',
  migrator_is_superuser: true,
  migrator_can_create_roles: true,
  backend_tls: true,
};
const runtime: DatabaseFacts = { server_version_num: 180006, postgis_version: '3.6.2', unsafe_role: false, owns_application_tables: false, tls: true };

test('hosted database preflight accepts only explicit direct URLs with verified TLS', () => {
  assert.throws(() => hostedConnectionConfig({}, 'DIRECT_URL'), /DIRECT_URL_MISSING/);
  assert.throws(() => hostedConnectionConfig({ DIRECT_URL: 'prisma+postgres://accelerate.prisma-data.net/?api_key=secret' }, 'DIRECT_URL'), /DIRECT_POSTGRES_REQUIRED/);
  assert.throws(() => hostedConnectionConfig({ DIRECT_URL: 'postgresql://owner:secret@db.example.com/db?sslmode=disable' }, 'DIRECT_URL'), /VERIFIED_TLS_REQUIRED/);
  assert.throws(() => hostedConnectionConfig({ DIRECT_URL: 'postgresql://owner:secret@db.example.com/db?sslmode=require&sslmode=verify-full' }, 'DIRECT_URL'), /VERIFIED_TLS_REQUIRED/);
  const config = hostedConnectionConfig({ DIRECT_URL: 'postgresql://owner:secret@db.example.com/db?sslmode=require' }, 'DIRECT_URL');
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
  assert.ok(!config.connectionString?.includes('sslmode'));
});

test('preflight separates privileged migrator capability from non-owner runtime readiness', () => {
  assert.equal(assessHostedDatabase(capabilities, runtime).ready, true);
  assert.ok(assessHostedDatabase(capabilities).blockers.includes('RUNTIME_CONNECTION_NOT_VERIFIED'));
  assert.ok(assessHostedDatabase(capabilities, { ...runtime, unsafe_role: true, owns_application_tables: true }).blockers.includes('RUNTIME_NON_OWNER_RUNTIME_ROLE_REQUIRED'));
  assert.ok(assessHostedDatabase({ ...capabilities, migrator_can_create_roles: false }).blockers.includes('ROLE_PROVISIONING_NOT_CONFIRMED'));
  assert.equal(assessHostedDatabase({ ...capabilities, migrator_can_create_roles: false }, runtime).ready, true);
});

test('preflight exposes observed hosted-provider version, PostGIS and proxy-TLS incompatibilities', () => {
  const result = assessHostedDatabase({ ...capabilities, server_version_num: 170002, postgis_installed_version: null, postgis_available_version: null, backend_tls: false }, runtime);
  assert.deepEqual(result.blockers, ['POSTGRESQL_18_REQUIRED', 'POSTGIS_NOT_AVAILABLE', 'MIGRATOR_BACKEND_TLS_NOT_REPORTED']);
});
