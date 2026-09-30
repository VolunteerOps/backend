import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { z } from 'zod';
import { databasePoolConfig } from '../src/core/database-config.js';
import { getFirebaseIdentityVerifier } from '../src/core/firebase.js';
import { bootstrapPlatformOwner, bindLegacyIdentity } from '../src/modules/platform/bootstrap.js';

const { values } = parseArgs({ options: {
  operation: { type: 'string' }, 'user-id': { type: 'string' }, 'confirm-user-id': { type: 'string' },
  'token-file': { type: 'string' }, reason: { type: 'string' },
}, strict: true });
const args = z.object({
  operation: z.enum(['bootstrap-owner', 'bind-legacy']), 'user-id': z.coerce.number().int().positive(),
  'confirm-user-id': z.coerce.number().int().positive(), 'token-file': z.string().min(1), reason: z.string().trim().min(20).max(1000),
}).parse(values);
if (args['user-id'] !== args['confirm-user-id']) throw new Error('Confirmed user ID must match the reviewed mapping');
if (!process.env.DIRECT_URL) throw new Error('A separately authorized DIRECT_URL is required for this operator command');
const token = (await readFile(args['token-file'], 'utf8')).trim();
const identity = await getFirebaseIdentityVerifier().verifyIdToken(token);
const pool = new Pool(databasePoolConfig({ ...process.env, DATABASE_URL: process.env.DIRECT_URL, DATABASE_POOL_MAX: '1' }));
const client = await pool.connect();
try {
  // Require a table owner/superuser here so RLS cannot hide a prior grant from the empty-grant check.
  const role = await client.query(`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper)
    OR EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.platform_grants'::regclass
      AND pg_has_role(current_user, relowner, 'MEMBER')) AS authorized`);
  if (!role.rows[0]?.authorized) throw new Error('Operator database identity must own the platform-grant table');
  if (args.operation === 'bootstrap-owner') await bootstrapPlatformOwner(client, identity, args['user-id'], args.reason);
  else await bindLegacyIdentity(client, identity, args['user-id'], args.reason);
  console.log(JSON.stringify({ status: 'completed', operation: args.operation, user_id: args['user-id'] }));
} catch {
  // Never print token, connection details, identity claims or provider errors.
  console.error('IDENTITY_OPERATOR_FAILED: review the binding, privileges and audit records');
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
