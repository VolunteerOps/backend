export interface DatabaseFacts {
  server_version_num: number;
  postgis_version: string | null;
  unsafe_role: boolean;
  owns_application_tables: boolean;
  tls: boolean;
}

export const databaseReadinessQuery = `
  SELECT current_setting('server_version_num')::integer AS server_version_num,
    (SELECT extversion FROM pg_extension WHERE extname = 'postgis') AS postgis_version,
    EXISTS (SELECT 1 FROM pg_roles
      WHERE (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)
        AND pg_has_role(current_user, oid, 'MEMBER')) AS unsafe_role,
    EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
        AND c.relkind IN ('r', 'p') AND pg_has_role(current_user, c.relowner, 'MEMBER')) AS owns_application_tables,
    COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()), false) AS tls
`;

export function assessDatabaseReadiness(facts: DatabaseFacts, requireTls: boolean) {
  const blockers: string[] = [];
  if (!Number.isInteger(facts.server_version_num) || Math.floor(facts.server_version_num / 10000) !== 18) {
    blockers.push('POSTGRESQL_18_REQUIRED');
  }
  if (!facts.postgis_version) blockers.push('POSTGIS_REQUIRED');
  if (facts.unsafe_role !== false) blockers.push('NON_PRIVILEGED_RUNTIME_ROLE_REQUIRED');
  if (facts.owns_application_tables !== false) blockers.push('NON_OWNER_RUNTIME_ROLE_REQUIRED');
  if (requireTls && facts.tls !== true) blockers.push('DATABASE_TLS_REQUIRED');
  return {
    ready: blockers.length === 0,
    blockers,
    server_version_num: facts.server_version_num,
    postgis_version: facts.postgis_version,
  };
}