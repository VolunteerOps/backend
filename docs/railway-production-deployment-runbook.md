# ResQ: Railway production deployment runbook

Updated **1 October 2026**. Target: a Railway project named **ResQ / Volunteer Ops**, with isolated **staging** and **production** environments. The Railway workspace has not been selected or provisioned by this document. This is the infrastructure companion to the [seven-stage implementation roadmap](resq-production-implementation-roadmap.md), not evidence that the unfinished features are deployed.

Follow Stage 1 to establish staging and Stage 7 to launch production. Complete the intervening product/security gates before enabling those capabilities for users. This is not a script to execute from top to bottom: Stage 1 operators stop at staging acceptance; production domain, live billing, write-freeze and cutover commands belong to Stage 7 after the release go/no-go record. Prisma remains the application's data tooling; Prisma Console/Compute and Render are not deployment targets.

## 1. Release contract and responsibilities

A release is complete only when its reviewed commit, schema, infrastructure, provider credentials, mobile builds and browser applications pass the roadmap's acceptance criteria together. A Railway deployment marked successful proves a container started; it does not prove tenant isolation, subscription enforcement, usable warnings, data freshness or recoverability.

At this checkpoint:

- `Dockerfile` builds the Express API and Sentinel browser portal. Start command: `node dist/index.js`; it binds `0.0.0.0` and `PORT`.
- The identity, device, source and forecast worker entrypoints exist. Retention is a bounded, exit-on-completion command. All use PostgreSQL durable jobs; a separate Redis service is not required by current code.
- PostgreSQL **18**, PostGIS, verified database TLS, and a restricted non-owner runtime SQL identity are enforced by readiness code.
- Prisma 8 migration tooling is absent from the production runtime image. A migration job image and Railway-specific deployment configuration must be implemented in Stage 1.
- The frontend repositories are different applications: `admin` and `volunteer` contain Kotlin/Compose web builds; `web` is Next.js. Their preview bundles are not substitutes for authenticated portals.
- RevenueCat server reconciliation, full scoped operational APIs, warning delivery, sensing/relay, mobilization and model validation remain implementation work. Google WeatherNext dataset approval is still an external dependency.

**Required Stage 1 additions before using this runbook end to end:** a reviewed PostgreSQL/PostGIS TLS image; a migration image; backend Google-credential materialization or workload-identity configuration; Railway configuration per service; platform-neutral Kotlin web build scripts and static serving images; proxy/rate-limit hardening; release diagnostics and worker monitoring. Proposed file names below are implementation targets, not files claimed to exist.

Record accountable owners for database maintenance, on-call response, billing, Firebase, DNS, Google weather access, app-store releases and backups. Railway's database templates are documented as **unmanaged**: the team owns patching, extension compatibility, backup configuration and recovery. [Railway PostgreSQL](https://docs.railway.com/databases/postgresql)

## 2. Service topology

```mermaid
flowchart LR
  Users[Mobile and browser clients] --> API[resq-api]
  Users --> Admin[resq-admin]
  Users --> Volunteer[resq-volunteer]
  Users --> Web[resq-web]
  API --> DB[resq-postgres: PostgreSQL 18 + PostGIS]
  API --> Objects[Private S3 bucket]
  Users -->|Short-lived signed HTTPS requests| Objects
  Workers[Identity / device / source workers] --> DB
  Forecast[Forecast and impact workers] --> DB
  Forecast --> Google[Approved WeatherNext / other feeds]
  Retention[Retention cron] --> DB
  API --> Firebase[Firebase / Identity Platform]
  API --> Billing[RevenueCat: after Stage 4]
  API --> AI[Evidence and approved-action agent]
  Urgent[Warning / dispatch workers: Stage 6] --> DB
  Urgent --> Delivery[FCM and approved delivery providers]
```

Use one measured region for API, database and workers initially; compare Kenya latency from available Railway regions before choosing. Choose the corresponding bucket region when available. The region names in the dashboard are authoritative. Do not assume the previous hosting provider's Frankfurt region exists on Railway.

| Service/resource | Source and command | Networking / persistence | Readiness and release gate |
| --- | --- | --- | --- |
| `resq-postgres` | Reviewed custom PostgreSQL 18 + PostGIS image | Private port 5432; volume `/var/lib/postgresql` for the proposed PG18 image | SQL/TLS/extension/role probes; backup restore |
| `resq-migrate` | Proposed `deploy/railway/Dockerfile.migrate` | Private DB access; no public domain, no volume | Runs migration/verify once and exits; never runtime credentials |
| `resq-api` | Existing backend `Dockerfile`; `node dist/index.js` | Public HTTPS, `PORT=3001`; no persistent volume | `/api/ready`, plus release acceptance |
| `resq-identity` | Backend image; `node scripts/start-with-google-credentials.mjs dist/workers/identity.worker.js` | Private; no public domain | Queue age, completion, revocation probe |
| `resq-invitation-email` | Backend image; `node dist/workers/invitation-email.worker.js` | Private; no public domain | Queue age, provider acceptance, controlled-inbox delivery |
| `resq-devices` | Backend image; `node dist/workers/device.worker.js` | Private; no public domain | Consent/revocation receipt tests |
| `resq-sources` | Backend image; `node dist/workers/sources.worker.js` | Private; provider outbound access | Source freshness and successful revisions |
| `resq-forecast` | Backend image; `node dist/workers/forecast.worker.js` | Private; approved Google identity | Start only after provider access and model/ingestion gates |
| `resq-retention` | Backend image; `node dist/workers/retention.worker.js` | Railway cron `*/5 * * * *` UTC; private DB | Successful bounded exit, deletion/scrubbing evidence |
| `resq-admin` | Proposed Kotlin web static-serving Dockerfile in `admin` | Public HTTPS; no persistent volume | Root, deep links, authentication, paid features |
| `resq-volunteer` | Proposed Kotlin web static-serving Dockerfile in `volunteer` | Public HTTPS; no persistent volume | Independent signup, invitations, subscriptions, operations |
| `resq-web` | Next.js production image in `web` | Public HTTPS; `PORT` consumed by start command | Pricing, signup links, contact, downloads and maps |
| `resq-private-files` | Railway native bucket, after compatibility tests | Private objects; public HTTPS S3 endpoint for signed requests | Section 7 upload/download contract |
| Later warning/dispatch/billing/scanning jobs | New bounded or continuous entrypoints from roadmap | Separate privileges and resource limits | Do not configure commands before implementing them |

Keep urgent event processors continuously available. Disable service sleeping for API, urgent workers and source ingestion. Railway cron runs no more frequently than every five minutes, can drift, and skips an invocation if the previous one is still active. It is suitable for cleanup, not the one-second observation or two-second warning objectives. [Railway cron](https://docs.railway.com/cron-jobs)

Start with one replica per implemented worker. Do not use a shell command containing four backgrounded processes as a substitute for supervised workers. A later consolidated runner needs independent queue fairness, shutdown, concurrency, health and failure isolation tests. Railway charges for resources and usage; establish measured limits rather than promising a fixed monthly total. [Pricing and cost control](https://docs.railway.com/pricing/cost-control)

## 3. Workstation, project and release inventory

Commands in this document are **operator instructions**. No login, provisioning, deployment or DNS mutation was performed while writing it. CLI examples were checked against installed Railway **5.62.1** help; recheck `--help` after upgrades. Some commands use linked context because their CLI has no `--project` option.

```powershell
Set-Location 'D:\ProjectDev\IdeaProjects\VolunteerOPS\backend'
railway --version
# If unavailable on another workstation: npm install --global @railway/cli
railway login
railway whoami --json
railway project list --json
```

Select the intended workspace explicitly. If a matching project already exists, use its ID. Only when creating the new target:

```powershell
railway init --name 'ResQ / Volunteer Ops' --workspace 'ACTUAL_WORKSPACE_ID' --json
```

Record IDs, then link and verify before any command lacking explicit scope:

```powershell
$RailwayProject = 'ACTUAL_PROJECT_ID'
$RailwayEnvironment = 'staging'
railway link --project $RailwayProject
railway environment list --json
# If staging is absent, create it before selecting it:
# railway environment new staging
railway link --project $RailwayProject --environment $RailwayEnvironment
railway status --json
railway service list --json
# Do not duplicate live credentials into previews.
```

1. Inventory all four repositories, uncommitted changes, provider accounts, existing database and objects. Record exact reviewed commit SHAs and image digests. Disable automatic production releases during cutover.
2. Preserve the current `.env` and provider configurations privately. Do not print credentials with `railway variable list` or bucket-credential commands into shared logs.
3. Create `.sentinel-deploy/railway/` as an ignored private operator directory and verify `git check-ignore` recognizes a file inside it. Restrict its Windows ACL to the operator and required backup account. Keep copies outside the repository as well.
4. Use separate files for `source.env`, `migration.env`, `api.env` and each worker. The source configuration remains intact until the rollback window closes.
5. Keep production variables out of PR builds. Use separate Firebase projects, RevenueCat sandbox data, test buckets and service credentials in staging.
6. Pin build tools and dependencies. Record software bill of materials and dependency/security review results. Do not promote a different rebuild from the version tested in staging.

## 4. Build PostgreSQL 18/PostGIS with verified TLS

The default Railway PostgreSQL template is convenient but does not establish this application's extension/certificate requirements automatically. Use an audited custom image based on the official `postgis/postgis:18-3.6` release, pinned to a reviewed digest. That image's PG18 volume mount is **`/var/lib/postgresql`**, not the older `/var/lib/postgresql/data`. A changing major tag must never be pointed at an old major-version data directory. [Official PostGIS image](https://github.com/postgis/docker-postgis)

### 4.1 Implement the database image

Create and review `deploy/railway/postgres/Dockerfile` and a start wrapper in Stage 1:

1. Extend the reviewed PostGIS image. Install only required certificate/backup tooling, using pinned versions where practical. Run image and extension tests in CI.
2. Retain the upstream initialization behavior. Set `POSTGRES_DB=volunteerops`, use an operator-only bootstrap superuser, and store its password as a sealed Railway variable. This superuser is not `sentinel_migrator` or an application user.
3. Mount the volume at `/var/lib/postgresql`; verify the image's actual `PGDATA` (typically `/var/lib/postgresql/18/docker`) lies underneath it. Prove a restart preserves a test row.
4. The wrapper must decode `RESQ_DB_TLS_CERT_B64` and `RESQ_DB_TLS_KEY_B64` into a private runtime directory, write the key with mode `0600`, give ownership to the image's `postgres` UID, and invoke the upstream entrypoint. Create the directory itself with that owner and mode `0700` (for example, `install -d -m 0700 -o postgres -g postgres /run/resq-postgres-tls` from the root bootstrap wrapper). Every parent directory must permit traversal by `postgres`; a root-owned `0700` directory makes even a correctly owned key unreadable. Resolve the image's real UID/GID rather than assuming 1000. Retain root only for initialization/ownership setup and let the upstream entrypoint drop privileges. Never put private keys in a Docker layer or print decoded values.
5. Start PostgreSQL with `ssl=on`, the generated certificate/key paths, `listen_addresses=*`, and the reviewed `pg_hba.conf`. Keep local operator authentication restricted; permit network clients only through `hostssl ... scram-sha-256` rules and reject `hostnossl`. Ensure initialization still works with this configuration.
6. Add graceful termination, `pg_isready`, certificate-expiry monitoring, restore support, and a documented minor-update procedure. `pg_isready` alone is not a TLS or privilege test.

These `RESQ_DB_TLS_*` variables are a **proposed wrapper interface**, not variables consumed by the upstream image. Implement the wrapper before configuring them. PostgreSQL documents the server certificate and key requirements. [PostgreSQL TLS](https://www.postgresql.org/docs/18/ssl-tcp.html)

### 4.2 Create a private CA and a hostname-valid server certificate

A private CA with a hostname-valid leaf certificate works with the backend's existing `DATABASE_TLS_CA` setting. Keep the CA private key offline. Create separate staging and production trust roots. Use your certificate service if already available; the following OpenSSL operator example shows the required contents:

```bash
# Run in a private operator directory with restrictive permissions.
# Replace the hostname with the actual Railway private hostname before issuance.
umask 077
if [ -e resq-db-ca.key ] || [ -e server.key ] || [ -e server.crt ]; then
  echo 'Use a new private directory; preserve existing certificate material.' >&2
  exit 1
fi
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out resq-db-ca.key
openssl req -x509 -new -sha256 -days 365 -key resq-db-ca.key -out resq-db-ca.crt \
  -subj '/CN=ResQ production database CA' \
  -addext 'basicConstraints=critical,CA:TRUE' \
  -addext 'keyUsage=critical,keyCertSign,cRLSign'
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out server.key
openssl req -new -key server.key -out server.csr -subj '/CN=resq-postgres.railway.internal'
cat > server.ext <<'EOF'
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:resq-postgres.railway.internal,DNS:localhost
EOF
openssl x509 -req -in server.csr -CA resq-db-ca.crt -CAkey resq-db-ca.key \
  -CAcreateserial -days 90 -sha256 -extfile server.ext -out server.crt
openssl verify -CAfile resq-db-ca.crt server.crt
```

Use the actual private hostname, not a guessed name; the `localhost` SAN supports an operator's authenticated SSH tunnel. If using a public database endpoint, issue a certificate covering that exact hostname too. Put only the leaf key/certificate on the database; put only the CA certificate on clients. Schedule rotation well before expiry and test overlapping trust before replacing the CA.

Railway private networking uses encrypted WireGuard tunnels, but that does not make `pg_stat_ssl.ssl` true or provide PostgreSQL certificate verification. Keep both private networking and verified database TLS. Do not change production to `sslmode=disable`, `require`, `rejectUnauthorized=false`, or `NODE_TLS_REJECT_UNAUTHORIZED=0`. [Railway private networking](https://docs.railway.com/networking/private-networking)

### 4.3 Provision and inspect

In Railway staging, create an empty `resq-postgres` service, set the reviewed image/source, mount the volume, configure the sealed secrets and start wrapper, and keep public networking disabled. Settings must exist before initializing the volume. Repeat independently for production after staging acceptance.

Use a controlled operator tunnel when needed:

```powershell
railway connect resq-postgres --project $RailwayProject --environment $RailwayEnvironment --tunnel-only --port 15432
```

Keep that terminal private and running. In a second terminal use PostgreSQL 18 clients, with `PGHOST=localhost`, `PGPORT=15432`, `PGSSLMODE=verify-full`, `PGSSLROOTCERT` pointing to the CA file, and a password prompt/password file. `railway run` runs a command locally; it does not move the process into Railway's private network.

```sql
SHOW server_version;
SHOW data_directory;
SHOW ssl;
SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid();
SELECT name, default_version, installed_version
FROM pg_available_extensions WHERE name = 'postgis';
```

As the operator, enable PostGIS if not initialized by the image:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_Full_Version();
```

Require PG18, installed PostGIS, active verified TLS, correct volume-backed data directory and persistence across restart before migration. Do not treat a marketplace label as proof of engine version, TLS trust, backups or HA.

## 5. Schema, restricted roles and migration execution

### 5.1 Separate ownership from runtime access

Use the bootstrap operator to create a non-superuser schema owner and runtime logins. Grant the owner control of application schemas/tables, not cluster administration. Create roles only when absent; investigate an existing role rather than resetting it.

```sql
CREATE ROLE sentinel_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE volunteerops TO sentinel_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO sentinel_migrator;
\password sentinel_migrator
CREATE ROLE sentinel_api LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE sentinel_identity LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE sentinel_devices LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE sentinel_sources LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE sentinel_retention LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE volunteerops TO sentinel_api, sentinel_identity, sentinel_devices, sentinel_sources, sentinel_retention;
\password sentinel_api
\password sentinel_identity
\password sentinel_devices
\password sentinel_sources
\password sentinel_retention
```

Create `sentinel_forecast` with the same restrictive attributes when enabling forecasting. Use independent passwords. Keep grants current with later billing, operational, warning and scanning migrations. Runtime users must never inherit the migration owner or bootstrap administrator, own application tables, or bypass RLS.

### 5.2 Migrate from a controlled runner

The existing package scripts are:

```powershell
npm ci
npm run prisma8:check
npm run prisma8:migrate
npm run prisma8:verify
npm run prisma8:status
```

Migration commands use **`DIRECT_URL`** from `prisma.config.ts`. Set it only on the migration runner to a direct, verified-TLS owner connection. Prisma 8 owns the migration graph; Prisma 7 generates the compatibility client. Do not substitute `prisma7 migrate`, `db push`, demo seeding, migration-history signing or a reset.

Implement `deploy/railway/Dockerfile.migrate` with the committed lockfile, full development dependencies, Prisma configuration, `prisma8/`, `migrations/app/`, and required certificate bootstrap. Its entrypoint must run `prisma8:check`, `prisma8:migrate`, `prisma8:verify`, and exit nonzero at the first failure. Serialize migrations across all releases. Capture migration head and exact image/commit without logging URLs. Use bounded database lock/statement timeouts with an explicit procedure for reviewed longer migrations.

Give the migrator its CA file through the runtime wrapper and `NODE_EXTRA_CA_CERTS`; prove the migration library rejects an incorrect CA and incorrect hostname. `DATABASE_TLS_CA` configures the application's `pg` pools, not automatically the Prisma migration CLI. Do not assume passing application readiness proves the migrator connection validates TLS.

Run the migration service manually once, with no cron or public domain and a non-restarting success policy. Alternatively, use the controlled workstation through the TLS-verified tunnel:

```powershell
$env:NODE_EXTRA_CA_CERTS = 'ABSOLUTE_PRIVATE_PATH_TO_DB_CA_PEM'
# migration.env contains only target DIRECT_URL with sslmode=verify-full.
# Remove stale inherited URL values because process variables override --env-file.
Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
node --env-file=.sentinel-deploy/railway/migration.env --run prisma8:check
if ($LASTEXITCODE -ne 0) { throw 'Migration validation failed' }
node --env-file=.sentinel-deploy/railway/migration.env --run prisma8:migrate
if ($LASTEXITCODE -ne 0) { throw 'Migration failed' }
node --env-file=.sentinel-deploy/railway/migration.env --run prisma8:verify
if ($LASTEXITCODE -ne 0) { throw 'Schema verification failed' }
```

Railway pre-deploy commands run in a separate container with service variables and private-network access; they do not mount volumes or preserve filesystem changes. Do not put the owner URL on the API just to run a pre-deploy command. Keep migrations in the privileged one-shot service/CI step and make successful verification a prerequisite to releasing API/workers. The current runtime image cannot run these scripts. [Railway pre-deploy commands](https://docs.railway.com/deployments/pre-deploy-command)

### 5.3 Apply explicit grants and prove RLS

Stage 1 should relocate the existing provider-named runtime/retention grant SQL to platform-neutral `deploy/database/runtime-role.sql` and `deploy/database/retention-role.sql`, and update release references. These proposed paths must exist before running:

```powershell
# Run using the bootstrap operator's controlled psql connection.
psql -X -W -v ON_ERROR_STOP=1 -f deploy/database/runtime-role.sql
if ($LASTEXITCODE -ne 0) { throw 'Runtime grant setup failed' }
psql -X -W -v ON_ERROR_STOP=1 -f deploy/database/retention-role.sql
if ($LASTEXITCODE -ne 0) { throw 'Retention grant setup failed' }
```

The current grant SQL creates NOLOGIN permission groups; role creation requires the bootstrap operator because the proposed migration owner deliberately has no CREATEROLE. After grants, as the operator:

```sql
GRANT sentinel_runtime_access TO sentinel_api, sentinel_identity, sentinel_devices, sentinel_sources;
GRANT sentinel_retention_access TO sentinel_retention;
```

Run application readiness with the API login, not the owner:

```powershell
node --env-file=.sentinel-deploy/railway/api.env --run db:readiness
if ($LASTEXITCODE -ne 0) { throw 'Runtime readiness failed' }
```

Current roles share broad runtime table grants across several worker types. Stage 1 should narrow queue-specific privileges where feasible. Preserve retention's restricted column/row access. Test two independent organizations, revoked membership, unscoped SQL, storage ownership, invitations and suspended accounts using real runtime credentials. Every new migration requires matching grant and RLS review.

## 6. Preserve and migrate existing data

Historical local evidence recorded 2,004 application rows across 16 tables, matched by fingerprints after a PG18/PostGIS restore. That is a previous checkpoint, not today's inventory. Private backups and manifests under `.sentinel-deploy/` must be preserved. Re-inventory source tables, identities, memberships, subscriptions, files and pending jobs before deciding the actual cutover procedure.

1. Restore a fresh consistent source dump into an isolated rehearsal environment. Use PostgreSQL 18 client tools; protect dumps as sensitive production data. Save globals/role information separately for review rather than blindly restoring source superuser grants.
2. Apply the target migration graph on an empty target. If source history differs, write and test an explicit dependency-ordered data import/backfill. Never import the old migration ledger over the new one to silence drift.
3. Preserve primary keys, Firebase UID bindings, timestamps, object keys, checksums and referential relationships. Resolve global legacy rows into reviewed organization/region ownership; quarantine ambiguous rows instead of assigning an arbitrary tenant.
4. Reconcile counts, per-table fingerprints, foreign keys, sequences and privilege policies. Document intentional transformations and rejected records.
5. Copy actual objects into the new bucket, verify sizes/checksums, and reconcile metadata against bytes. An empty historical bucket is not proof that the source is still empty. Do not reuse stale signed URLs.
6. Rehearse durable job cutover. Prevent both providers from processing the same queue concurrently; retain unfinished work, leases and idempotency keys. Do not replay historical warning/payment/dispatch effects blindly.
7. Before production cutover, freeze source writes, callbacks and producers using a coordinated maintenance window; take the final dump/object delta; repeat verified import and reconciliation.
8. Release target consumers only after reconciliation. Keep the source and encrypted backup available, read-only, through the rollback window.

A populated-source import must use the reviewed transform/manifest, not an unrestricted `pg_restore` over an already migrated schema. Implement and test this repeatable command in Stage 1; it must abort on unexpected source versions or unmatched rows. Changing `.env` alone does not migrate data.

## 7. Object storage and browser upload contract

### 7.1 Provision a native Railway bucket

Use one private bucket per environment and a separate archive/backup bucket with separate credentials. Native Railway buckets support signed HTTPS access and are isolated by environment. New buckets normally use virtual-hosted URLs; legacy buckets may require path style. Read the actual Credentials tab, and use its globally unique `BUCKET` value, not its display name. [Railway storage buckets](https://docs.railway.com/storage-buckets)

```powershell
railway status --json
railway bucket list --environment $RailwayEnvironment --json
# Run only when this bucket does not exist; pick the tested region.
railway bucket create resq-private-files --region ams --environment $RailwayEnvironment --json
railway bucket info --bucket resq-private-files --environment $RailwayEnvironment --json
```

Obtain credentials in a private terminal or the dashboard; credential output contains secrets. Map bucket references into **API service** variables:

| Backend variable | Railway reference/value |
| --- | --- |
| `S3_ENDPOINT` | `${{resq-private-files.ENDPOINT}}` |
| `S3_BUCKET` | `${{resq-private-files.BUCKET}}` |
| `S3_ACCESS_KEY_ID` | `${{resq-private-files.ACCESS_KEY_ID}}` |
| `S3_SECRET_ACCESS_KEY` | `${{resq-private-files.SECRET_ACCESS_KEY}}` |
| `S3_REGION` | `${{resq-private-files.REGION}}` |
| `S3_FORCE_PATH_STYLE` | `false` for confirmed virtual-hosted style; otherwise the confirmed credential setting |

These references require the exact resource name used in your project. The API creates database metadata and signs object requests. PostgreSQL does not connect directly to the upload bucket. Worker archive access, where required, uses a different credential and purpose.

Signed URLs must use a publicly resolvable **HTTPS** endpoint because browsers and phones upload directly. A bucket being private means its objects require authorization; it does not mean clients can use a `railway.internal` hostname. Never distribute S3 keys or database URLs to clients.

### 7.2 Configure and test CORS

Railway documents bucket CORS configuration using `aws s3api put-bucket-cors`. Prepare `cors.json` with the final origins, and use a private AWS CLI profile/environment containing only the bucket credentials:

```json
{
  "CORSRules": [{
    "AllowedOrigins": [
      "https://www.admin.resq-app.co.ke",
      "https://app.resq-app.co.ke",
      "https://api.resq-app.co.ke"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["content-type", "if-none-match", "if-match", "x-amz-*"],
    "ExposeHeaders": ["ETag", "x-amz-checksum-sha256", "x-amz-version-id"],
    "MaxAgeSeconds": 300
  }]
}
```

```powershell
aws s3api put-bucket-cors --bucket ACTUAL_S3_BUCKET_NAME --endpoint-url ACTUAL_HTTPS_ENDPOINT --cors-configuration file://cors.json
aws s3api get-bucket-cors --bucket ACTUAL_S3_BUCKET_NAME --endpoint-url ACTUAL_HTTPS_ENDPOINT
```

Add the landing origin only if it performs authenticated uploads. Browser preflight must allow the exact signed headers returned by the API; adjust explicit rules to measured client requests. Do not send Firebase bearer tokens to the S3 endpoint. [Railway upload/CORS instructions](https://docs.railway.com/storage-buckets/uploading-serving)

### 7.3 Storage release gate

Using disposable staging objects, test the existing `/api/organizations/:orgId/regions/:regionId/storage` workflow:

1. An authenticated, authorized uploader obtains an upload intent with expected MIME, length and SHA-256.
2. A direct browser PUT accepts the exact signed headers/body. Wrong checksum/type/length, expired signatures and altered keys fail.
3. A second PUT to the same key with `If-None-Match: *` fails without changing bytes. Concurrent attempts do not overwrite the winner.
4. Completion verifies object metadata/checksum. The current adapter can hash a bounded GET if HEAD does not return a checksum; retain its size limits.
5. A signed download honors `If-Match`, download disposition and cache controls. Unauthenticated raw URLs cannot retrieve the object.
6. Other tenants/users cannot complete/download it; access revoked between intent and completion is denied.
7. CORS succeeds from intended browser origins and fails from an unlisted origin. Mobile signing works separately.
8. Scan/quarantine/type-sniffing, explicit mission/report sharing, deletion, legal holds and orphan reconciliation from the roadmap pass before those product flows launch.

Do not assume generic S3 compatibility proves conditional-write and checksum semantics. Native bucket documentation currently lists versioning, object lock, lifecycle configuration and server-side-encryption API features as unsupported; confirm encryption-at-rest requirements separately rather than inferring storage internals. Application retention and independent backups must cover missing controls. If mandatory controls or this contract fail, use the fallback below or a separately approved S3 provider; do not remove integrity checks.

### 7.4 Railway-hosted fallback object service

The existing `deploy/object-store/Dockerfile` contains a SeaweedFS S3 service and a gateway. This is an alternative that keeps compute/storage on Railway, not a managed bucket:

1. Create `resq-object-store` from that Dockerfile and attach a dedicated volume at `/data` before first use.
2. Set `S3_ROOT_ACCESS_KEY_ID`, `S3_ROOT_SECRET_ACCESS_KEY`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` with independent root/runtime values. Only the bucket-scoped pair goes to API. Configure `S3_BUCKET`, `S3_REGION`, `S3_CORS_ORIGINS` and `PORT=10000` according to `deploy/object-store/gateway.mjs`. Set the storage service's own `S3_ENDPOINT` to its exact public HTTPS origin because the gateway checks the Host header.
3. Expose only the gateway HTTPS domain, for example `files.resq-app.co.ke`. Never expose master/filer/admin ports. Set Railway HTTP readiness to `/_resq/ready`.
4. Use the public gateway URL as the API's `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE=true`. The current SeaweedFS mini bootstrap prepares the configured private bucket; do not introduce an extra manual bucket-creation dependency. Verify readiness after initialization and keep root credentials out of ordinary API tooling.
5. Run `npm run test:object-store`, Linux image tests, the same browser contract above, volume restart/redeploy tests, snapshot/logical object backup and complete restore.
6. Treat this as a stateful service: choose capacity from measurements, avoid unsupported replica sharing of a single volume, and plan deployment downtime. No API container filesystem is an object store.

The fallback's existing local tests are useful evidence, not Railway production certification. From a private operator terminal, the existing `node --env-file=.sentinel-deploy/railway/storage.env deploy/object-store/smoke.mjs --confirm-write` tests a unique disposable probe prefix, including corruption, overwrite, authentication and download behavior. It writes/deletes probe objects; use staging first.

## 8. Service variables, credentials and API deployment

### 8.1 Variable ownership

Keep secrets service-scoped. Shared variables are appropriate for public origins/environment labels; they are not a reason to give every service all credentials. Use Railway sealed variables for secrets when suitable; keep a private recovery copy. Secret changes must be followed by controlled redeployment and verification. Use the dashboard's raw editor or `railway variable set KEY --stdin` rather than putting a secret literal into shell history. [Railway variables](https://docs.railway.com/variables)

| Variables | Services | Configuration / validation |
| --- | --- | --- |
| `NODE_ENV=production` | API and workers, including staging containers | Staging is a deployment environment, not Node's development mode |
| `DATABASE_URL` | API and each worker | Its own restricted login; actual private hostname; `sslmode=verify-full` |
| `DATABASE_TLS_CA` | API and workers | Full CA PEM, with real newlines; not a filename |
| `DATABASE_POOL_MAX=3`, `DATABASE_CONNECT_TIMEOUT_MS=5000`, `DATABASE_IDLE_TIMEOUT_MS=30000`, `DATABASE_STATEMENT_TIMEOUT_MS=10000` | API/normal workers initially | Load-test; role/query exceptions require review |
| `DIRECT_URL` | Migrator/operator only | Schema-owner connection, never API/client |
| `NODE_EXTRA_CA_CERTS` | Migrator when using private CA | Path to the CA file created by its credential wrapper |
| `PORT=3001`, `COOKIE_SECURE=true`, `CORS_ORIGIN` | API | Exact HTTPS origin allowlist, no wildcard with credentials |
| `COOKIE_DOMAIN` | API only if deliberately needed | Prefer existing host-only cookie; do not automatically share it with every subdomain |
| `FIREBASE_PROJECT_ID`, `FIREBASE_ALLOW_AUTH_EMULATOR=false` | API/identity; others only where code requires | Real project; emulator host must be absent |
| `GOOGLE_APPLICATION_CREDENTIALS` | API/identity and forecast as applicable | Runtime file path; different least-privilege identities per purpose |
| `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_AUTH_DOMAIN`, `FIREBASE_WEB_APP_ID` | API public portal config | Public Firebase app settings only |
| `MAPBOX_ACCESS_TOKEN` | API portal and landing service | Public `pk.` token, restricted to final origins; no secret Mapbox token in frontend |
| `S3_*` | API; purpose-specific processors later | Section 7; root credentials stay operator-only |
| `SENTINEL_USGS_ENABLED=true` | Sources worker after feed tests | Disabled until that worker is ready |
| `WEATHERNEXT_ACCESS_ENABLED=false` | API initially | Change to true only with approved, tested hourly dataset access |
| `WEATHERNEXT_PROJECT_ID`, `WEATHERNEXT_DATASET_ID`, `WEATHERNEXT_LOCATION`, `WEATHERNEXT_MAX_BYTES_BILLED` | API and forecast worker after approval | Exact project/dataset/location and explicit query ceiling |
| `SENTINEL_GEMINI_API_KEY`, `SENTINEL_GEMINI_MODEL` | API evidence assistant | Verified available model, scoped answers and spend limits |
| `LOG_LEVEL=info` | API/workers | Redact auth headers, tokens, signed URLs, private locations and credentials |
| RevenueCat server key/webhook authentication secret | New Stage 4 billing module only | Add validated variable schema with implementation; no existing backend variable is claimed here |
| RevenueCat platform public SDK keys | Corresponding apps/browser integration | Separate sandbox/production and platform SDK keys |
| SMTP/email, delivery-provider and observability credentials | Implemented module's service only | Add validated schemas and failure handling before deployment |
| `RAILWAY_TOKEN` / `RAILWAY_API_TOKEN` | CI/operator only | Never application runtime, browser bundle or mobile app |

Railway references such as `${{resq-postgres.DATABASE_URL}}` often contain the template's privileged database identity. **Do not wire that connection to the API.** Create a restricted per-service URL from its own login and the verified private hostname. Secret rotation must rotate that role, not replace it with the bootstrap user.

### 8.2 Materialize Google credentials correctly

Current Firebase Admin uses Application Default Credentials. Railway does not automatically provide the old provider's secret-file path.

Implement `scripts/start-with-google-credentials.mjs` or an equivalent entrypoint in Stage 1:

1. Read a sealed base64 JSON variable with a documented, service-specific name; validate JSON without printing it.
2. Create a private runtime directory and mode-`0600` credential file owned by the unprivileged application user. Set `GOOGLE_APPLICATION_CREDENTIALS` to it before importing Firebase/BigQuery code.
3. Start the chosen API/worker process with signal forwarding and correct exit codes. Remove ephemeral secret files on graceful exit; never write them to persistent shared storage or Docker images.
4. Fail startup when required credentials are missing/malformed. Test accidental logging and path permissions.
5. Prefer a tested Google Workload Identity Federation setup over exported keys when a suitable workload identity is established. Do not claim Railway automatically supplies a compatible identity without verification.

Use a Firebase identity for session/revocation operations and a separate Google weather identity for BigQuery. A Google account email is not a cloud project ID. Do not give browser/mobile builds service-account JSON.

### 8.3 Deploy API to staging

Create missing empty services from the linked staging context; then configure them before assigning a source/deploying:

```powershell
railway status --json
railway add --service resq-api --json
# Do not repeat add if the service already exists.
railway environment edit --project $RailwayProject --environment $RailwayEnvironment --service-config resq-api build.builder DOCKERFILE
railway environment edit --project $RailwayProject --environment $RailwayEnvironment --service-config resq-api build.dockerfilePath Dockerfile
railway environment edit --project $RailwayProject --environment $RailwayEnvironment --service-config resq-api deploy.healthcheckPath /api/ready
```

Configure the start wrapper if required by Section 8.2, otherwise the existing start is `node dist/index.js`. Set Railway health-check timeout based on tested cold starts. Do not put an HTTP health check on a service without a reachable HTTP server.

Before public access, implement bounded trusted-proxy handling in Express and test forged `X-Forwarded-For`, real client IP rate limiting, secure cookies, CSRF, CORS and Railway health checks. Do not use unrestricted `trust proxy=true`. Add distributed limits before multiple API replicas; current in-memory rate limits are not a global quota.

After variables, migration and runtime-role probes succeed:

```powershell
railway up --project $RailwayProject --environment $RailwayEnvironment --service resq-api --detach --json -m 'Reviewed ResQ API release'
railway deployment list --project $RailwayProject --environment $RailwayEnvironment --service resq-api --json
railway logs --service resq-api --environment $RailwayEnvironment --lines 100 --json
```

Record the deployment ID returned by upload and observe **that exact deployment's** `SUCCESS` state. A successful upload or exit code is insufficient. Configure a temporary Railway domain for staging, then verify:

```powershell
$ApiOrigin = 'https://ACTUAL_STAGING_API_ORIGIN'
curl.exe --fail-with-body "$ApiOrigin/api/health"
curl.exe --fail-with-body "$ApiOrigin/api/ready"
curl.exe --fail-with-body "$ApiOrigin/sentinel/"
curl.exe --fail-with-body "$ApiOrigin/sentinel/config"
curl.exe --include "$ApiOrigin/api/auth/me"
```

The last request should return 401 without credentials. Public portal config must expose only public fields. Current `/api/ready` verifies database prerequisites; Stage 1/7 release diagnostics must also verify migration head, necessary workers, storage, identity and provider readiness without exposing secrets.

The current API Dockerfile intentionally excludes local `src/generated` from its build context. `npm run build` invokes the prebuild generators, TypeScript compiles their output into `dist/generated`, and the runtime copies `dist` plus installs production dependencies. Preserve that sequence; copying an old workstation-generated client or omitting prebuild can break the deployed API. The migration image additionally needs `migrations/app/`, which the current API Dockerfile does not copy. Test the fresh Linux image with production dependencies only, including the generated client import and native dependency loading.

Use immutable reviewed images/commits for subsequent workers, not unrelated latest builds. Prefer explicit GitHub repository/branch configuration for controlled releases; `railway up` uploads local content and can include uncommitted files. Verify `.dockerignore` and upload exclusions protect `.env`, private operator directories and backups.

## 9. Workers, scheduling and provider activation

1. Deploy identity with its own SQL login and Firebase credential. Trigger a real test-session revocation and verify the durable job completes and the revoked session stops working.
2. Deploy device processing with its own SQL login. Test accepted receipts, consent revocation and authorization changes between enqueue and execution.
3. Deploy source ingestion with `SENTINEL_USGS_ENABLED=true` only after staging verifies trusted-source parsing, retry limits, freshness and immutable revisions. Current USGS scheduling happens inside the continuous source worker; do not add a duplicate cron producer.
4. Deploy retention as a one-shot service. Run once and verify `RETENTION_COMPLETED`, then set `*/5 * * * *` UTC. Confirm the process closes DB connections and exits; add failure/last-success alarms. Current retention is not complete object/USGS/backup retention.
5. Create the forecast service only when the exact Google service account can query the approved WeatherNext 3 hourly data. Configure explicit query budgets and provider timeouts. Start with a small authorized region/time slice and verify job/revision lineage, units and expiry.
6. Implement automatic forecast scheduling with a dedicated service authorization policy, deterministic schedule keys and fairness in Stage 5. Do not schedule requests using a person's expiring privileged token. Google approval remains a gate; absent authoritative data must be labelled unavailable, not silently substituted.
7. Add forecast tiling/checkpoints, long-query resumption, model validation and additional feeds per the roadmap. The existing BigQuery implementation is not a GCS/Zarr loader.
8. Implement warning/dispatch/billing/scanning processors with separate queues and privilege scopes before adding their Railway services. Urgent warning work must not wait behind provider queries, large exports or AI requests.

Worker HTTP health is currently loopback-only at `127.0.0.1:3002/health`. Do not publish that port or invent a public endpoint. Until a reviewed private health endpoint exists, use process state plus durable heartbeat/last-success and queue-age monitoring. A worker repeatedly claiming an empty queue is not evidence of successful ingestion.

Current code with `DATABASE_POOL_MAX=3` can allocate roughly **23 database connections** across API, identity, devices, sources, forecast and retention because some workers create more than one pool. Recalculate after changes and account for deployment overlap, migrations, monitors and replicas. Reserve headroom under the actual DB connection limit. Do not introduce PgBouncer until transaction-local RLS context, advisory locks, prepared queries and migration compatibility are proven.

## 10. Deploy the three frontend repositories

### 10.1 Admin and volunteer web services

Do not replace the Kotlin/Compose applications with Next.js boilerplate. In each repository implement a platform-neutral build script and Dockerfile:

1. Pin JDK/Gradle/Node; use the repository's wrapper. Existing provider-named build scripts demonstrate the required `-PwebOnly=true` build; port their behavior into `scripts/build-web.sh` and retire provider assumptions.
2. Validate public configuration with `node scripts/configure-sentinel.mjs --check`.
3. Build `:webApp:jsBrowserDistribution -PwebOnly=true --no-daemon`, then run `scripts/configure-sentinel.mjs` and `scripts/verify-web-bundle.mjs`. Confirm the output path is `webApp/build/dist/js/productionExecutable` for the reviewed commit.
4. Copy only output into an unprivileged static-serving runtime (Nginx or equivalent), bind `0.0.0.0:$PORT`, and implement SPA fallback to `/index.html`. Return 404 for missing JS/assets rather than HTML. Set appropriate immutable asset caching and no-cache index/config.
5. Support fonts, WASM/JS MIME types and content-security policy required by the actual Kotlin/Mapbox build. Test reload on deep links and OAuth/invitation callbacks.
6. Set `OPERATIONS_API_URL` to `https://api.resq-app.co.ke` **without `/api`**, and `SENTINEL_PORTAL_URL` to `https://api.resq-app.co.ke/sentinel`. Rebuild or use the explicitly implemented runtime config path; a backend `.env` edit does not update existing browser bundles.
7. Supply the Stage 2 Firebase and Stage 4 RevenueCat **public** client configuration using validated app-specific settings. Do not assume current sample/local auth or subscription repositories are live integrations.
8. Deploy `admin` into `resq-admin` and `volunteer` into `resq-volunteer` from each respective repository. Use separate service sources/root directories and exact revisions. Sibling directories are not automatically available in Railway builds.
9. Run unauthenticated, standalone-volunteer, invited-volunteer, coordinator, free, Pro, expired/refunded and cross-tenant journeys at the deployed origin. Confirm paid APIs deny direct free-account calls even when the browser paywall is bypassed.

Neither service needs a database connection or S3 secret. User authorization happens through API calls. Keep maps real, keyboard-accessible and informative about stale/unavailable data.

### 10.2 Landing site

`web/package.json` identifies a Next.js application. Implement a Railway production build using `npm ci` and the appropriate reviewed Next build script. The current ordinary build invokes admin/volunteer preview preparation; replace sibling-repository assumptions with pinned published preview artifacts or remove previews after linking to real portals. Do not ship a demo login as a production portal.

Set `NEXT_PUBLIC_BACKEND_URL=https://api.resq-app.co.ke`. Keep `NEXT_PUBLIC_API_URL` unset if retaining the current same-origin `/api` rewrite. Its own `MAPBOX_ACCESS_TOKEN` supplies public map configuration. Audit the Next rewrite and public-variable handling before changing names; browser-visible variables must not point at private domains.

Use a reviewed Dockerfile or Railpack with pinned Node matching the repository. A production command equivalent to `next start --hostname 0.0.0.0 --port "$PORT"` must receive Railway's runtime port. Verify root, contact submission, privacy/terms, pricing/feature comparison, signup, real app downloads and links to the canonical authenticated portals. Do not advertise unavailable hazards, agent actions or billing tiers.

### 10.3 Native releases

Railway hosts APIs and web portals, not app-store installation. Build signed Android/iOS releases with matching Firebase project, approved redirect/deep links, Mapbox configuration, RevenueCat platform keys and production API origin. Store signing credentials in release CI. Verify app links/universal links, upgrade behavior, restore purchases, offline cache invalidation, permission prompts and notification delivery on real devices before publishing. Desktop support follows the roadmap's explicit billing/identity policy; do not leave an unavailable subscription controller behind a visible Pro gate.

## 11. Custom domains, cookies, invitations and DNS

Use these production origins unless the product owner approves different names:

| Purpose | Canonical hostname | Railway target |
| --- | --- | --- |
| Landing site | `resq-app.co.ke` | `resq-web` |
| Optional landing alias | `www.resq-app.co.ke` | Same service with canonical redirect |
| Requested admin portal | **`www.admin.resq-app.co.ke`** | `resq-admin` |
| Optional admin alias | `admin.resq-app.co.ke` | Redirect to requested canonical hostname |
| Volunteer browser app | `app.resq-app.co.ke` | `resq-volunteer` |
| API and current Sentinel portal | `api.resq-app.co.ke` | `resq-api`; portal path `/sentinel/` |
| Optional fallback object gateway | `files.resq-app.co.ke` | `resq-object-store`; not needed for native bucket |

1. Register the exact custom hostname on each service, specifying the correct target port. For example:

```powershell
railway domain www.admin.resq-app.co.ke --project $RailwayProject --environment production --service resq-admin --port 8080 --json
railway domain api.resq-app.co.ke --project $RailwayProject --environment production --service resq-api --port 3001 --json
```

`8080` is the proposed static image port; replace it with the port actually implemented. CLI output supplies the required CNAME and ownership TXT records. Use those exact values, not another service's generated domain. In the `resq-app.co.ke` DNS zone, the relative admin CNAME label is `www.admin`; do not accidentally create `www.admin.resq-app.co.ke.resq-app.co.ke`.

2. Add both the routing and ownership records. For the apex use a DNS provider's supported ALIAS/ANAME/CNAME-flattening mechanism. Preserve existing mail/MX/SPF/DKIM/DMARC records. Do not replace nameservers without migrating the entire zone.
3. `www.admin.resq-app.co.ke` is a nested subdomain. With Cloudflare, use **DNS only** initially so Railway can serve its exact-host certificate. A normal first-level wildcard/Universal SSL certificate does not automatically cover this hostname. Add an appropriate edge certificate before enabling a proxy on it.
4. Wait for Railway ownership verification and HTTPS issuance, then inspect the exact hostname's certificate. Check redirect loops and HTTP-to-HTTPS behavior. DNS resolution alone is insufficient.
5. Register final domains and email/action callback URLs with Firebase/Identity Platform, Google/enterprise OAuth providers and app-link settings. Invitation links must preserve a short-lived invitation token across signup and verification without logging it or granting membership before acceptance.
6. Update API CORS, bucket CORS, Mapbox token URL restrictions, RevenueCat/checkout return origins and portal public configuration. The landing pricing buttons must enter the correct app/account flow.
7. Keep API session cookies secure and host-scoped; browser requests include credentials where required. Same-site custom subdomains help embedded portal authentication, but cross-origin CSRF and origin checks still apply. Provide a full-page portal option and test embedded behavior in supported browsers.
8. Verify SPA deep links, reset-password links, join invitations, shared profile links, webhook callbacks and unsubscribe links over their final HTTPS origins. Use `noindex` for authenticated portals/private pages and staging.

Railway's domain instructions specify custom-domain ownership records, target ports and certificate behavior. [Working with domains](https://docs.railway.com/networking/domains/working-with-domains)

```powershell
railway domain status www.admin.resq-app.co.ke --project $RailwayProject --environment production --service resq-admin --json
Resolve-DnsName www.admin.resq-app.co.ke -Type CNAME
curl.exe --head https://www.admin.resq-app.co.ke
```

## 12. Billing and paid-feature activation

Complete Stage 4 before making a subscription purchasable:

1. Configure RevenueCat projects/apps, store products, offerings, entitlement identifiers and sandbox accounts. Record environment-specific product mappings rather than hardcoding marketing price strings as authorization.
2. Deploy the authenticated billing webhook endpoint and durable idempotent reconciliation worker implemented in Stage 4. Configure RevenueCat's documented webhook authorization mechanism and retry behavior; protect its secret separately from SDK public keys.
3. Verify purchases, pending payments, renewals, restore, cancellation-at-period-end, billing issues, expiry, refunds/revocations, transfers and duplicate/out-of-order events against server-side state.
4. Bind RevenueCat's app user identifier to the authenticated immutable backend identity. Do not accept an arbitrary client-submitted entitlement, email match, anonymous purchase alias or local `isPro=true` as authority.
5. Test the same entitlement checks on REST, streaming, forecast refresh, agent tools, exports and direct portal access. Role/organization/region permission remains required even for Pro users.
6. Publish paywall/pricing copy only for implemented entitlements. Distinguish an individual's Pro access from organization seats or sponsored access according to the reviewed product policy.
7. Ensure basic account access, invitation acceptance and mandatory safety/emergency behavior follow the roadmap's free-access policy. A billing outage must not become an authorization bypass or prevent the explicitly free safety flow.
8. Add webhook lag/reconciliation alerts, support refund/runbook procedures and audit logs. Run an end-to-end paid account journey across mobile and both relevant browser portals before enabling production offerings.

No backend RevenueCat variable names or webhook route are presented as implemented here; Stage 4 must define and test them before provider setup uses them.

## 13. Backups, recovery, security and operational monitoring

### 13.1 Database recovery

Enable daily and weekly Railway volume backup schedules in staging, prove restore, then enable production. Current documented retention is six days for daily snapshots, 27 days for weekly and 89 days for monthly. Record the actual selected retention and recovery objectives. A volume snapshot is not by itself a proven application-consistent database-plus-object recovery. [Volume backups](https://docs.railway.com/volumes/backups)

Railway now provides PostgreSQL PITR using an image with pgBackRest/WAL archival to a separate bucket. **A custom PostGIS image is not automatically compatible.** Verify supported image/entrypoint/archiver behavior before using the native enable operation; do not let a template conversion remove PostGIS or replace TLS settings. Choose one tested path:

- Extend an eligible Railway PostgreSQL archive-capable image with the exact required PG18 PostGIS packages, preserving archive entrypoint behavior and validating restore of spatial data; or
- Retain the reviewed PostGIS image and implement pgBackRest/WAL archiving, retention, encryption and restore procedures explicitly as part of Stage 1/7.

Do not claim a digest-pinned custom image follows the native PITR update mechanism. Railway's native PITR documentation has image/tag constraints; review them for the actual release. [PITR](https://docs.railway.com/volumes/point-in-time-recovery)

Read-only eligibility/status check after the service exists:

```powershell
railway postgres pitr status --project $RailwayProject --environment production --service resq-postgres --json
```

For an eligible tested service only, enable through the dashboard or reviewed CLI command, then inspect archive health and coverage. Perform a destructive-change simulation **in staging**, restore to a separate service and verify identities, memberships, job state, billing, spatial queries and file references. Record recovery time and maximum lost writes. If native PITR is unavailable, tested alternative WAL recovery is a production gate; daily logical dumps alone do not meet a small RPO.

HA is a separate decision. Do not add generic replicas to a database with one volume. Validate Railway HA/template compatibility with PG18, PostGIS, TLS, RLS and backups before conversion, or implement an explicitly tested supported cluster. A single instance is a documented pilot topology, not highly available emergency infrastructure.

### 13.2 Object and secret recovery

Back up object bytes and an inventory of key/size/checksum alongside recoverable metadata, with independent credentials and retention. Native object storage is not a backup of itself. Test a deleted-object restoration and reconcile the result against DB authorization metadata. Preserve legal holds and prevent cleanup from deleting backup evidence prematurely.

Keep encrypted recovery copies of CA material, role passwords, Firebase configuration, signing keys, provider settings and deployment manifests. Restrict who can read them; test restoration without depending on the lost production service. Alert on certificate expiry and rotate keys using overlapping validity where supported.

### 13.3 Monitors and alerts

Implement and exercise the following before unattended operation:

| Signal | Required action/evidence |
| --- | --- |
| API availability, latency, 5xx and auth failures | External synthetic probes; rate-limit/spoofing and dependency failure tests |
| Migration/release version | Deployed commit and schema compatibility reported without secrets |
| Oldest queued job, lease expiry, dead-letter jobs | Per queue/tenant age thresholds, controlled replay tool, on-call route |
| Source/forecast freshness | Expected provider cadence, last successful revision, stale labels and fail-closed actions |
| Warning/dispatch latency | Accepted observation-to-candidate and warning-to-gateway percentiles from the roadmap |
| Billing event lag | Duplicate-safe reconciliation and server entitlement age |
| Database CPU/memory/disk/connections/locks | Alert before resource exhaustion; preserve deploy/migration headroom |
| Backup and WAL archive coverage | Last success, archive failures/gaps, scheduled restore rehearsal |
| Storage pending/orphan/quarantine usage | Quota reconciliation, legal-hold awareness and scan backlog |
| Provider errors/spend | BigQuery bytes, AI usage, Mapbox, email, delivery and Railway resource limits |
| Privacy/security | Tenant denial anomalies, suspicious invitations, session revocation failures, log redaction |

Configure Railway deployment/process alerts and an independent uptime monitor. Application-level freshness/delivery monitors require code or external probes; provider dashboard metrics alone do not measure them. Avoid PII and precise volunteer locations in telemetry. Preserve trace IDs across API, queue, provider and delivery operations without logging bearer tokens or signed URLs. [Railway observability](https://docs.railway.com/observability)

Set Railway cost notifications and service resource limits from measured usage. A hard spending stop can interrupt emergency operations; decide its behavior explicitly with the operator rather than setting an arbitrary cap. Review dormant previews, forecast query bounds and storage retention regularly.

## 14. Production acceptance and cutover

Keep a dated release evidence file containing commit SHAs, image digests, migration head, service/deployment IDs, enabled providers, tests and outstanding exclusions. Never record secrets in it.

1. Complete all seven roadmap gates. Re-run repository-specific type/build/unit/integration suites at the exact release revisions; run Linux container builds and deployed browser/native journeys. Historical local results do not certify this release.
2. In staging, prove independent signup; verified email; invite-before-signup; invite-after-signup; profile-link invite; directory privacy; multiple memberships; recent privileged MFA; revocation and deletion.
3. Prove real operations without mock data: organizations/regions, missions, assignment permissions, reports/evidence, notifications, dashboards and offline synchronization. Legacy global routes must be replaced with scoped implementations before their guard is removed.
4. Prove free/Pro transitions, server-side denial, purchase restore, refunds, webhook retries, paywall accessibility and consistent pricing across apps/landing.
5. Prove authoritative weather provenance, source disagreement/staleness, model validation, hazard/exposure uncertainty, map time controls and permitted agent queries/actions. Missing Google approval prevents declaring the authoritative-weather requirement complete.
6. Prove safety/relay and approved mobilization on real devices: consent changes, battery/network failure, invalid sensor input, deduplication, expiry, degraded connectivity, acknowledgement and conflict handling. Measure latency under forecast load and deployment overlap.
7. Run storage, tenant-isolation, proxy, migration failure, worker crash/retry, backup/restore, provider outage and rollback drills. Exercise support/on-call workflows.
8. Freeze old writes/producers and execute the rehearsed Section 6 migration. Verify counts/fingerprints before allowing new production writes.
9. Deploy migrations, API and necessary workers in dependency order. Verify readiness and durable progress. Deploy portals with final origins and provider configuration; activate DNS after HTTPS ownership checks pass.
10. Enable production billing/providers gradually with audited configuration changes. Start with limited organizations/regions and monitor the agreed thresholds before broader access.
11. Keep old state, dumps and rollback instructions available through the agreed retention period. Decommission old hosting only after reconciliation and recovery acceptance; deleting old documentation does not authorize deleting live services or data.

## 15. Rollback and incident procedure

- **Application regression:** stop expansion, disable the affected capability, and redeploy the previous known-good image if compatible with the current schema. Do not run a destructive schema downgrade automatically.
- **Migration failure:** stop release. Determine whether the transaction rolled back or a partial forward repair is needed; preserve logs/backup and run the reviewed repair under the migration identity.
- **Database corruption/operator mistake:** freeze relevant writes, restore into a separate service, verify data/roles/PostGIS/TLS and repoint consumers only after reconciliation. A restore does not automatically restore external billing/notification state.
- **Bad forecast/model:** withdraw/supersede the revision with audit/provenance, label affected displays, stop action generation, and follow warning correction procedures. Do not erase history to make the dashboard appear healthy.
- **Duplicate effects or stalled worker:** isolate the queue/consumer, inspect job fence/lease/idempotency state, reconcile with the external provider, then replay through the audited tool. Never bulk reset every job to pending.
- **Credential incident:** revoke affected credentials, rotate the corresponding service role/key, redeploy consumers, verify access, and retain audit evidence. Deleting the database or bucket is not credential rotation.
- **Cutover reversal:** after new writes exist, switching back to the old URL can lose or fork data. Freeze, reconcile and choose a consistent source before redirecting clients.

Record incident timestamps in UTC, with Africa/Nairobi display where useful. Retain customer-facing status and recovery evidence separately from secret-bearing operator logs.

## 16. Endpoint and configuration handoff

When acceptance passes, save verified endpoints privately. Backend local `.env` uses an operator-reachable TLS endpoint/tunnel; Railway service variables use private service DNS. They are not necessarily interchangeable.

```dotenv
# Local integration template; placeholders, not deployed values.
DATABASE_URL="postgresql://sentinel_api:URL_ENCODED_PASSWORD@VERIFIED_OPERATOR_HOST:PORT/volunteerops?sslmode=verify-full"
DIRECT_URL="postgresql://sentinel_migrator:URL_ENCODED_PASSWORD@VERIFIED_OPERATOR_HOST:PORT/volunteerops?sslmode=verify-full"
# DATABASE_TLS_CA contains the actual CA PEM when a private CA is used.
S3_ENDPOINT="https://ACTUAL_S3_ENDPOINT"
S3_BUCKET="ACTUAL_GLOBAL_S3_BUCKET_NAME"
S3_REGION="ACTUAL_REGION"
S3_FORCE_PATH_STYLE="false"
S3_ACCESS_KEY_ID="PRIVATE_BUCKET_KEY"
S3_SECRET_ACCESS_KEY="PRIVATE_BUCKET_SECRET"
FIREBASE_PROJECT_ID="VERIFIED_PROJECT_ID"
GOOGLE_APPLICATION_CREDENTIALS="C:/PRIVATE/PATH/firebase-service-account.json"
MAPBOX_ACCESS_TOKEN="ORIGIN_RESTRICTED_PUBLIC_TOKEN"
CORS_ORIGIN="https://api.resq-app.co.ke,https://www.admin.resq-app.co.ke,https://app.resq-app.co.ke,https://resq-app.co.ke"
COOKIE_SECURE="true"
WEATHERNEXT_ACCESS_ENABLED="false"

# Public handoff metadata; these are not all backend-consumed configuration fields.
OPERATIONS_API_URL="https://api.resq-app.co.ke"
SENTINEL_PORTAL_URL="https://api.resq-app.co.ke/sentinel"
ADMIN_APP_URL="https://www.admin.resq-app.co.ke"
VOLUNTEER_APP_URL="https://app.resq-app.co.ke"
WEB_APP_URL="https://resq-app.co.ke"
```

Also record Railway workspace/project/environment/service IDs, release SHAs, schema head, provider activation state, billing product/entitlement identifiers, public callback URLs, CA expiry, backup coverage and acceptance results. Do not hand over root storage keys or Railway tokens for ordinary client wiring. Do not import the whole local `.env` into every Railway service.

## 17. Verification status of this runbook

This document is based on repository inspection and current official documentation reviewed on 1 October 2026. Railway CLI help was inspected without authentication/provisioning actions. No Railway resources, live credentials, custom PostgreSQL image, bucket behavior, DNS records, Linux frontend images or cloud acceptance tests were created or validated while writing it. Proposed files/entrypoints must be implemented in the roadmap and their outcomes recorded before production is declared ready.

The [seven-stage roadmap](resq-production-implementation-roadmap.md) owns feature ordering and acceptance. This runbook owns Railway operations. Keep both updated whenever source commands, provider capabilities, credentials or deployment responsibilities change.
