import dotenv from 'dotenv';
import { z } from 'zod';
import { databaseEnvSchema, databasePoolConfig } from './database-config.js';

import { exactOrigins, trustedProxyAddresses } from './http-foundation.js';

dotenv.config();

const envSchema = z.object({
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  PORT: z.coerce.number().int().default(3001),
  CORS_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform(exactOrigins),
  TRUST_PROXY_CIDRS: z.string().default('').transform(trustedProxyAddresses),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).default('auto'),
}).merge(databaseEnvSchema);

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables configuration:', parsed.error.format());
  throw new Error('Environment configuration validation failed.');
}

export const config = parsed.data;
databasePoolConfig(config);
