# Stage 1 implementation and evidence

Date: 1 October 2026. Controlling plan: [seven-stage roadmap](resq-production-implementation-roadmap.md), Stage 1 only. Read alongside the [manual setup and credential guide](stage-1-manual-setup.md). This is staging foundation work, not a production or emergency-response release. Account-dependent acceptance gates below remain open.

## Repository and configuration inventory

Existing changes in admin and web were preserved. No commits or pushes were made. Starting main revisions:

| Repository | Starting commit | Stage 1 changes |
| --- | --- | --- |
| backend | 2cbb54f1784ad3cdd331b2149a4daebf33ea7c1b | Database/TLS, migrations, deployments, storage lifecycle, contracts, observability, recovery, CI |
| volunteer | 25e4e16ed3dc98799d0b6e2d6267bdf17a2ded41 | Ktor transport, explicit practice/live/test selection, tests, Docker/CI, staging origin |
| admin | 8d13e7231458e455e1fa24031649f9cde8ea0f9c | Same foundation changes; existing onboarding/navigation work retained |
| web | 530de8e0d09afc5d1afeefe6cab55e42582713ea | Bounded API transport, Railway build/runtime, Docker/CI |

Backend Node 24.20.0/npm 11.19.0; PostgreSQL 18.6; deployed PostGIS 3.6.4. Existing Prisma 8 RC contract/migration ownership and Prisma 7 runtime compatibility retained. npm package locks and KMP Yarn locks retained/updated. KMP container JDK pinned to Temurin 21.0.8+9; local checks used installed JDK 17 and the repository Gradle wrapper. Landing uses its Node 22/Next 15 toolchain. Native Android/iOS delivery remains later-stage work.

Actual Android IDs: volunteer com.resq.app (version 1.0/code 1); admin com.example.admin (1.3.0/code 4). iOS bundle identifiers still interpolate TEAM_ID in the example namespaces; these are not approved store identities.

## Railway inventory

[Project dashboard](https://railway.com/project/73690bd6-2d68-4ac7-9330-b5da3ebed8f0).
Workspace: Kalama's Projects, f4981f6e-b5fe-473e-b56a-df00765687ce.
Project: ResQ / Volunteer Ops, 73690bd6-2d68-4ac7-9330-b5da3ebed8f0.
Staging: 9de4cdd7-abad-4a36-ae1e-7577c06dc2d7.
Production: 518a0e08-6417-467e-81ed-119d6d82b73d. Production has a separate bucket, no operational application/database cutover.

| Service | Role/command | Exposure |
| --- | --- | --- |
| resq-postgres | Pinned PG18/PostGIS; /var/lib/postgresql volume; PGDATA=/var/lib/postgresql/18/docker | Private only; operator SSH tunnel |
| resq-migrate | Dedicated migration image; advisory lock; migration check/apply/full verify; exits | Private, NEVER restart |
| resq-api | Credential wrapper then dist/index.js | [Staging API](https://resq-api-staging.up.railway.app/api/health) |
| resq-devices | Dedicated device worker/login | Private health endpoint |
| resq-storage-scan | Dedicated scanner/login; durable scan queue and lifecycle reconciliation | Private health endpoint |
| resq-clamav | Pinned ClamAV image with maintained signatures | Private port 3310 |
| resq-retention | Restricted retention login; bounded batches | Five-minute cron |
| resq-monitor | Aggregate-only login; queue/storage/readiness/worker checks | Five-minute cron; logs/failure status |
| resq-backup | Dedicated approved backup login; encrypted consistent snapshot and objects | Daily 02:00 UTC cron; independent recovery bucket |
| resq-admin | Compose practice client | https://resq-admin-staging.up.railway.app |
| resq-volunteer | Compose practice client | https://resq-volunteer-staging.up.railway.app |
| resq-web | Next public-site staging build | https://resq-web-staging.up.railway.app |

Database and core stateless services use europe-west4-drams3a; buckets use ams. This is an initial European staging placement, not a Kenya region or a partner residency approval. Database volume: 5 GB, one replica. Confirm provider/dataset residency before production.

Staging file bucket: 64cb88c0-53bd-4ac3-b109-372c06f776bb. Recovery bucket: 278e048f-7dd8-4fae-8322-7561fed65d92. Production bucket: eefd3ef9-f5b0-4533-896e-9bd280e31ae1. Buckets are private. Secret credentials and provider-assigned bucket names are in the ignored local environment/private operator directory, not this document.

Railway rejected attaching new railway.json configuration files through the deprecated interface. Current infrastructure is represented in [.railway/railway.ts](../.railway/railway.ts) using the pinned railway/iac SDK and preserve() for secrets. The *.service.json files are reviewable settings plans, not auto-attached Railway configuration. Use config pull/plan against the selected environment before applying. Source upload deploys were used; GitHub auto-deployment has not been enabled. All three frontend images passed Railway health checks. The landing upload required deduplicating identical public assets (25.1 MB archive reduced to 19.0 MB); its Docker build restores duplicates after SHA-256 verification. The reproducible packaging command is npm run railway:package in web.

## S1.01: configuration/release ownership

Separate staging/production and buckets created. Exact staging CORS configured; frontend builds contain public origins only. Old Prisma deployment workflow archived and compute deployment scripts removed; Prisma ORM tooling remains active. Active .env now uses Railway database/storage and separate BACKUP_* values. The original .env is preserved privately for source recovery; obsolete Prisma-hosting credentials were removed from the active file. No old source service/data was deleted and no custom production DNS was cut over.

External dependency requests are prepared in the manual guide. No messages or applications were submitted to providers on the owner's behalf. Live Firebase, DNS, scientific/licensing/store approvals and institutional choices cannot be inferred from CLI access.

## S1.02: database integrity

- Pinned postgis/postgis:18-3.6 image digest 60f6ad1d21ea86a67d47780b9a0d1e1d200500f62b19293fa834d0dea80b8677; SSL required by pg_hba, SCRAM host authentication, private network, persistent PG18 layout.
- CA-verified hostname-matching TLS both internally and through localhost SSH forwarding. Valid connection passed; untrusted CA and wrong DNS hostname were rejected. A first diagnostic attempted to override pg's servername, which pg replaces; the corrected negative check used an actual mismatched connection hostname.
- Separate sentinel_migrator, sentinel_api, sentinel_identity, sentinel_devices, sentinel_sources, sentinel_retention, sentinel_scanner and sentinel_monitor logins. Runtime/maintenance identities are non-owner, non-superuser, no role/database creation and NOBYPASSRLS. API cannot publish a clean scan verdict.
- sentinel_backup is the explicitly owner-approved exception: SELECT-only across public/prisma_contract, BYPASSRLS for a complete backup, read-only default, no table ownership or role/database creation. Its credentials are separate BACKUP_* variables.
- Full canonical migration chain applied, with storage lifecycle migration 20260930T2321_storage_scan_lifecycle. Contract hash: 317429c4c267e61610b01e1c988b7c86d49fb8317c1c058ffc7ba3bc748ef2a3. Dedicated cloud migration artifact independently logged MIGRATION_VERIFIED.
- Fresh source object inventory also confirmed zero objects, without pagination truncation, on 1 October 2026.
- Fresh source dump (PG17.2) taken 2026-09-30T23:47:41.618Z: 124,424 bytes; SHA-256 5bb9ff8ec8c94d406503b36a1952655e96a0e6629e03575a7494bad6157963d5. Restored only into an isolated local source rehearsal. The unavailable provider-only prisma_postgres extension/comment entries were excluded from that rehearsal TOC; application data was retained.
- Explicit reviewed legacy mapping exported/imported 2,004 rows across 16 application tables, with per-table fingerprints, numeric IDs, relationships and sequence values preserved. Old migration ledgers were not imported. Missing tenant ownership remains quarantined; no identity/organization was guessed from email.
- Canonical Railway dump restored independently; encrypted recovery-bucket backup then downloaded/decrypted/restored into another fresh PG18 database. Both matched all source fingerprints. Sequence positions and full Prisma schema verification also passed on the encrypted restore.

API pool 3 + devices 3 + scanner 3 + monitor 1 + retention 1 + migration parent/child approximately 2 + backup snapshot/dump approximately 2 = approximately 15 baseline connections. Reserve at least 20 additional operator/failover connections; recalculate before enabling identity/source/forecast workers or replicas. PostgreSQL max_connections remains a measured capacity constraint, not an autoscaling entitlement.

Daily encrypted logical backup establishes a proposed 24-hour backup interval, not five-minute PITR. WAL archiving/HA is not implemented. A Railway volume-backup scheduling attempt returned Not Authorized; logical backup/restore works independently. No tested RTO is promised for a production-sized database. Certificate lifetime and rotation are explicit manual responsibilities.

## S1.03: API and jobs

Liveness (/api/health), database/schema readiness (/api/ready), and configuration-level feature status (/api/features) are separate. Feature status does not claim that configured providers have been validated. Legacy unscoped operational endpoints remain 503 TENANT_MIGRATION_REQUIRED. Firebase absence does not turn liveness into a false authentication claim.

Exact CORS, generated request IDs, safe error envelopes, no x-powered-by, and explicit trusted-proxy configuration added. Forwarded-header spoof test passes. TRUST_PROXY_CIDRS intentionally remains unset until the ingress boundary is verified; IP rate limiting currently groups requests by direct peer. Per-user authenticated storage limits remain separate. Production client-IP rate-limit acceptance is still an open configuration gate.

SIGTERM stops new claims and permits bounded handlers/fenced leases to recover. Existing durable jobs retain atomic outbox writes, per-organization fair claiming, business keys, deadlines and bounded retries. Storage adds STORAGE_SCAN_V1 with a strict versioned payload and unique object business key. Existing provider/device/identity protocols retain their current tested shapes; later-stage integrations must version new payloads. Job logs include ID, kind, fence, attempt, duration and outcome; async request/job context is available to nested logs. Provider/model business functionality remains governed by its later stage.

## S1.04: storage and recovery

Native Railway S3 contract passed: signed PUT, size/type/checksum binding, corrupted-byte rejection, If-None-Match overwrite rejection, HEAD/checksum/fallback path, ETag-pinned conditional reads, attachment headers and anonymous denial. Real Edge browser preflight, upload and download passed from both exact staging admin and volunteer origins. Existing non-owner two-organization tests reject cross-tenant access.

Metadata now progresses PENDING -> QUARANTINED -> CLEAN or REJECTED -> DELETED. Legacy READY is not downloadable. Scanner checks bounded bytes, SHA-256, MIME signatures/text restrictions and ClamAV; it publishes only with a current fenced lease. Live ClamAV accepted clean bytes and flagged the standard harmless EICAR pattern. Scanner outages keep files unavailable. Tests prevent an API role from self-marking a file CLEAN.

Lifecycle reconciliation waits one day beyond intent expiry before deleting abandoned uploads, keeps rejected bytes seven days, retries provider deletion failures, retains metadata tombstones and repairs missing scan jobs (including legacy READY). CLEAN evidence is not automatically deleted. Current quotas: 10 simultaneous pending intents, 100 requests/day and 250 MiB reserved per uploader/region; files <=10 MiB. Deleted metadata releases byte reservation. Product-wide organization storage pricing/retention limits require the later commercial policy.

Backup exports a PostgreSQL snapshot, uses that snapshot for pg_dump and referenced object metadata, then copies completed/quarantined/rejected/clean object bytes with ETag/checksum validation into independently credentialed encrypted recovery storage. Limits: 512 MiB database dump, 1,000 referenced objects, 10 MiB/object; exceeding a limit fails the backup instead of silently truncating. A manifest appears only after all copies succeed. No user evidence objects existed in the initial staging snapshot. A later isolated synthetic fixture passed actual scanner recovery, encrypted object backup, deletion of the synthetic source bytes, authenticated decryption and readback from an isolated recovery key; fixture rows/bytes were cleaned afterward. Database restoration alone is never described as file restoration.

## S1.05: contracts and clients

[OpenAPI](../contracts/openapi.v1.json) inventories 43 implemented/retired paths and generates request schemas from reviewed Zod schemas, including actual 201/202/204 statuses. Planned roadmap contracts are explicitly separate. Shared fixtures specify errors, UTC timestamps, decimal strings, identifier shapes and upload states. Success DTO expansion remains part of each later feature contract; this inventory is not an implemented billing/operations API.

Both KMP clients have a typed Ktor transport, fresh Firebase bearer-provider interface, bounded requests, redirect refusal, safe error/request-ID propagation and explicit LIVE/PRACTICE/TEST foundation repositories. Existing operational screens are labelled practice; choosing LIVE fails honestly until live operational repositories are implemented in Stage 3. Network failure never switches modes. Next transport has timeout, origin/path restrictions and explicit headers. No long-lived token persistence was added.

CI now covers backend build/types/contracts, disposable PG18/PostGIS, migration/schema parity, runtime audit, portal/object tests and migration/runtime Docker images. Each sibling has a foundation build workflow. CI files are authored; local tests and Railway builds provide the current evidence, not a claim that remote GitHub checks ran.

| Verification | Result |
| --- | --- |
| Backend unit/integration suite with explicit disposable PG18 | 129 passed; 0 failed/skipped |
| Backend type checks and build | Passed |
| Private object-store gateway tests | 3 passed |
| Desktop/mobile portal browser tests | 12 passed |
| Admin JS web build and shared Node tests | Passed; 23 tests, including 3 transport tests |
| Volunteer JS web build and shared Node tests | Passed; 32 tests, including 3 transport tests |
| Next production build/type checking | Passed |
| Runtime npm audit | 0 vulnerabilities after grpc dependency update |
| Private-value scan of frontend assets | 55 files, 17 actual private values checked; no matches |
| Restored source/canonical/encrypted backup data | 16 tables, 2,004 rows; fingerprints and sequences preserved |
| Live database negative TLS | Wrong CA and hostname rejected |
| Native bucket + actual browser origins | Passed |
| Live antivirus clean/EICAR | Passed |
| Staging frontend browser startup | All entry points HTTP 200; both Compose canvases rendered; no script exceptions |
| Killed claimant / deployed scanner recovery | Passed; committed job completed after lease expiry, fence advanced to 2 |
| Independent object recovery after source deletion | Passed with isolated synthetic fixture |

KMP Node tests emitted non-fatal Skiko WASM loader warnings; XML reports confirm tests executed without failures. These tests do not certify native UI, iOS, Android hardware, or a completed Firebase sign-in flow.

## S1.06: operations

Structured logs redact credentials, URLs, tokens, raw payloads/audio and precise coordinates. Raw Prisma SQL error output was removed. Aggregate-only monitor views expose queue counts/age/expired leases/dead jobs, quarantine age, reserved bytes and database size, without payloads or object keys. Monitor checks API readiness and private worker progress; alarm conditions cause log events and nonzero exit. Retention and monitor run every five minutes. A separately grantable audit-export view excludes narrative reasons, payload metadata and actor identity.

The recovery bucket and backup role are independent of API permissions. On-call delivery routing, real spending thresholds, Firebase/provider service accounts and custom DNS remain owner setup. WeatherNext/USGS are disabled in staging; no AI/scientific forecast/model validity claim. Usage was read from Railway; its early estimate is not a monthly-price forecast. Workspace spending limit was unset at inspection.

## Acceptance boundary

Implemented code and proved infrastructure above are reviewable in the four working trees. Do not mark Stage 1 fully accepted until the manual guide's security/operations gates are completed: ingress/client-IP verification, real identity credentials and staging auth acceptance, on-call/budget ownership. Later provider/store/scientific approvals are tracked dependencies rather than reasons to block unrelated foundations. Do not enable a public operational release or production cutover from this checkpoint.
