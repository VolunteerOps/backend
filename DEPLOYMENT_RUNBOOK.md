# VolunteerOps deployment runbook

Last verified: 7 September 2026

This is the source of truth for deploying the VolunteerOps API, its Prisma Postgres database, Accelerate query caching, and Prisma Object Store integration. The production API target is **Prisma Compute**, not Render.

## 1. What this system is

VolunteerOps is a disaster-response operations platform:

- `backend/` is an Express + TypeScript REST API for authentication, volunteers, missions/events, deployments, field reports, communications, telemetry, notifications, feedback, and operational analytics.
- `volunteer/` is a Kotlin Multiplatform client for responders.
- `admin/` is a Kotlin Multiplatform operations console.
- PostgreSQL stores authoritative operational data. Prisma ORM is the data layer.
- Prisma Object Store holds binary objects such as avatars, field-report media, PDFs, and attachments. PostgreSQL stores only an object key or application URL.

The two KMP apps are currently local-state prototypes. Their `shared` modules have no Ktor/HTTP data-source dependency and their repositories operate on in-memory/local snapshots. Connecting them to the deployed backend is a real client-integration step; changing only an API base URL is not enough.

## 2. Version decision: Prisma 8 is not PostgreSQL 18

Do not couple the ORM major version to the database server major version.

| Component | Verified state | Deployment decision |
| --- | --- | --- |
| This repository before this change | Prisma ORM 6.12 | Migrated to Prisma ORM 7.10 first, as required by the supported upgrade path |
| Production runtime in this repository | Prisma ORM 7.10 + `@prisma/extension-accelerate` 3.0.1 | Supported bridge release; build and live Accelerate query verified |
| `prisma@latest` on 7 Sep 2026 | `8.0.0-rc.13` in npm; Node `>=22.18.0` | Do not silently put a release candidate into this incident-management backend |
| Prisma Postgres managed database | PostgreSQL 17 | This is the server version available when hosting the database in Prisma Console |
| External/self-hosted PostgreSQL | Prisma ORM supports PostgreSQL 18 | Use only if PostgreSQL 18 is a hard requirement and host the database outside Prisma Postgres |

Prisma's import documentation explicitly says Prisma Postgres runs PostgreSQL 17 and requires a special downgrade-compatible path when importing from PostgreSQL 18 or later. Therefore, a production topology of “Prisma Console database + PostgreSQL 18” is not currently selectable.

Official references:

- [Prisma 7 to Prisma 8 PostgreSQL migration](https://www.prisma.io/docs/guides/upgrade-prisma-orm/postgresql)
- [Prisma Postgres overview](https://www.prisma.io/docs/postgres)
- [Importing PostgreSQL into Prisma Postgres](https://www.prisma.io/docs/prisma-postgres/import-from-existing-database-postgresql)
- [Prisma ORM database version support](https://www.prisma.io/docs/orm/v6/reference/supported-databases)

### 2.1 What changed in the backend now

- Prisma ORM is pinned to `7.10.0`; do not use a floating major in production.
- The modern `prisma-client` generator writes to `src/generated/prisma`.
- Connection configuration moved from `schema.prisma` to `prisma.config.ts`.
- `DATABASE_URL` is the `prisma+postgres://` runtime/Accelerate URL.
- `DIRECT_URL` is the direct TCP URL used by migrations and other schema operations.
- `new PrismaClient({ accelerateUrl: DATABASE_URL })` is used as required by the JavaScript engine.
- Docker now uses Node 22; Prisma 7 requires Node 20.19+, 22.12+, or 24+.

### 2.2 Optional PostgreSQL 18 development target

There was no PostgreSQL container or `17.2` image in this repository to update. If a local/self-hosted database is added, pin its image to `postgres:18` (prefer an exact `18.x` patch in a production infrastructure repository), use a direct `postgresql://` connection, and use `@prisma/adapter-pg` rather than passing that URL as `accelerateUrl`.

If production must be PostgreSQL 18, host PostgreSQL 18 with another provider, enable standalone Accelerate for that database in Prisma Console, and keep Compute as the web-service host. That is a different topology from managed Prisma Postgres.

## 3. Prerequisites

- A Prisma Data Platform account and workspace.
- A GitHub repository containing this backend. Prisma Compute deploy-on-push uses GitHub.
- Node.js 22.18 or newer for the current Prisma 8 platform CLI/Composer workflow. The workstation used during this audit had Node 22.15 and must be upgraded before running those commands.
- npm 10+.
- Production frontend origins and a production API domain decision.
- A password manager or secret manager for one-time database and bucket credentials.

From `backend/`, establish a clean local baseline:

```bash
npm ci
npm run prisma:generate
npm run prisma:validate
npm run build
```

Never run `npm run db:seed` against an existing production database. The current seed script intentionally deletes records before inserting demonstration data.

## 4. Create and connect Prisma Postgres

### 4.1 Create the project and database

Console path:

1. Open [Prisma Console](https://console.prisma.io).
2. Create or select the VolunteerOps workspace.
3. Create a project named `volunteerops`.
4. Create a Prisma Postgres database named `volunteerops-production` in the nearest available region to Compute users.
5. Store both connection values immediately when shown:
   - accelerated/pooled `prisma+postgres://...` URL for runtime queries;
   - direct `postgres://...db.prisma.io:5432/postgres?sslmode=require` URL for migrations.

CLI alternative (verify current help before automation):

```bash
npx prisma@latest auth login
npx prisma@latest auth whoami
npx prisma@latest project create volunteerops
npx prisma@latest postgres create volunteerops-production
```

Connection strings and access-key secrets are one-time values. Do not paste them into commits, tickets, logs, screenshots, or mobile configuration.

### 4.2 Local environment

Create `.env` from `.env.example` and replace every placeholder:

```dotenv
DATABASE_URL="prisma+postgres://..."
DIRECT_URL="postgres://...@db.prisma.io:5432/postgres?sslmode=require"
JWT_SECRET="<new random 64-byte hex value>"
JWT_REFRESH_SECRET="<different random 64-byte hex value>"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
COOKIE_SECURE="true"
COOKIE_DOMAIN=""
CORS_ORIGIN="https://volunteer.example,https://admin.example"
NODE_ENV="production"
LOG_LEVEL="info"
```

Generate each JWT secret independently:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 4.3 Apply the existing schema

The current application uses Prisma 7 migrations. Run schema changes separately from a Compute deploy:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:validate
```

Check migration state:

```bash
npx prisma migrate status
```

Open Studio from Prisma Console to verify the tables. Do not seed production unless the database is new, empty, explicitly intended for demo data, and deletion of its contents is acceptable.

## 5. Accelerate and query caching

Prisma Postgres includes Accelerate connection pooling and global query caching; there is no second cache service to provision. The backend enables the extension in `src/core/prisma.ts` and already applies `cacheStrategy` to low-volatility skills and location reads.

Do cache:

- skill catalog and categories;
- relatively static locations;
- expensive aggregate dashboards that tolerate documented staleness.

Do not cache:

- authentication, authorization, or refresh-token queries;
- live assignments and responder status;
- distress telemetry;
- writes or reads that must immediately reflect a write.

Verify the configured connection and cache:

```bash
npm run accelerate:test
```

A successful run performs the same read twice. Expect the second request to be substantially faster after the cache fill. During this implementation the first read took about 5.1 seconds (cold database/cache) and the repeated read took 201 ms.

Reference: [Prisma Postgres query caching](https://www.prisma.io/docs/postgres/database/caching).

## 6. Create Prisma Object Store buckets

Use at least two buckets:

- `volunteerops-production-uploads`, attached to the default/production branch;
- `volunteerops-preview-uploads`, attached to the preview branch or preview role.

In Prisma Console:

1. Open the VolunteerOps project and Object Store.
2. Create the production bucket.
3. Mint a `read_write` access key for the backend service.
4. Save `endpoint`, `bucketName`, `accessKeyId`, and `secretAccessKey` immediately. The secret is shown once.
5. Repeat for preview; never let preview deployments write into the production bucket.

Set these only on the Compute backend service:

```dotenv
S3_ENDPOINT="<bucket endpoint>"
S3_BUCKET="volunteerops-production-uploads"
S3_ACCESS_KEY_ID="<bucket key id>"
S3_SECRET_ACCESS_KEY="<one-time bucket secret>"
S3_REGION="auto"
```

Equivalent platform commands:

```bash
npx prisma@latest project env add S3_ENDPOINT=<endpoint> --role production
npx prisma@latest project env add S3_BUCKET=<bucketName> --role production
npx prisma@latest project env add S3_ACCESS_KEY_ID=<accessKeyId> --role production
npx prisma@latest project env add S3_SECRET_ACCESS_KEY=<secretAccessKey> --role production
```

Repeat with `--role preview` and preview credentials.

Deleting a bucket deletes all objects and keys even when non-empty. Treat deletion as destructive and verify the exact bucket id first.

Reference: [Prisma Compute Object Storage](https://www.prisma.io/docs/compute/object-storage).

### 6.1 Backend storage API implemented here

The backend is the credential boundary:

- `POST /api/storage/upload-url` requires a valid access token and returns a five-minute presigned PUT URL plus an `object_key`.
- `GET /api/storage/download-url?key=...` requires authentication and returns a five-minute presigned GET URL.
- Volunteers can sign only their own object prefix. Team leads/coordinators/admins can read operational objects.
- Allowed categories are `avatars`, `field-reports`, and `attachments`.
- Allowed content types are JPEG, PNG, WebP, PDF, CSV, text, and generic binary; the requested object size is capped at 10 MiB.

Example upload flow:

```bash
curl -X POST "https://<api-host>/api/storage/upload-url" \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"file_name":"assessment.jpg","content_type":"image/jpeg","byte_size":123456,"category":"field-reports"}'

curl -X PUT "<upload_url from response>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @assessment.jpg
```

Persist `object_key`, not the expiring presigned URL. The field-report validator accepts both legacy HTTPS URLs and VolunteerOps object keys. Request a fresh download URL whenever media is viewed.

Do not put `S3_*`, `PRISMA_SERVICE_TOKEN`, `DATABASE_URL`, or `DIRECT_URL` in Android resources, iOS plists, JavaScript bundles, desktop properties, or either KMP repository.

## 7. Connect the volunteer and admin KMP apps

Both clients need an HTTP-backed repository layer before they can use database records or storage.

### 7.1 Shared networking work

In each app's `shared/build.gradle.kts`:

1. Add Ktor client core, content negotiation, Kotlin serialization, logging (development only), and auth to `commonMain`.
2. Add platform engines: OkHttp or Android engine for Android, Darwin for iOS, CIO for JVM, and JS/Wasm client support for browsers.
3. Add a non-secret API base URL configuration per build target.
4. Replace or wrap `VolunteerRepository` / `AdminRepository` with remote data sources. Keep local snapshots only as an explicit offline cache.
5. Store access and refresh tokens in platform secure storage, not the existing plain local snapshot.

### 7.2 Upload sequence

1. Authenticate against `POST /api/auth/login` and retain the access token securely.
2. Select or capture a file and validate its MIME type and local size.
3. Call `POST /api/storage/upload-url` with filename, content type, byte size, and category.
4. PUT raw bytes to `upload_url` using the exact returned `Content-Type` header. Do not add the API bearer token to this S3 request.
5. Save the returned `object_key` through the relevant API record:
   - volunteer/avatar workflow: avatar record field;
   - field report: `media_url` or `file_upload_url`;
   - general document: the future attachment metadata endpoint.
6. To display/download, call `GET /api/storage/download-url?key=<encoded-key>` and use the returned URL before it expires.

For browser/Wasm targets, configure the bucket's permitted origins/methods if Prisma Console exposes bucket CORS controls. If direct PUT is blocked by browser policy, add a backend-proxied upload endpoint rather than exposing credentials.

### 7.3 Role behavior

- Volunteer app: upload to its own `/<userId>/` prefix and request its own objects.
- Admin app: coordinators/team leads may request field-report objects across volunteer prefixes.
- The mobile app must not decide authorization; the backend remains authoritative.

## 8. Host `volunteerops-backend` on Prisma Compute

The old Render guide remains only as migration history and the active `render.yaml` blueprint has been removed. Do not create a Render service or put Render URLs into clients.

Prisma Compute is GA, but the current existing-Express-app CLI path uses Prisma Composer, which the Prisma changelog describes as Early Access. Test a preview stage before promoting this emergency-operations API.

### 8.1 Runtime readiness

The service must:

- build to a self-contained Node/Bun entry file;
- listen on the port supplied by Compute/Composer;
- bind to `0.0.0.0`;
- receive secrets as service inputs/environment bindings;
- expose `GET /api/health` returning 200;
- run migrations separately before production traffic switches.

Express is not in the first-class auto-detected framework list. Follow the official existing Node app path instead of pretending it is NestJS or Hono.

### 8.2 Port to Composer

After upgrading local Node to 22.18+:

```bash
npx skills add prisma/composer
npm install @prisma/composer @prisma/composer-prisma-cloud
npx prisma@latest skills sync
```

Then follow [Port an existing app](https://www.prisma.io/docs/composer/porting-an-app):

1. Add `service.ts` using `compute()` and the Node build adapter, targeting the self-contained server bundle.
2. Add `module.ts` to provision the service and its Postgres dependency.
3. Add `prisma-composer.config.ts` with Prisma Cloud state and the Node build extension.
4. Replace the server's `process.env.PORT` access with `service.port()` and bind `0.0.0.0`.
5. Model JWT, CORS, database, and S3 values as `envSecret`/`envParam` service inputs; do not commit values.
6. Build and run locally:

```bash
npm run build
npx prisma@latest dev module.ts
curl -i http://<printed-local-url>/api/health
```

Do not deploy until TypeScript, health, auth, database, and storage tests pass locally.

### 8.3 Create/link project and GitHub

```bash
npx prisma@latest auth login
npx prisma@latest auth whoami
npx prisma@latest project link volunteerops
npx prisma@latest project show
npx prisma@latest git connect
```

The default Git branch deploys to production; other branches are isolated previews. Configure preview database and bucket credentials before pushing a preview branch.

For CI, use workspace-scoped `PRISMA_SERVICE_TOKEN` and explicit workspace/project targets. Never print the token. Prefer `--json --no-interactive` and branch on stable error codes.

### 8.4 Deploy and verify

Run migrations first from a protected CI job using `DIRECT_URL`, then deploy the built Composer module:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run build
npx prisma@latest deploy module.ts
```

Inspect the service and logs:

```bash
npx prisma@latest service list
npx prisma@latest service show volunteerops-backend
npx prisma@latest service logs volunteerops-backend --follow
```

Verify the exact public URL returned by the deployment:

```bash
curl -i "https://<compute-url>/api/health"
curl -i "https://<compute-url>/api"
```

Update volunteer/admin API base URLs and `CORS_ORIGIN` only after this URL is stable. Add a custom domain in Prisma Console if required, then use that durable domain in client builds.

Official references:

- [Prisma Compute getting started](https://www.prisma.io/docs/compute/getting-started)
- [Port an existing app to Composer](https://www.prisma.io/docs/composer/porting-an-app)
- [Deploy a Prisma Compute app](https://www.prisma.io/docs/prisma-compute/deploy)
- [Compute environment variables](https://www.prisma.io/docs/compute/environment-variables)

## 9. Prisma 8 migration gate

Prisma 8 is a TypeScript-native ORM rewrite, not a normal major-version package bump. It replaces the generated Prisma Client API with a contract plus chain-based ORM API. This codebase has many nested includes, aggregates, groupings, transactions, and raw-query helpers, so changing the packages without rewriting those calls would break production.

Proceed only when `npm view prisma version` returns an approved stable release and the deployment runtime meets its engine requirement:

```bash
npm view prisma version engines --json
npm view @prisma/orm-postgres version engines --json
node --version
```

Use the official incremental process:

1. Keep the working Prisma 7 client and migration history.
2. Install Prisma 8 and `@prisma/orm-postgres` side by side.
3. Infer `prisma8/contract.prisma` from the live database.
4. Remove the inferred `_prisma_migrations` model and verify every `@@map` table name.
5. Emit contract artifacts.
6. Migrate one low-risk read route, then verify old and new clients against the same database.
7. Move all routes and tests.
8. Create a Prisma 8 baseline migration, sign the existing database, and set the `db` ref.
9. Retire Prisma 7 migrations only after ownership has transferred.
10. Remove Prisma 7 only when no imports remain.

Do not mix a database-server upgrade, ORM rewrite, and production-host migration in one cutover. Each needs its own deploy and rollback point.

## 10. Production smoke tests

Minimum checks after every deployment:

```bash
curl -fsS "https://<api-host>/api/health"
curl -fsS "https://<api-host>/api"
npm run accelerate:test
```

Then verify:

- login and refresh-token rotation;
- authenticated `/api/auth/me`;
- volunteer and event list reads;
- field-report creation;
- storage upload URL issuance, PUT, object-key persistence, and download URL issuance;
- rejected upload request without auth;
- rejected attempt by a volunteer to sign another user's object key;
- CORS from each exact web origin;
- Android, iOS, desktop, JS, and Wasm API base URLs.

## 11. Operations and rollback

- Compute: inspect the service version and runtime logs in Console before rollback; roll back to the last healthy service version.
- Database: schema deployments are separate. Prefer forward fixes; never assume rolling back app code reverses a migration.
- Accelerate: remove `cacheStrategy` from a query if staleness is unsafe. Do not disable caching globally to fix one workload.
- Object Store: revoke and replace a compromised bucket key, update Compute secrets, and redeploy. Never delete the bucket as a credential-rotation method.
- Backups: review Prisma Postgres backup/PITR retention for the selected plan and perform a documented restore drill.

## 12. Sign-off checklist

- [ ] The team accepts managed Prisma Postgres on PostgreSQL 17, or has chosen a separate PostgreSQL 18 provider.
- [ ] Prisma 7.10 generate, validate, build, and Accelerate smoke tests pass.
- [ ] Production and preview databases are isolated.
- [ ] Production and preview Object Store buckets/keys are isolated.
- [ ] No database, platform, JWT, or S3 secret exists in either KMP app or Git.
- [ ] The Express service has been ported and verified with Composer on a preview stage.
- [ ] Migrations run in a protected job before production service promotion.
- [ ] `/api/health` returns 200 from the public Compute URL.
- [ ] Volunteer and admin apps use the stable Compute/custom-domain API base URL.
- [ ] Upload/download authorization tests pass.
- [ ] Demo seed credentials have not been deployed, or every seeded password has been rotated.
- [ ] Rollback and restore procedures have been rehearsed.
