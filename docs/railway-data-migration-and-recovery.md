# Railway data migration and recovery

Updated 1 October 2026. This replaces the former provider cutover notes. It preserves useful evidence and defines the implementation/release procedure; no Railway resource, database migration, credential replacement, DNS cutover or old-service deletion was performed by this documentation task.

Use the [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway production runbook](railway-production-deployment-runbook.md) together. Migration code/images, final ownership mapping and cloud restoration still require implementation/verification.

## Preserved evidence and its limits

- The previous source database was PostgreSQL 17.2 without PostGIS. Its source connection is not a compatible production Sentinel runtime; it remains a data source until a reviewed cutover.
- A consistent source backup and prior environment snapshots were retained in ignored, user-restricted `.sentinel-deploy/`. Locate them without printing their contents; verify current file permissions and completeness before using them. Their existence is not proof of a recent backup.
- The earlier rehearsal preserved **2,004 application rows across 16 tables**, compared counts and SHA-256 fingerprints, applied the canonical eleven-migration chain to isolated PostgreSQL 18.6/PostGIS 3.6.2, and verified the Prisma 8 schema. Repeat against current data; counts and migration totals change.
- The earlier source object inventory was empty. Reinventory before migration; do not assume zero objects today or discard pending upload metadata.
- Application-only import intentionally excluded old Prisma migration tables and `_prisma_next` metadata. New targets use current `migrations/app/` ownership. Numeric IDs, sequences and relationships were retained; no FK checks were disabled.
- Legacy records with unknown organization remain quarantined. Existing password hashes/JWT refresh records do not establish Firebase identity ownership. Preserve referenced user IDs and use verified operator/identity-binding workflows.
- The prior production-hosting validation did not create the proposed database or storage. Existing public services may still run on the previous host; documentation retirement does not terminate them. The web Railway guide preserves the earlier public-site release identifiers.
- Previously recorded backend/client/storage tests are historical evidence, not fresh Railway acceptance. See the [checkpoint](sentinel-continuation-status.md).

## Roles and tooling

| Identity/artifact | Intended use | Forbidden use |
| --- | --- | --- |
| Source backup identity | Read-only consistent export where supported, approved snapshot/restore access. | Production client credential or public API URL. |
| Target migration owner | Extension/schema setup, canonical migration graph and reviewed import. | API/worker runtime, browser bundle or mobile configuration. |
| Target API/worker runtime | Bounded pools and authorized RLS-protected operations. | Table ownership, superuser, BYPASSRLS, CREATE ROLE/database or inherited privilege. |
| Target retention identity | Reviewed cleanup functions/tables with narrow grants. | General-purpose tenant bypass or deleting audit history. |
| Backup/WAL identity | Database and recovery object access necessary for tested recovery. | Public upload/download capability or application secret sharing. |
| Migration image/job | Pinned Prisma toolchain, contract/config and migration graph with verified TLS. | Auto-running DDL on every API process startup. |

Current role SQL under `deploy/render-runtime-role.sql` and `deploy/render-retention-role.sql` contains useful provider-independent grants. Stage 1 relocates/reviews it under neutral database deployment paths; these old filenames do not select that hosting provider. Do not assume the production API image contains migration tools.

## Ordered rehearsal procedure

1. **Inventory and freeze the procedure, not production yet.** Record source/target environment identifiers, application commits, schemas, migration graph, roles, extension versions, database size, sequences, orphaned references, active assignments and object metadata. Secrets stay in protected environment/files.
2. **Take a fresh consistent source backup.** Use a supported PostgreSQL backup tool/version and encrypted protected output. Record timestamp, checksum and tool version. Capture object keys/version/checksum/state separately and record in-flight uploads/jobs. Check backup return code and test restore; a zero-byte file is not a backup.
3. **Restore source into an isolated rehearsal database.** This is for understanding legacy data, ownership and transformations. Never restore the source wholesale over the new canonical migration graph or production database.
4. **Provision a separate empty canonical target.** On Railway verify PostgreSQL 18, PostGIS, volume path, server certificate hostname/CA, private routing and restricted roles. Run `scripts/check-hosted-database.ts` only with explicitly selected safe variables as described in the deployment runbook; do not print URLs.
5. **Apply canonical migrations before application import.** Generate/synchronize Prisma contracts/compatibility client with pinned lockfile, apply `migrations/app/` once using migration owner, then verify schema. Existing migration checksums are immutable. Never use `db push`, force-baseline or demo seed as a failed-migration workaround.
6. **Prepare a reviewed application-data mapping.** Determine table dependency order; exclude old migration ledger/internal metadata. Preserve stable primary keys and identity/audit links. Map only approved legacy organizations; retain ambiguous rows quarantined. Resolve duplicate active assignments before adding constraints.
7. **Import transactionally.** Load parent/child records in FK order with constraints enabled, adjust sequence positions and apply explicit safe transformations. A failed import rolls back; do not disable triggers/FKs globally. New immutable audit evidence records what migration changed without rewriting original evidence.
8. **Copy/verify actual objects if present.** Preserve intended owner/region, checksum, MIME/size, quarantine status and reference mapping. Provider ETags may differ and multipart ETag is not a content hash; recompute/verify SHA-256 and refresh signed-URL metadata. Incomplete uploads remain pending until correctly reconciled.
9. **Verify data and behavior.** Compare per-table counts, deterministic ordered fingerprints, foreign keys, sequences, representative records and ownership. Run A/B/unassigned/owner tests, storage denial/integrity, duplicate-job recovery, stale warnings, identity mapping and billing reconciliation. Verify backup restore into another isolated target.
10. **Document timing and impact.** Measure export/import/object-copy/validation duration, required write freeze, DNS/cache/session implications, roll-forward steps and restore RPO/RTO. Review before production scheduling.

## Final cutover

1. Approve the release record only after Stage 7 prerequisites pass. Identify responsible operator, support contacts, current source and fresh target, incident window and rollback triggers.
2. Freeze source writes and drain or explicitly inventory in-flight requests/jobs. Pause external mutation producers or route them to a durable receiving mechanism; provider retries alone must not be the only preservation strategy.
3. Take final backup/object inventory and transfer changes using the rehearsed process. Do not lose the time between the rehearsal snapshot and freeze.
4. Verify final consistency, tenant ownership, schema/roles, pending job deadlines, entitlement/webhook state, device trust and object references. Suppress expired notifications and observations rather than reissuing historical warnings.
5. Deploy the approved API/workers/client artifacts with target runtime secrets and public origins. Update DNS and provider callbacks only when reachable; confirm Firebase action origins/cookies, billing webhooks, storage CORS and Mapbox restrictions.
6. Run real domain/user/purchase/mission/forecast smoke scenarios and negative authorization checks. Monitor errors, job age, source lag, billing lag, upload state and push delivery attempts.
7. Record cutover time, versions and validation. Keep the old source frozen/read-only for the agreed recovery window; never allow independent active writes to both systems.

## Recovery and rollback

- Before target writes: revert routing only after confirming source remains authoritative and no migration-side external effect was issued.
- After target writes: determine authoritative state and reconcile changes before rollback. Restoring an older database alone can lose payments, identity revocations, assistance requests, mission assignments, media and outward-message state.
- Code rollback uses schema-compatible artifacts. Prefer additive/expand-contract migrations; a destructive down migration is not the default response to an application defect.
- Database recovery must include WAL/PITR or a tested equivalent if committing to five-minute RPO. Railway volume backups and PostgreSQL PITR are distinct capabilities; prove the selected custom PostGIS image's recovery path.
- Coordinate object recovery/versioning/archives with database restore. A restored object key is useless if its bytes were permanently deleted. Use independently controlled recovery copies and retention jobs where bucket lifecycle/versioning is unavailable.
- Verify recovered billing from RevenueCat, suppress duplicate outward effects using durable business keys, reauthorize delayed jobs and recheck current consent/membership. Never replay expired warnings to achieve queue cleanliness.
- Do not restore retired global APIs, legacy JWT acceptance or public storage as an emergency shortcut. Rollback preserves security boundaries.

## Operator handoff record

Store a secret-free record of Railway project/environment/service IDs, approved source/target and artifact IDs, migration revision, database/PostGIS versions, runtime-role checks, TLS certificate expiry/rotation owner, object inventory counts, backup/WAL locations (not credentials), restore evidence, DNS values, smoke results, unresolved limitations, monitoring links and on-call owner. Secret values go only to Railway/service secret storage or the local ignored environment under appropriate permissions.
