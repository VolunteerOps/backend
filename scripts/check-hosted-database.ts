import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'dotenv';
import { Client } from 'pg';
import { databasePoolConfig } from '../src/core/database-config.js';
import { assessDatabaseReadiness, databaseReadinessQuery, type DatabaseFacts } from '../src/core/database-readiness.js';

// This script intentionally does not import dotenv/config or the application's
// config module. It reads only the explicitly selected file, never ambient URLs.
export interface HostedDatabaseFacts {
  server_version_num: number;
  postgis_installed_version: string | null;
  postgis_available_version: string | null;
  migrator_is_superuser: boolean;
  migrator_can_create_roles: boolean;
  backend_tls: boolean;
}

const capabilityQuery = `SELECT
  current_setting('server_version_num')::integer AS server_version_num,
  (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis_installed_version,
  (SELECT default_version FROM pg_available_extensions WHERE name = 'postgis') AS postgis_available_version,
  (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS migrator_is_superuser,
  (SELECT rolsuper OR rolcreaterole FROM pg_roles WHERE rolname = current_user) AS migrator_can_create_roles,
  COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()), false) AS backend_tls`;

export function hostedConnectionConfig(values: Record<string, string>, key: 'DIRECT_URL' | 'DATABASE_URL') {
  if (!values[key]) throw new Error(key + '_MISSING');
  let url: URL;
  try { url = new URL(values[key]); } catch { throw new Error(key + '_INVALID'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error(key + '_DIRECT_POSTGRES_REQUIRED');
  const modes = url.searchParams.getAll('sslmode');
  if (modes.length > 1 || modes.some((mode) => !['require', 'verify-ca', 'verify-full'].includes(mode))) {
    throw new Error(key + '_VERIFIED_TLS_REQUIRED');
  }
  // Provider-generated sslmode=require URLs are checked with certificate AND
  // hostname validation. This does not modify the supplied file.
  url.searchParams.set('sslmode', 'verify-full');
  try {
    return databasePoolConfig({
      DATABASE_URL: url.toString(),
      DATABASE_TLS_CA: values.DATABASE_TLS_CA || undefined,
      DATABASE_POOL_MAX: 1,
      DATABASE_CONNECT_TIMEOUT_MS: 10000,
      DATABASE_STATEMENT_TIMEOUT_MS: 10000,
      NODE_ENV: 'production',
    });
  } catch { throw new Error(key + '_CONNECTION_CONFIGURATION_INVALID'); }
}

export function assessHostedDatabase(facts: HostedDatabaseFacts, runtime?: DatabaseFacts) {
  const blockers: string[] = [];
  if (!Number.isInteger(facts.server_version_num) || Math.floor(facts.server_version_num / 10000) !== 18) blockers.push('POSTGRESQL_18_REQUIRED');
  if (!facts.postgis_available_version && !facts.postgis_installed_version) blockers.push('POSTGIS_NOT_AVAILABLE');
  const runtimeAssessment = runtime ? assessDatabaseReadiness(runtime, true) : null;
  if (!runtimeAssessment) blockers.push('RUNTIME_CONNECTION_NOT_VERIFIED');
  if (!facts.migrator_can_create_roles && !runtimeAssessment?.ready) blockers.push('ROLE_PROVISIONING_NOT_CONFIRMED');
  // Sentinel currently checks pg_stat_ssl at the SQL server. A proxy can
  // terminate client TLS while this value is false; report that distinction.
  if (!facts.backend_tls) blockers.push('MIGRATOR_BACKEND_TLS_NOT_REPORTED');
  if (runtimeAssessment) blockers.push(...runtimeAssessment.blockers.map((code) => 'RUNTIME_' + code));
  return { ready: blockers.length === 0, blockers };
}

async function inspect<T>(values: Record<string, string>, key: 'DIRECT_URL' | 'DATABASE_URL', query: string): Promise<T> {
  const client = new Client(hostedConnectionConfig(values, key));
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const result = await client.query(query);
    await client.query('ROLLBACK');
    return result.rows[0] as T;
  } finally {
    await client.end();
  }
}

function safeFailure(error: unknown) {
  if (error instanceof Error && /^(?:DIRECT_URL|DATABASE_URL)_[A-Z_]+$/.test(error.message)) return error.message;
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' && /^[A-Z0-9_]{2,64}$/.test(code) ? code : 'CONNECTION_OR_QUERY_FAILED';
}

export async function checkHostedDatabase(args: string[]): Promise<number> {
  if (args.length !== 2 || args[0] !== '--env' || !args[1]) {
    console.error('Usage: npx tsx scripts/check-hosted-database.ts --env <credential-file>');
    return 2;
  }
  let values: Record<string, string>;
  try { values = parse(await readFile(resolve(args[1]), 'utf8')); }
  catch { console.error(JSON.stringify({ ready: false, blockers: ['ENV_FILE_UNREADABLE'] })); return 2; }

  let migrator: HostedDatabaseFacts;
  try { migrator = await inspect<HostedDatabaseFacts>(values, 'DIRECT_URL', capabilityQuery); }
  catch (error) {
    console.error(JSON.stringify({ ready: false, stage: 'migrator', blockers: [safeFailure(error)] }));
    return 1;
  }

  let runtime: DatabaseFacts | undefined;
  let runtimeError: string | undefined;
  if (!values.DATABASE_URL || values.DATABASE_URL === values.DIRECT_URL) {
    runtimeError = 'DISTINCT_RUNTIME_CONNECTION_REQUIRED';
  } else {
    try { runtime = await inspect<DatabaseFacts>(values, 'DATABASE_URL', databaseReadinessQuery); }
    catch (error) { runtimeError = safeFailure(error); }
  }
  const assessment = assessHostedDatabase(migrator, runtime);
  if (runtimeError) assessment.blockers.push(runtimeError);
  assessment.ready = assessment.blockers.length === 0;
  console.log(JSON.stringify({
    ...assessment,
    migrator: { ...migrator, client_tls_verified: true },
    runtime: runtime ? {
      server_version_num: runtime.server_version_num,
      postgis_version: runtime.postgis_version,
      unsafe_role: runtime.unsafe_role,
      owns_application_tables: runtime.owns_application_tables,
      backend_tls: runtime.tls,
      client_tls_verified: true,
    } : null,
    notes: [
      'Read-only catalog inspection; no roles, extensions, schemas, or resources were created.',
      'Migrator privileges are expected for setup and are not suitable for the runtime connection.',
      'Catalog CREATEROLE permission alone does not prove the provider accepts a custom-role login through its connection gateway.',
      'Client TLS is certificate-verified; backend_tls reports pg_stat_ssl inside PostgreSQL and can differ behind a TLS-terminating proxy.',
    ],
  }, null, 2));
  return assessment.ready ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await checkHostedDatabase(process.argv.slice(2));
}
