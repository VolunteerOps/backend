# ResQ documentation

Stage 1 implementation: [evidence and status](stage-1-implementation.md) ? [manual setup and credential rotation](stage-1-manual-setup.md).

Start with the [seven-stage production implementation roadmap](resq-production-implementation-roadmap.md). It is the controlling plan across backend, volunteer, admin and landing site, including Railway, standalone signup/recruitment, RevenueCat, full Sentinel and production acceptance. Specialist documents below preserve detailed requirements; dated evidence is not a claim of present deployment.

## Primary delivery documents

| Document | Purpose |
| --- | --- |
| [Seven-stage roadmap](resq-production-implementation-roadmap.md) | Ordered work packages, current implementation audit, API/screen/data registers, owner inputs and acceptance. |
| [Railway production runbook](railway-production-deployment-runbook.md) | Actual platform capabilities, service setup, environment variables, TLS/storage, workers, domains, verification and operations. |
| [Data migration and recovery](railway-data-migration-and-recovery.md) | Preserved rehearsal evidence, safe canonical-schema import, cutover and rollback. |
| [Documentation audit](resq-documentation-audit.md) | Coverage/disposition of all 59 original docs across four repositories and code contradictions. |
| [Implementation checkpoint](sentinel-continuation-status.md) | Existing slices and historical test evidence, distinct from release status. |

## Specialist implementation requirements

- [Detailed Sentinel specification](volunteerops-sentinel-disaster-engine.md), [earlier specification breakdown](sentinel-implementation-plan.md) and [API contracts](sentinel-api-contracts.md).
- [Organization admission](sentinel-organization-admission.md), [Android sensing/relay](sentinel-android-sensing-and-relay.md), [model validation](sentinel-model-validation.md) and [operations](sentinel-operations-runbook.md).
- [Volunteer screen requirements](sentinel-volunteer-implementation.md) and [admin screen requirements](sentinel-admin-implementation.md).
- [Provider setup/checkpoint](sentinel-setup-and-activation.md); use the roadmap for current priorities and the Railway runbook for hosting.

## Setup and release references

| Area | Guides |
| --- | --- |
| Identity and organizations | [Firebase](firebase-setup.md), [enterprise identity](enterprise-identity-setup.md), [owner bootstrap](platform-owner-bootstrap.md), [onboarding](organization-onboarding.md). |
| Data and infrastructure | [PostgreSQL](postgresql18-setup.md), [containers](container-hosting-setup.md), [storage](storage-setup.md), [DNS/email](dns-email-setup.md), [observability](observability-setup.md). |
| Geography and sources | [Mapbox](mapbox-setup.md), [Google Weather](google-weather-setup.md), [Kenya preparedness](kenya-seasonal-readiness.md). |
| Distribution | [App distribution](app-distribution-setup.md), [volunteer Railway integration](../../volunteer/docs/RAILWAY_INTEGRATION.md), [admin Railway integration](../../admin/docs/RAILWAY_INTEGRATION.md), [landing Railway deployment](../../web/docs/RAILWAY_DEPLOYMENT.md), [existing mobile RevenueCat implementation](../../volunteer/docs/REVENUECAT.md). |
| Optional background only | [Kubernetes alternative](kubernetes-setup.md) is not part of the selected Railway rollout and is not a production prerequisite. |

## Documentation precedence

Latest user decisions and this roadmap govern delivery, hosting and product policy. The detailed Sentinel specification governs scientific/behavioral requirements except the explicitly superseded signup/directory/commercial/hosting decisions. Code inspection governs what exists; dated test records govern only the environment/commit tested. Provider configuration, paid entitlement, scientific validity and a successful deployment are separate facts.

The old Render/Prisma Console hosting guides and outdated database-hosting rewrite documents have been removed; useful data-preservation/build facts were migrated. Existing provider-specific scripts/configuration and live services were not deleted. Stage 1 replaces their runtime deployment wiring and Stage 7 performs the reviewed cutover. Prisma ORM documentation remains relevant.

Stage 2: [implementation ledger](stage-2-implementation.md) and [manual setup](stage-2-manual-setup.md).
