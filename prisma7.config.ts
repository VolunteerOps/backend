import 'dotenv/config';
import { defineConfig } from '@prisma/prisma7/config';

// Client generation does not need a live database. Keep builds deterministic
// before Compute injects secrets; migration commands still fail safely unless
// DIRECT_URL (or a normal PostgreSQL DATABASE_URL) is configured.
const migrationUrl =
  process.env.DIRECT_URL ??
  (process.env.DATABASE_URL?.startsWith('postgres') ? process.env.DATABASE_URL : undefined) ??
  'postgresql://invalid:invalid@127.0.0.1:5432/invalid';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Compatibility generation only. Prisma 8 owns migrations/app/.
    url: migrationUrl,
  },
});
