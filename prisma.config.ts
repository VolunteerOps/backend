import 'dotenv/config';
import { definePrismaConfig } from 'prisma/config';
import { defineConfig as definePostgresConfig } from '@prisma/orm-postgres/config';

// Contract emission is build-time and does not connect to PostgreSQL. A valid
// placeholder lets dependency/build checks run before Compute injects secrets;
// commands that access the database still fail safely unless DIRECT_URL is set.
const databaseUrl = process.env.DIRECT_URL ?? 'postgresql://invalid:invalid@127.0.0.1:5432/invalid';

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: 'prisma8/contract.prisma',
    output: 'src/generated/prisma8',
    db: {
      connection: databaseUrl,
    },
  }),
});
