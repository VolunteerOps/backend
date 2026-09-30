> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Optional Kubernetes setup skeleton

**Optional alternative only: not required, not selected, not provisioned.** Default is [managed container hosting](container-hosting-setup.md) with external [PG18/PostGIS](postgresql18-setup.md). Step 1 documentation; trace S02/S09/S10 in the [specification](sentinel-implementation-plan.md). No cluster creation, billing or deployment authorization.

| State | Current evidence |
| --- | --- |
| Implemented | This optional mapping only; no cluster/manifests/IAM installed by this task. |
| Owner action | Explicitly select this alternative and approve account/region/cost/cluster/registry/network/operations ownership. |
| Blocked | Optional selection, all cluster identifiers/configuration, API/worker manifests and actual capability/recovery evidence. Not selecting Kubernetes does not block the managed-container path. |
| Verified | No cluster, manifest, workload, network-policy, autoscale or rollback test performed. |

## Required inputs and planned mapping

If selected, mark actual values `REQUIRED`: managed cluster/provider/project/region/version; exact kube context; namespace; registry/image digests; runtime service accounts/workload identity; external secret-store references; ingress controller/DNS/TLS; private external PG egress; API/urgent/bulk worker deployments; ports/liveness/readiness paths; CPU/memory requests/limits; replica/pool budget/HPA signals; disruption budgets; migration job; log/metric/audit destinations; cost/on-call/recovery owner.

Map API and independent persistent worker classes to separate Deployments/Services as appropriate; migration is a controlled one-shot job using Prisma 8 history, not a startup race. Configure workload identity, least-privilege RBAC, namespaces/network policies, ingress/TLS, graceful termination/fencing, probes, bounded autoscale and disruption budgets. Preserve urgent safety queue capacity across tenants. PostgreSQL remains external managed PG18/PostGIS; do not deploy redundant databases/brokers in the cluster.

Store credentials in approved external secret manager/workload identity integration, never plaintext checked-in manifests or images. Namespace/RBAC is not application tenant isolation; PostgreSQL constraints/RLS and current request/job scope remain mandatory. Exact manifest paths and deployment/migration commands are pending implementation, not invented here.

## Verification and recovery — only after selection

With an approved nonproduction context/namespace supplied, this future read-only inventory check can establish workload presence, not readiness:

```powershell
kubectl --context $env:SENTINEL_KUBE_CONTEXT --namespace $env:SENTINEL_KUBE_NAMESPACE get 'deployments,pods,services'
```

These environment labels are operator-only inputs, not application settings; command not run. Once actual templates exist, document manifest validation/diff commands before apply, inspect probes/resources/network restrictions/workload IAM, test PG TLS/private egress, worker restart/lease recovery, pod disruption/autoscale pool budgets and audit/alert routing. Do not issue apply/create against guessed/current contexts.

Rollback uses approved image/config revision and migration-compatible reconciliation, not blind `rollout undo` after incompatible writes. Rehearse node/pod loss plus external DB restore and secret rotation without exposing credentials. Kubernetes selection cannot bypass model/identity/provider/production gates or authorize cutover.