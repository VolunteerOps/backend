> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Observability and on-call setup skeleton

Step 1 documentation; trace S02/S09/S10 in the [specification](sentinel-implementation-plan.md). **No monitoring provider, emergency alert or billing configuration performed.**

| State | Current evidence |
| --- | --- |
| Implemented | Existing logger/`LOG_LEVEL` and basic `/api/health`; parent reports `/api/ready` and read-only `npm run db:readiness` for database prerequisites. No Sentinel dashboards, traces or worker readiness is claimed. |
| Owner action | Choose monitoring/on-call/audit-archive destinations, budgets, contacts, thresholds and data-handling policy. |
| Blocked | Worker/full-platform readiness instrumentation/exporters, configured alerts/dashboards/archive, service/tenant health and measured recovery/load evidence. Real PG18/PostGIS/container checks are unperformed; parent found no Docker or `psql`. |
| Verified | No monitoring ingestion, alert delivery, log redaction, archive immutability or recovery check ran here. |

## Required inputs and placement

All `REQUIRED`: monitoring account/project/region; error/log/metric/trace destinations; credential/DSN references; environment/service tags; on-call rotation/escalation contacts and quiet/test routes; source/queue/denial/budget thresholds; telemetry retention/residency and privacy policy; separate audit archive bucket/project/permissions; recovery approver/runbook contacts. Current `LOG_LEVEL` is accepted in `src/core/config.ts`; future exporter settings are pending provider/implementation, not invented environment variables. Inject secret destinations/tokens through runtime secret manager, not client code or logs.

Owner configures least-privilege ingestion/read access, isolated staging/test notifications, production paging, audit archive access separation, quotas/cost alerts and on-call acknowledgement/escalation. Never send synthetic emergency notifications to live responders to test monitoring. Store actor/context/reason/before-after audit metadata without secrets/unneeded personal data; export append-only evidence to separately access-controlled archive.

## Planned diagnostics and validation

Trace observation → ingress → correlation → assessment → policy → gateway → device acknowledgement where available. Dashboards need source/forecast lag, coverage/clock quality, queue/lease/dead-letter/relay age, dropped/expired evidence, candidate/false-positive outcomes, uncertain delivery, authentication/authorization denials, org fairness, DB pool/connection/storage health, provider quotas/billing and regional gate status. Metrics must not leak private precise locations/health/rosters across tenants or put expiring Weather values into logs.

Future basic isolated health command (documentation-only supplied URL; not run):

```powershell
Invoke-RestMethod -Method Get -Uri "$env:SENTINEL_CHECK_BASE_URL/api/health"
Invoke-RestMethod -Method Get -Uri "$env:SENTINEL_CHECK_BASE_URL/api/ready"
```

`/api/health` is liveness only. `/api/ready` returns 200/503 for `database_prerequisites`: PG18/PostGIS/nonprivileged non-owner role/TLS, not migrations, tenant isolation or Sentinel readiness. Read-only `npm run db:readiness` has not run against a real DB. Exact metrics/trace/worker probe commands remain blocked on instrumentation and must be recorded alongside expected/actual results after implementation. Trigger safe synthetic source-stale/queue-backlog/denial/budget alerts only in test routing; verify notification/acknowledgement/escalation and recovery. Test secret redaction, access control, unavailable exporters, archived audit tamper resistance and alert noise during provider outage.

Proposed unmeasured targets: 10,000 volunteers/1,000 concurrent clients, 1,000-device burst in 5 seconds and 10,000-recipient warning; P95 accepted observation→candidate ≤1 second and eligible warning→first gateway attempt ≤2 seconds, excluding acquisition/network/provider/device. RPO ≤5 minutes/RTO ≤60 minutes require measured restores. See [validation](sentinel-model-validation.md); dashboards cannot turn targets into guarantees.

Rotate ingestion/alert/archive credentials under change control, verify replacement and access revocation; document monitoring outage fallback contacts and retain durable application audit. Missing telemetry is unknown status, not healthy operation. No production cutover authorized.