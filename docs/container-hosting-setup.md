# Managed container hosting setup skeleton

Step 1 documentation; trace S02/S09/S10 in the [specification](sentinel-implementation-plan.md). **Default target is a managed container service with external managed PG18/PostGIS. No provider selected/provisioned or production cutover authorized here.**

| State | Current evidence |
| --- | --- |
| Implemented | Parent reports Dockerfile liveness at `/api/health` and `deploy/compose.api.yaml` for the foundation API only. Direct-PG bounded pool and `/api/ready` database prerequisite check exist; no worker entrypoint/template is delivered. |
| Owner action | Choose account/provider/region/registry/network, authorize cost/runtime IAM and supply domains/secrets/scale/probe policy. |
| Blocked | Complete identity/tenant/durable-processing foundation, persistent workers/images/probes/shutdown/templates, provider selection and actual deployment/recovery evidence. Parent found no Docker or `psql`; real container and PG18/PostGIS migration/RLS tests remain blocked. |
| Verified | Parent reports successful `npm run build` (Prisma generation/emission and TypeScript), tests and type checks; this is not an image build or deployment. No Docker build, HTTPS, queue recovery, pool load or cloud console check ran here. |

## Required inputs and placement

All `REQUIRED`: hosting account/project and billing approver; deployment region/residency; registry/repository and immutable image digest; API service ID; urgent and bulk/analytics worker service IDs; CPU/memory/min/max replicas and org fairness budgets; external PG private routing/pool limits; runtime identity and least-privilege registry/secret access; HTTPS hostname/TLS/CORS; secrets references; probe paths/timings; migration job runner; shutdown grace/lease duration; on-call/rollback revision. Do not invent service IDs or worker commands before implementation.

Use managed runtime secret injection for DB/Admin/object-store/email credentials, not Docker build arguments/layers or committed environment files. The foundation `deploy/compose.api.yaml` requires `VOLUNTEEROPS_API_IMAGE` and `VOLUNTEEROPS_API_ENV_FILE`; optional host port defaults to 3001 and binds loopback. Supply an approved image and secure runtime env-file reference; no actual credentials or `.env` were modified. `.env.example` was updated. PG/Firebase settings are recorded in [PG setup](postgresql18-setup.md) and [Firebase setup](firebase-setup.md); exact runtime commands belong to the [root runbook](../DEPLOYMENT_RUNBOOK.md). This API-only template is not a complete Sentinel deployment and does not validate any historical Compute topology.

Owner actions: authorize provider billing/region, registry/IAM, private PG networking/TLS, domain/certificate, secret access, bounded scaling and monitoring. Retain Compute for API only if direct connectivity/streaming/execution limits are actually verified; persistent workers require always-on hosting. Kubernetes is [optional](kubernetes-setup.md), not a deployment prerequisite.

## Implementation and verification backlog

Extend the foundation API template with runnable independent worker image entrypoints/templates, worker readiness and graceful shutdown/lease release, separate urgent/bulk classes, fair per-org quotas, durable job/outbox recovery and controlled Prisma 8 migration execution. Budget the implemented bounded pool per process across replicas. API liveness `/api/health` is distinct from implemented `/api/ready` (200/503 for `database_prerequisites`: PG18/PostGIS/nonprivileged non-owner role/TLS only); neither certifies migrations, tenant isolation or workers. No migration-on-every-replica startup or lost jobs on ordinary restart.

After owner-approved isolated setup, current baseline build/health commands may be used; these are **not run** and do not certify worker readiness:

```powershell
docker build -t volunteerops-sentinel:local-check .
Invoke-RestMethod -Method Get -Uri "$env:SENTINEL_CHECK_BASE_URL/api/health"
Invoke-RestMethod -Method Get -Uri "$env:SENTINEL_CHECK_BASE_URL/api/ready"
```

`SENTINEL_CHECK_BASE_URL` is a supplied documentation-only check input, not an app setting. Docker is unavailable in the reported environment, so the image command is blocked. Verify image/entrypoint/startup against current root runbook and record worker commands after implementation. Test missing/invalid credentials fail closed without secret logging, TLS/CORS/auth, stream reconnect, scale-to-budget, urgent burst versus noisy tenant, lease expiry/restart/outbox replay and permitted deploy rollback. Neither basic health nor database-prerequisite readiness proves source/model/provider or platform readiness.

Recovery: retain approved immutable revisions, drain API and safely release/expire worker leases, avoid stale fenced completions, restore/reconcile PG before replaying eligible work. Stop warnings through scoped kill switches on unsafe state; no expired replay or legacy auth bypass. App rollback after new DB writes requires reconciliation. Required owner values, runnable worker templates, deployment evidence and production authorization remain blocked.