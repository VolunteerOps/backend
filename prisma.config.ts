import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error('DIRECT_URL or DATABASE_URL must be set for Prisma CLI commands');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Runtime queries use DATABASE_URL through Accelerate. Schema operations use
    // the direct TCP URL so they do not depend on the Accelerate data path.
    url: migrationUrl,
  },
});
