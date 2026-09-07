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
| Prisma 8 toolchain in this repository | `prisma` 8.0.0-rc.13 + `@prisma/orm-postgres` 8.0.0-rc.8 | Installed, configured, and contract emission verified; this is what satisfies Prisma Console's Compute repository check |
| Existing application runtime | `@prisma/client` 7.10 + `@prisma/prisma7` 7.10 + Accelerate 3.0.1 | Intentionally retained during Prisma's supported side-by-side migration so existing API behavior does not change |
| Prisma Postgres managed database | PostgreSQL 17 | This is the server version available when hosting the database in Prisma Console |
| External/self-hosted PostgreSQL | Prisma ORM supports PostgreSQL 18 | Use only if PostgreSQL 18 is a hard requirement and host the database outside Prisma Postgres |

Prisma's import documentation explicitly says Prisma Postgres runs PostgreSQL 17 and requires a special downgrade-compatible path when importing from PostgreSQL 18 or later. Therefore, a production topology of “Prisma Console database + PostgreSQL 18” is not currently selectable.

Official references:

- [Prisma 7 to Prisma 8 PostgreSQL migration](https://www.prisma.io/docs/guides/upgrade-prisma-orm/postgresql)
- [Prisma Postgres overview](https://www.prisma.io/docs/postgres)
- [Importing PostgreSQL into Prisma Postgres](https://www.prisma.io/docs/prisma-postgres/import-from-existing-database-postgresql)
- [Prisma ORM database version support](https://www.prisma.io/docs/orm/v6/reference/supported-databases)

### 2.1 What changed in the backend now

The repository has completed the migration-ownership handoff in phase 4 of Prisma's official incremental Prisma 7-to-8 migration:

- `prisma` now resolves to Prisma 8 and owns `prisma.config.ts`.
- `@prisma/orm-postgres` is installed and the live schema was inferred into `prisma8/contract.prisma`.
- `npm run prisma8:emit` validates that contract and emits its generated runtime/type artifacts.
- The old CLI moved to `@prisma/prisma7`; `prisma7.config.ts` remains only for compatibility-client generation, validation, and Studio.
- Existing Express routes still use the generated Prisma 7 client and Accelerate. That is deliberate: Prisma documents this side-by-side state as shippable while routes are moved incrementally.
- Prisma 8 now owns schema migrations through the checked-in `migrations/app/` graph. The existing database is signed at the graph tip and the checked-in `db` ref points there.
- The existing `npm run prisma:*` deployment aliases now call Prisma 8, so deployment jobs do not fall back to the retired Prisma 7 migration history.
- `npm run build` emits both the Prisma 7 client and Prisma 8 contract before TypeScript compilation.
- The application supports Node `>=22.18.0`; both Docker stages use Node 24.20 so their bundled npm 11 can resolve this repository's Prisma 7/8 transition graph reliably.
- `DATABASE_URL` remains the `prisma+postgres://` runtime/Accelerate URL. `DIRECT_URL` must be the direct `postgres://...@db.prisma.io/...` URL used by both Prisma CLIs for schema work.

Do not replace `@prisma/client` with an 8.x version: Prisma 8's application API is `@prisma/orm-postgres`, not the generated Prisma 7 Client API. Removing the compatibility client before routes are rewritten would break the backend.

### 2.2 Optional PostgreSQL 18 development target

There was no PostgreSQL container or `17.2` image in this repository to update. If a local/self-hosted database is added, pin its image to `postgres:18` (prefer an exact `18.x` patch in a production infrastructure repository), use a direct `postgresql://` connection, and use `@prisma/adapter-pg` rather than passing that URL as `accelerateUrl`.

If production must be PostgreSQL 18, host PostgreSQL 18 with another provider, enable standalone Accelerate for that database in Prisma Console, and keep Compute as the web-service host. That is a different topology from managed Prisma Postgres.

## 3. Prerequisites

- A Prisma Data Platform account and workspace.
- A GitHub repository containing this backend. Prisma Compute deploy-on-push uses GitHub.
- Node.js 22.18 or newer for Prisma 8. The workstation verification used Node 24.20.0.
- Bun for local `@prisma/cli app build` parity; Compute uses Bun to bundle Express into a self-contained artifact.
- npm 11.6 or newer. npm 10's Arborist resolver can crash on the Prisma 7/8 peer-dependency graph with `Cannot read properties of null (reading 'edgesOut')` even when `--omit=dev` is used.
- Production frontend origins and a production API domain decision.
- A password manager or secret manager for one-time database and bucket credentials.

From `backend/`, establish a clean local baseline:

```bash
npm ci
npm run prisma:generate
npm run prisma:validate
npm run prisma8:emit
npm run build
```

Never run `npm run db:seed` against an existing production database. The current seed script intentionally deletes records before inserting demonstration data.

### 3.1 Docker install/build troubleshooting

Both Docker stages must copy `package.json`, `package-lock.json`, and `.npmrc` before running `npm ci`. The committed lockfile uses `legacy-peer-deps=true`. Without `.npmrc`, npm attempts a different peer-dependency graph and reports `EUSAGE` with missing packages such as `vitest`, `react-dom`, and `vite`. `--omit=dev` does not skip dependency resolution, so the production stage needs this setting too. Updating Node alone does not fix this configuration mismatch.

Keep `npm ci` and the committed lockfile; no application rewrite or additional frontend dependencies are required for this error. See the [npm ci documentation on matching lockfile settings](https://docs.npmjs.com/cli/v11/commands/npm-ci/).

To verify the actual Linux image on a Docker-enabled workstation:

```bash
docker build --pull --no-cache -t volunteerops-backend:build-check .
```

The Docker build workflow also builds the image and checks generated Prisma client/Accelerate/S3 imports, entrypoint syntax, native Argon2 hashing, and the absence of development tools and `.env`. It runs without network access. Startup and HTTP health tests need valid runtime configuration because the Prisma client contacts Accelerate during initialization; perform the production smoke tests in section 10 after deployment. `.dockerignore` excludes local secrets, installed dependencies, and generated clients so builds regenerate their own artifacts.

After committing and pushing the fix, redeploy the new commit and check that **both** install stages copy `.npmrc`. If the log still shows `COPY package*.json ./`, the deployment is building an older Dockerfile. Changing the copy instruction invalidates the affected install layers automatically.

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
npx prisma auth login
npx prisma auth whoami --json
npx prisma project create volunteerops --json
npx prisma postgres create volunteerops-production --json
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

### 4.3 Apply and evolve the schema

Prisma 8 owns migrations. Prisma 7 remains only as the compatibility runtime for routes that have not yet moved to the Prisma 8 query API. Do not run `prisma7 migrate dev`, `prisma7 migrate deploy`, or edit `prisma/schema.prisma` for new schema work.

For a schema change, edit `prisma8/contract.prisma`, emit it, plan a named migration, review the generated package under `migrations/app/`, then apply it separately from a Compute deploy:

```bash
npm run prisma:generate
npm run prisma8:plan -- --name <change-name>
npm run prisma8:check
npm run prisma:deploy
npm run prisma8:verify
```

Check migration state:

```bash
npm run prisma8:status
```

The production database was baselined rather than replayed: `db sign` recorded that its existing schema already satisfies the contract, and the `db` ref prevents future plans from starting at an empty database. Do not routinely re-run `db sign`; use it only for an explicitly reviewed drift-recovery or database-adoption operation.

`DIRECT_URL` must use the direct host (`db.prisma.io`), not `pooled.db.prisma.io`. Runtime traffic continues to use the Accelerate URL in `DATABASE_URL`.

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
npx @prisma/cli@latest project env add S3_ENDPOINT=<endpoint> --role production
npx @prisma/cli@latest project env add S3_BUCKET=<bucketName> --role production
npx @prisma/cli@latest project env add S3_ACCESS_KEY_ID=<accessKeyId> --role production
npx @prisma/cli@latest project env add S3_SECRET_ACCESS_KEY=<secretAccessKey> --role production
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

Prisma Compute is GA. The repository now includes `prisma.compute.json`, which declares the Express entrypoint (`src/index.ts`) and port 3001. Compute's current SDK maps Express to its Bun bundling strategy, producing a self-contained server artifact after the normal build script generates the Prisma 7 client and emits the Prisma 8 contract. Test a candidate/preview deployment before promoting this emergency-operations API.

### 8.1 Runtime readiness

The service must:

- build to a runnable Node entry file;
- listen on the port supplied by Compute;
- bind to `0.0.0.0`;
- receive secrets as project environment variables;
- expose `GET /api/health` returning 200;
- run migrations separately before production traffic switches.

The committed config names the framework as `express`; do not mislabel it as NestJS or Hono or replace its entrypoint with the unbundled `dist/` directory.

### 8.2 Verify the Compute configuration and CLI

Prisma 8 provides a unified CLI (`prisma`, also distributed as `@prisma/cli@latest`) containing both ORM and Platform/Compute commands. Do not use legacy pre-release `app ...` subcommands:

```bash
npx prisma --help
npx prisma project --help
npx prisma service --help
```

The application already reads `process.env.PORT` and binds `0.0.0.0`. Locally, run the framework server normally after building:

```bash
npm run build
npm start
curl -i http://localhost:3001/api/health
```

Do not deploy until Prisma 7 generation/validation, Prisma 8 contract emission, TypeScript, health, auth, database, and storage tests pass.

### 8.3 Link project and connect GitHub (Deploy-on-Push)

Prisma Compute natively deploys via GitHub Deploy-on-Push driven by `prisma.compute.json`:

```bash
# 1. Authenticate and select your target workspace:
npx prisma auth login
npx prisma auth whoami --json
npx prisma auth workspace list --json
# (If your project is in a team/organization workspace, switch to it):
# npx prisma auth workspace use <workspace-id-or-name>

# 2. Link this directory to your Prisma project:
npx prisma project list
npx prisma project link <project-id-or-name>
npx prisma project show --json

# 3. Connect the GitHub repository for automatic deployment:
npx prisma git connect https://github.com/VolunteerOps/backend.git
```

The default Git branch (`main`) deploys to production; other branches create isolated previews. Configure preview database and bucket credentials before pushing a preview branch.

For CI, use workspace-scoped `PRISMA_SERVICE_TOKEN` and explicit workspace/project targets. Never print the token. Prefer `--json --no-interactive` and branch on stable error codes.

### 8.4 Deploy and verify

Run database migrations first from a protected CI job or terminal using `DIRECT_URL`:

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run build
```

Then trigger deployment:
1. **GitHub Deploy-on-Push (Standard):** Push to `main` (or preview branch). Prisma Compute detects `prisma.compute.json`, bundles the service, and deploys it automatically.
2. **Inspect Services & Deployments:**
```bash
# Inspect services and versions in the project:
npx prisma service list
npx prisma service show
npx prisma service logs

# Inspect and manage versions:
npx prisma service version list
npx prisma service version promote <version>
```

Verify the exact public URL returned by the deployment:

```bash
curl -i "https://<compute-url>/api/health"
curl -i "https://<compute-url>/api"
```

For GitHub-connected Console deployments, the default branch is the production path and other branches create previews. Prisma Console may open a compatibility PR; merge that PR, then push this repository update and inspect the **Prisma Compute Deploy** check/build logs. Compute deployment itself does not run database migrations or seed data.

Update volunteer/admin API base URLs and `CORS_ORIGIN` only after this URL is stable. Add a custom domain in Prisma Console if required, then use that durable domain in client builds.

Official references:

- [Prisma Compute deployment](https://www.prisma.io/docs/prisma-compute/deploy)
- [Prisma 7 to Prisma 8 PostgreSQL migration](https://www.prisma.io/docs/guides/upgrade-prisma-orm/postgresql)
- [Prisma Postgres connections](https://www.prisma.io/docs/postgres/database/connecting-to-your-database)

## 9. Prisma 8 incremental migration status

Prisma 8 is a TypeScript-native ORM rewrite, not a drop-in replacement for the generated Prisma Client API. This codebase has nested includes, aggregates, groupings, transactions, raw-query helpers, Accelerate cache options, and computed extensions. The official side-by-side migration preserves those behaviors while routes move deliberately.

Current verified package/runtime boundary:

```bash
npm view prisma version engines --json
npm view @prisma/orm-postgres version engines --json
node --version
npx prisma --version
npx prisma7 --version
```

Completed in this repository:

1. Prisma 7 moved to `@prisma/prisma7`, the `prisma7` binary, and `prisma7.config.ts`.
2. Prisma 8 and `@prisma/orm-postgres` are installed under their canonical package names.
3. `prisma.config.ts` contains the Prisma 8 PostgreSQL configuration.
4. `prisma8/contract.prisma` was inferred from the live database, `_prisma_migrations` was removed, storage names were retained, and contract emission passes.
5. Node/TypeScript/Docker requirements were raised for Prisma 8.
6. Existing routes still use Prisma 7 + Accelerate, so this deployment changes no API behavior.
7. The live schema was aligned without deleting application rows, a Prisma 8 baseline was created under `migrations/app/`, the database was signed at the graph tip, and the `db` ref was set.
8. Prisma 7 migration commands were retired; `npm run prisma:deploy` now applies checked-in Prisma 8 migrations and advances the `db` ref.

Remaining incremental application migration (do this route-by-route after the Compute deployment is healthy):

1. Instantiate the Prisma 8 PostgreSQL runtime beside `prisma` in `src/core/prisma.ts`.
2. Migrate one low-risk read route and compare its result with the Prisma 7 implementation.
3. Move all reads, writes, aggregates, transactions, error translation, Decimal serialization, and tests.
4. Remove `@prisma/client`, `@prisma/prisma7`, `@prisma/extension-accelerate`, the old schema/config, and compatibility scripts only when no imports remain.

Do not run `prisma contract infer` casually after deployment: inference replaces the contract from live storage. Review the diff, remove any inferred `_prisma_migrations` model, restore required mappings/defaults, and run `npm run prisma8:emit` before committing.

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
- [ ] Prisma 8 is the repository's canonical `prisma` package and `npm run prisma8:emit` passes.
- [ ] Prisma 7.10 compatibility-client generation/validation, build, and Accelerate smoke tests pass.
- [ ] Production and preview databases are isolated.
- [ ] Production and preview Object Store buckets/keys are isolated.
- [ ] No database, platform, JWT, or S3 secret exists in either KMP app or Git.
- [ ] The bundled Express artifact has been built and verified at a candidate/preview Compute URL.
- [ ] Migrations run in a protected job before production service promotion.
- [ ] `/api/health` returns 200 from the public Compute URL.
- [ ] Volunteer and admin apps use the stable Compute/custom-domain API base URL.
- [ ] Upload/download authorization tests pass.
- [ ] Demo seed credentials have not been deployed, or every seeded password has been rotated.
- [ ] Rollback and restore procedures have been rehearsed.
