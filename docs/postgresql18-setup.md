> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# PostgreSQL 18 / PostGIS setup skeleton

> 30 September 2026 update: see [Sentinel setup and activation](sentinel-setup-and-activation.md) for the implemented WeatherNext 3 BigQuery path, Mapbox portal, scoped endpoints, PostgreSQL 18/PostGIS verification and current Railway deployment target. Earlier baseline claims below are historical; the remaining full-scope requirements still apply.

Step 1 documentation; trace S02/S09/S10 in the [specification](sentinel-implementation-plan.md). **External managed PG18/PostGIS is the target, not a verified provisioned database. No production migration or cutover authorized.**

| State | Current evidence |
| --- | --- |
| Implemented | Parent reports direct `PrismaPg` bounded-pool runtime with `@prisma/adapter-pg` 7.10.0/`pg`/`@types/pg`, no Accelerate, locations/skills cache strategy removed, validated DB configuration and read-only prerequisite diagnostics. Prisma 8 remains migration owner. Final evidence belongs in the [root runbook](../DEPLOYMENT_RUNBOOK.md). |
| Owner action | Select actual PG18/PostGIS-capable provider/region, authorize billing/network/roles/PITR and supply secure connection references. |
| Blocked | No Docker or `psql` found by parent tooling; real PG18/PostGIS readiness, migration/RLS/container tests unperformed. Provider/live capability evidence, tenant/identity/device/job migrations, restored-data rehearsal and cutover approval remain required, not owner configuration alone. |
| Verified | Parent reports passing tests, type checks and build at the [checkpoint](sentinel-implementation-plan.md#current-partial-step-1-baseline). No real database version/extension/TLS/RLS/pooling/migration or restore verification; no checks rerun here. |

## Required inputs and actions

Record `REQUIRED`: provider/account/project and region; exact PG18 patch/PostGIS availability; data-residency agreement; private host/port/database; runtime versus migration/listener role; direct/pooler endpoints and mode; CA/TLS validation requirements; connection budget/API-worker replica caps; backup/PITR retention and restore destination; RPO/RTO evidence; maintenance/rotation/on-call owner; approved legacy organization/backfill plan. Prisma/ORM version is not server version. Historical [database migration guidance](railway-data-migration-and-recovery.md) is not provider evidence.

Owner configures private network rules and verified TLS, managed PG18/PostGIS, separate least-privilege non-owner runtime roles without `BYPASSRLS`, controlled migration role, backup/PITR and alerts. `pg_cron` is optional, not required; do not add redundant Redis/Kafka/vector or in-cluster database stacks. Server/extension support must be confirmed before provider choice, not inferred from a generic PostgreSQL service.

Inject runtime `DATABASE_URL` and migration `DIRECT_URL` through deployment secrets, never source/chat/command history. Parent reports `src/core/database-config.ts` accepts only `postgres`/`postgresql`, rejects Accelerate and TLS URL overrides, and requires production `sslmode=verify-full`. Optional runtime CA is `DATABASE_TLS_CA`; pool maximum range 1–50/default 10, connection timeout 5,000 ms, idle timeout 30,000 ms, statement timeout 10,000 ms. `DIRECT_URL` is migration-only and never runtime fallback. `src/core/prisma.ts` uses direct `PrismaPg`, not `accelerateUrl`; locations/skills `cacheStrategy` was removed. Preserve computed client extensions and fresh transactional safety/authorization reads. `.env.example` updated; actual `.env` and credentials untouched. Configuration support is not production cutover approval.

Implemented diagnostics: `src/core/database-readiness.ts`, read-only `npm run db:readiness`, and `GET /api/ready` (200/503, `database_prerequisites` only) check PG18, PostGIS, nonprivileged non-owner runtime role and TLS. The CLI has **not run against a real DB**. Neither route nor CLI certifies migrations, tenant RLS, worker readiness or Sentinel readiness.

## Planned verification commands — not executed

Use an owner-configured **isolated** target. For `psql`, inject standard libpq connection settings and secure password/service file through the secret manager; do not put passwords in arguments. Do not disable TLS verification. With those inputs already supplied, these read-only checks are proposed:

```powershell
npm run db:readiness
psql -X -w -v ON_ERROR_STOP=1 -c 'SHOW server_version;'
psql -X -w -v ON_ERROR_STOP=1 -c 'SELECT extname, extversion FROM pg_extension;'
psql -X -w -v ON_ERROR_STOP=1 -c 'SELECT PostGIS_Full_Version();'
psql -X -w -v ON_ERROR_STOP=1 -c 'SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;'
psql -X -w -v ON_ERROR_STOP=1 -c 'SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid();'
npm run prisma8:status
npm run prisma8:check
npm run prisma8:verify
```

`db:readiness` is parent-reported implemented; Prisma 8 aliases were recorded at the earlier inspection. Confirm current migration-tool prerequisites in the root runbook before use. Expected: actual PG18, PostGIS installed/usable, runtime non-owner and not superuser/BYPASSRLS, encrypted session and migration graph/schema consistency. Encrypted-session output alone does not prove client certificate/hostname verification; inspect TLS configuration and negative-certificate tests separately. No command above proves tenant RLS, listener compatibility, spatial index performance, backup validity or production readiness.

Future acceptance: additive migrations owned only by Prisma 8 `migrations/app/`, compatibility schema parity; tenant composite FKs/RLS and pooled transaction-local reset; PostGIS SRID/meters/dateline/zero coordinates/indexes; global dedup across partitions; jobs/leases/fencing/polling; dedicated session listener connections; budgets at maximum API/worker scaling. Reconcile duplicate assignments and approved org/coordinate backfills without inventing partner ownership. Run migration rehearsals only against restored isolated data with approved handling.

## Recovery and cutover blockers

Rehearse PITR/backup restoration and measure conditional RPO ≤5 minutes/RTO ≤60 minutes, schema/data/tenant/identity parity and expired-content enforcement. Store sanitized evidence and recovery contact. Rotate DB credentials with staged pool replacement and least privilege; verify listener/retry behavior. Production write freeze/final synchronization, verified backups and explicit owner authorization remain mandatory. After new writes rollback needs reconciliation, not reverting a URL. Never run demo seed against production. This skeleton does not authorize `prisma8:migrate` or any production write.