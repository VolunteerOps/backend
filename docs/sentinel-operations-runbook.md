> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Sentinel operations â€” Step 1 skeleton

> Current implementation: [13 September continuation](sentinel-continuation-status.md). The earlier baseline below is historical where it describes local JWT authentication, missing Firebase HTTP mappings, or absent identity workers. Organization isolation, live client integration and the disaster engine remain unfinished.

**Not an authorization to deploy or cut over. Step 1 foundation is partial; later Sentinel operations are planned.** Runtime commands and parent-owned implementation evidence belong to the [root deployment runbook](../DEPLOYMENT_RUNBOOK.md); this document does not modify or replace it. Trace: specification S02/S03/S04/S09/S10. [Status/evidence rules](sentinel-implementation-plan.md).

## Current ledger

| State | Evidence / remaining work |
| --- | --- |
| Implemented | Parent reports direct `PrismaPg` bounded-pool configuration, PG18/PostGIS/role/TLS prerequisite diagnostics, standalone lazy Firebase Admin ADC verifier/session/revoke-all adapter, legacy signup/auth hardening and API-only Compose template. See [reconciled evidence](sentinel-implementation-plan.md#current-partial-step-1-baseline). Firebase is not wired to HTTP; legacy local JWT remains active. |
| Owner action | Select/authorize provider accounts, regions/residency, runtime identities/domains, on-call contacts, backup policy, partner scope, scientific/SOP reviewers and release decision-makers. |
| Blocked | Firebase mappings/HTTP/session/CSRF/cutover, organization models/RLS/migrations and operational/storage/export/stream scoping, durable jobs/outbox/receipts/stream events and workers/templates/probes/shutdown. No Docker or `psql` found; real PG18/PostGIS migration/RLS/container/restore tests blocked. Later sensors/clients/source/dispatch operations remain unstarted. |
| Verified | `npm test` passed 72 tests including HTTP smoke checks; `npm run test:types` and `npm run build` (Prisma generation/emission and TypeScript) passed. See the final evidence record. No deployment, restore, live alert, configured provider or production check ran. |

Dependency security blocker: the completed `npm audit --omit=dev --fetch-retries=0 --fetch-timeout=20000` reported 17 vulnerabilities (10 moderate, 7 high). Assess affected runtime paths and review targeted remediation with regression checks; no forced, breaking toolchain downgrade was applied. `.env.example` was updated; actual `.env`, credentials and production authorization were not changed.

## Safe setup order â€” future execution only

1. Complete the [remaining Step 1 coding and validation](sentinel-implementation-plan.md#next-coding-and-validation-work--step-1-only) alongside [PG18](postgresql18-setup.md), [container host](container-hosting-setup.md), [storage](storage-setup.md), [DNS/email](dns-email-setup.md), [observability](observability-setup.md) owner-approved inputs. Configuration alone cannot finish the platform. Kubernetes is [optional](kubernetes-setup.md), not a prerequisite or assumed cluster.
2. Complete foundation authorization/migrations/jobs and tests. Then configure [Firebase](firebase-setup.md)/[enterprise identity](enterprise-identity-setup.md), guarded [owner bootstrap](platform-owner-bootstrap.md) and [organization onboarding](organization-onboarding.md) as their implementations become available. A verifier alone does not migrate identities or isolate tenants.
3. Keep sources/sensors/relay/weather/warnings disabled until applicable implementation, consent and license gates are satisfied. Future consented pilot/shadow must be explicitly approved; drills are isolated. Complete [model validation](sentinel-model-validation.md), [Mapbox](mapbox-setup.md), [Weather](google-weather-setup.md), [distribution](app-distribution-setup.md) and regional readiness before live use.
4. Record separate code/configuration/scientific/device/provider/operational/store evidence. No time pressure, tech-admin override or partnership claim can replace a gate.

## Database and identity migration gate

- Preserve Prisma 8 `migrations/app/` ownership and Prisma 7 compatibility parity; no second migration history. Verify actual PG18/PostGIS/TLS/roles/pool budgets/private networking, additive migrations, restored-data rehearsal and RLS/composite ownership enforcement.
- Approve legacy organization and coordinate backfills; quarantine ambiguity. Reconcile duplicate active assignments before uniqueness constraints; retain user IDs/audit/deployment relationships.
- Firebase mapping uses immutable project/UID registry with identity proof, not email-only privileged attachment. Rehearse reset/invitation or supported optional import without logging hashes; keep bounded recovery plan. Legacy signup/middleware role bypasses have been hardened, but local JWT remains active. Retire legacy JWT/refresh/cookies through reviewed HTTP/client cutover only; never indefinite dual-auth or restoration of removed bypasses.
- Cutover requires named authorization, verified usable backup/PITR, controlled write freeze, final synchronization/consistency checks, key/cookie/client transition and monitored rollback criteria. **None is approved here.** Do not execute destructive demo seeds.
- After new writes, rolling back requires reconciliation of database and identity/assignment/delivery effects. Old URLs, containers or token issuance are not sufficient rollback. Do not restore unscoped access or replay expired warnings.

## Planned health and recovery verification

On an explicitly selected isolated environment, implemented liveness and database prerequisite routes can be checked after the operator supplies a nonsecret base URL:

```powershell
Invoke-RestMethod -Method Get -Uri "$env:SENTINEL_CHECK_BASE_URL/api/health"
Invoke-RestMethod -Method Get -Uri "$env:SENTINEL_CHECK_BASE_URL/api/ready"
```

`SENTINEL_CHECK_BASE_URL` is a documentation-only operator input, **not an implemented application config key**. Commands not run here. `/api/health` is Dockerfile liveness only. `/api/ready` returns 200/503 for `database_prerequisites` (PG18/PostGIS/nonprivileged non-owner role/TLS), not migrations, tenant isolation or Sentinel readiness. Read-only `npm run db:readiness` is also implemented but has not run against a real DB. Worker diagnostics remain unimplemented. The API-only `deploy/compose.api.yaml` requires `VOLUNTEEROPS_API_IMAGE`/`VOLUNTEEROPS_API_ENV_FILE`, with optional host port defaulting to 3001 on loopback; it supplies no worker or full-platform readiness guarantee.

Future drills: kill/restart an isolated worker after receipt/claim, allow lease expiry, verify fencing prevents stale completion, durable polling recovers missed NOTIFY and committed rows are neither lost nor duplicated. Exercise outbox replay, priority/fair quotas, backpressure, expired evidence, source checkpoints and stream cursor resnapshot. Restore to isolated infrastructure, enforce licensed content expiry, verify identity/tenant consistency and replay only eligible actions. Conditional goals RPO â‰¤5 minutes/RTO â‰¤60 minutes require measured results, not a configuration promise.

## Incident procedures â€” implementations required before use

| Failure | Required response |
| --- | --- |
| Suspect source/model or false warning | Region/source/model kill switch stops new warnings, retains allowed evidence; audit incident/reason, authoritative supersession/cancel, review recipients and assistance. No timer-derived all-clear. |
| Source stale/weather license unavailable | Mark unavailable, stop affected derivation/display/warnings, isolate provider failures, purge expired content and use permitted independent sources. No fabricated risk/coverage or silent paid replacement. |
| PG/authorization failure | Fail closed for protected/dispatch actions; preserve committed durable work, use approved manual phone/radio/local-authority fallback. No anonymous/private-data bypass or offline approval. |
| Worker backlog/noisy tenant | Inspect queue/source/observation ages, apply scoped quotas, preserve urgent safety capacity, dead-letter/replay with idempotency and current authorization. Historical relays cannot trigger current alarms. |
| Push/radio outage | Distinguish queued/provider-accepted/device/human states and peer custody/backend receipt. Show not delivered/expired; do not assume a gateway, SMS service, wake-up or confirmed safety. |
| Identity/provider failure or partner suspension | Deny affected PostgreSQL scope immediately; close/recheck streams, recipients, jobs, invites and queued actions; retry remote revocation via reconciliation. Audited mission/assistance handover, no loss of unrelated memberships. |
| Key/device compromise | Rotate/revoke with audit; fully revalidate ingress, bound offline trust and expiry, acknowledge no instant offline recall. Review false evidence and downstream actions. |
| Unsafe/changed route or competing assignment | Stop movement proposals into danger, revalidate restrictions/capacity/shared identity at approval; no invented safe reroute or auto-reassignment. Escalate to scoped human lead. |

## Privacy, audit and activation checklist

Proposed first-party feature/location/heartbeat retention 7 days, coarse aggregates 90 days; incident/audit per approved org policy. No default raw-audio retention. Stricter third-party terms override defaults; expiring Google content must not survive in logs/outbox/mobile caches/exports/backups. Respect consent deletion/legal holds, cohort minima, private media and scoped exports. Archive append-only audit evidence separately with restricted access; no secrets or unnecessary personal data.

Before any future activation record source/model/region/device versions, coverage/freshness, owner/SOP/authority approval, deployment guards, actual gateways/signed clients, real permission/device/provider checks, on-call/escalation, tested kill switch/recovery and [regional drill](kenya-seasonal-readiness.md). Operational responder movement always needs administrator approval. No public pilot countdown, guaranteed warning lead time or â€œoutside red means safeâ€.

**Remaining blockers:** the coding and infrastructure validation ledger above, unresolved dependency audit/remediation, worker diagnostics/commands, real provider accounts/licensing, named on-call and region owners, signed apps/device evidence, scientific approval and measured restores. Steps 2â€“7 are not started, clients unchanged, and no production cutover authorized. No tests were needed or run for these documentation-only changes; parent's final verification evidence must be joined separately.