# ResQ backend

Stage 1 implementation: [evidence and status](docs/stage-1-implementation.md) ? [manual setup and credential rotation](docs/stage-1-manual-setup.md).

Modular Express/TypeScript backend for ResQ volunteer operations and the Sentinel disaster engine. Client repositories are `../volunteer` (Kotlin Multiplatform), `../admin` (Kotlin Multiplatform), and `../web` (Next.js).

The production target is **Railway**. Implementation is incomplete: current core operational routes are deliberately gated until tenant-scoped replacements and client integration are complete. A successful build does not certify live disaster models, billing or deployment.

## Start here

- [Seven-stage production implementation roadmap](docs/resq-production-implementation-roadmap.md): controlling backend/frontend feature scope, sequencing and acceptance.
- [Railway deployment runbook](docs/railway-production-deployment-runbook.md): services, PostgreSQL/PostGIS, buckets, workers, domains and operations.
- [Data migration and recovery](docs/railway-data-migration-and-recovery.md): preservation, canonical migration ownership, cutover and rollback.
- [Documentation index](docs/README.md) and [audit](docs/resq-documentation-audit.md): source coverage and retired guides.
- [Current implementation checkpoint](docs/sentinel-continuation-status.md) and [detailed Sentinel specification](docs/volunteerops-sentinel-disaster-engine.md).

## Current technical boundaries

- Node.js >=22.18, npm >=11.6; pinned lockfile and TypeScript.
- PostgreSQL 18/PostGIS via direct bounded `pg` pooling and `@prisma/adapter-pg`; production verifies server TLS. API uses a non-owner restricted identity.
- Prisma 8 owns `prisma8/contract.prisma` and `migrations/app/`. Prisma 7 generates the compatibility client. Retaining Prisma ORM does not select Prisma's hosting platform.
- Firebase ID tokens/session cookies identify users. PostgreSQL owns current roles, memberships, regions, account state and audit. Old local-password/token routes are retired.
- Durable identity/device/source/forecast jobs and retention entrypoints exist. Full sensing, safety, mobilization and notification workflows remain roadmap work.
- Scoped S3 object metadata/URLs exist. File bytes belong in object storage, not database blobs.
- WeatherNext BigQuery/USGS and a read-only evidence assistant have implementation slices; approved live Google data access and the full engine are not complete.
- RevenueCat backend entitlements and the complete cross-platform live repositories remain to be implemented.

## Local development and verification

Use `.env.example` to understand variable names; fill a private local `.env` without committing secrets. Do not point tests, schema experiments or demo seeds at production. The Railway runbook distinguishes runtime and migration credentials.

```powershell
npm ci
npm run dev
```

Existing checks, with their required isolated test environment configured:

```powershell
npm run test:types
npm test
npm run build
npm run test:portal
npm run test:object-store
npm run db:readiness
```

Database readiness checks prerequisites, not complete application/scientific readiness. Read each suite's environment requirements and record skipped checks honestly. Schema changes use the established Prisma 8 migration workflow described in the Railway runbook; migrations are not executed automatically by these documentation instructions.

Existing runtime commands:

```powershell
npm start
npm run worker:identity
npm run worker:device
npm run worker:sources
npm run worker:forecast
npm run retention:once
```

These are separate service commands, not a sequential launch script. Forecast/provider services need their configured identities and access. Planned additional workers and commands are labelled in the roadmap.

## Documentation-only hosting transition

The obsolete hosting guides have been removed/replaced. Provider-specific source/build/configuration names may still exist; Stage 1 migrates them after equivalent Railway artifacts are verified. No cloud resource, DNS, `.env`, database or runtime implementation changed as part of this documentation task.
