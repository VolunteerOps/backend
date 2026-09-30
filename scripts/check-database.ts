import 'dotenv/config';
import { Pool } from 'pg';
import { databasePoolConfig } from '../src/core/database-config.js';
import { assessDatabaseReadiness, databaseReadinessQuery, type DatabaseFacts } from '../src/core/database-readiness.js';

let pool: Pool | undefined;
try {
  pool = new Pool({ ...databasePoolConfig(process.env), max: 1, application_name: 'volunteerops-readiness' });
  const result = await pool.query<DatabaseFacts>(databaseReadinessQuery);
  if (result.rows.length !== 1) throw new Error('Database facts unavailable');
  const readiness = assessDatabaseReadiness(result.rows[0], process.env.NODE_ENV === 'production');
  console.log(JSON.stringify(readiness));
  if (!readiness.ready) process.exitCode = 1;
} catch {
  // Connection errors may contain hostnames or credentials. Do not print them.
  console.error('Database readiness failed; check direct URL, TLS, connectivity and runtime grants.');
  process.exitCode = 1;
} finally {
  await pool?.end();
}