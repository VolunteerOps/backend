import { z } from 'zod';
import type { PoolConfig } from 'pg';

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(60000).default(10000),
  DATABASE_TLS_CA: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export function databasePoolConfig(input: unknown): PoolConfig {
  const values = databaseEnvSchema.parse(input);
  const url = new URL(values.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must be a direct PostgreSQL URL; Accelerate is not the Sentinel database transport');
  }
  if (!url.hostname || url.pathname.length <= 1 || url.hash) {
    throw new Error('DATABASE_URL must specify a host and database without a fragment');
  }

  const sslMode = url.searchParams.get('sslmode');
  if (url.searchParams.getAll('sslmode').length > 1) {
    throw new Error('Duplicate database TLS settings are not allowed');
  }
  // TLS is configured below, never overridden by node-postgres URL parsing.
  for (const key of url.searchParams.keys()) {
    if (/^ssl/i.test(key) && key !== 'sslmode' || key.toLowerCase() === 'uselibpqcompat') {
      throw new Error('Use sslmode and DATABASE_TLS_CA instead of URL TLS overrides');
    }
  }
  if (sslMode !== null && sslMode !== 'disable' && sslMode !== 'verify-full') {
    throw new Error('Database sslmode must be verify-full, or disable for local development only');
  }
  if (values.NODE_ENV === 'production' && sslMode !== 'verify-full') {
    throw new Error('Production DATABASE_URL requires sslmode=verify-full');
  }
  url.searchParams.delete('sslmode');

  return {
    connectionString: url.toString(),
    max: values.DATABASE_POOL_MAX,
    connectionTimeoutMillis: values.DATABASE_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: values.DATABASE_IDLE_TIMEOUT_MS,
    statement_timeout: values.DATABASE_STATEMENT_TIMEOUT_MS,
    ssl: sslMode === 'disable' ? false : {
      rejectUnauthorized: true,
      ...(values.DATABASE_TLS_CA ? { ca: values.DATABASE_TLS_CA } : {}),
    },
    application_name: 'volunteerops-api',
  };
}