import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { Client } from 'pg';
let directory, client, child;
try {
  const url = new URL(process.env.DIRECT_URL ?? '');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.searchParams.get('sslmode') !== 'verify-full') throw new Error('MIGRATION_TLS_REQUIRED');
  if (!process.env.DATABASE_TLS_CA) throw new Error('MIGRATION_CA_REQUIRED');
  if ([...url.searchParams.keys()].some(key => /^ssl/i.test(key) && key !== 'sslmode')) throw new Error('TLS_OVERRIDE_DENIED');
  directory = mkdtempSync(join(tmpdir(), 'resq-migrate-'));
  const caPath = join(directory, 'ca.pem');
  writeFileSync(caPath, process.env.DATABASE_TLS_CA, { mode: 0o600 });
  const direct = new URL(url); direct.searchParams.delete('sslmode');
  client = new Client({ connectionString: direct.toString(), ssl: { rejectUnauthorized: true, ca: process.env.DATABASE_TLS_CA }, connectionTimeoutMillis: 10000, statement_timeout: 30000 });
  await client.connect();
  const role = (await client.query('SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user')).rows[0];
  if (!role || Object.values(role).some(Boolean)) throw new Error('RESTRICTED_MIGRATION_OWNER_REQUIRED');
  const lock = (await client.query('SELECT pg_try_advisory_lock(726377, 1) AS acquired')).rows[0];
  if (!lock.acquired) throw new Error('MIGRATION_ALREADY_RUNNING');
  const env = { ...process.env, DO_NOT_TRACK: '1', PRISMA_DISABLE_TELEMETRY: '1', NODE_EXTRA_CA_CERTS: caPath, PGOPTIONS: '-c lock_timeout=10000 -c statement_timeout=120000' };
  delete env.DATABASE_URL;
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { child?.kill(signal); process.exitCode = 1; });
  for (const script of ['prisma8:check', 'prisma8:migrate', 'prisma8:verify']) {
    if (process.exitCode) throw new Error('MIGRATION_INTERRUPTED');
    await new Promise((resolve, reject) => {
      child = spawn(process.execPath, ['--run', script], { env, stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error('MIGRATION_STEP_FAILED')));
    });
  }
  console.log('MIGRATION_VERIFIED');
} catch { console.error('MIGRATION_FAILED'); process.exitCode = 1; }
finally { await client?.end().catch(() => {}); if (directory) rmSync(directory, { recursive: true, force: true }); }
