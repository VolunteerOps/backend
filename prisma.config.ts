import 'dotenv/config';
import { definePrismaConfig } from 'prisma/config';
import { defineConfig as definePostgresConfig } from '@prisma/orm-postgres/config';

// Contract emission is build-time and does not connect to PostgreSQL. A valid
// placeholder lets dependency/build checks run before Compute injects secrets;
// commands that access the database still fail safely unless DIRECT_URL is set.
const databaseUrl = process.env.DIRECT_URL ?? 'postgresql://invalid:invalid@127.0.0.1:5432/invalid';

function withLibpqSslSemantics(connectionString: string): string {
  const url = new URL(connectionString);

  // Prisma Postgres issues sslmode=require URLs. Prisma 8 uses node-postgres,
  // whose current parser otherwise treats `require` as `verify-full`.
  if (url.searchParams.get('sslmode') === 'require' && !url.searchParams.has('uselibpqcompat')) {
    url.searchParams.set('uselibpqcompat', 'true');
  }

  return url.toString();
}

export default definePrismaConfig({
  orm: definePostgresConfig({
    contract: 'prisma8/contract.prisma',
    output: 'src/generated/prisma8',
    db: {
      connection: withLibpqSslSemantics(databaseUrl),
    },
  }),
});
