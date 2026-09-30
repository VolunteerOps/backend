# Sentinel implementation checkpoint — 1 October 2026

The controlling delivery plan is the [seven-stage ResQ production roadmap](resq-production-implementation-roadmap.md); [Sentinel detailed requirements](volunteerops-sentinel-disaster-engine.md) remain its technical reference. Historical verification below was recorded before this documentation-only consolidation and was not rerun.

**0 of the original 7 Sentinel steps were fully complete at the prior checkpoint.** The new platform roadmap maps every original step and adds billing, recruitment and Railway release work; none of its stages is marked complete by writing the guide. Steps 1–3, 5 and 7 have implementation slices; Steps 4 and 6 still need their core operational implementations. This checkpoint supersedes the older 72/94/105-test records and their claims that PostgreSQL tooling and all client work were unavailable.

## Implemented and verified

- Firebase HTTP/session authentication, identity binding, organization admission/RLS and durable identity work from the prior checkpoint remain in place.
- Private object metadata, scoped signed uploads/downloads, checksum verification and a maintained S3-compatible service image with separate root/runtime credentials.
- Device registration, versioned opt-in consent, revocation, bounded deduplicated heartbeat receipts and a fenced device worker.
- Organization/region ownership columns, composite foreign keys and RLS for operational tables. Legacy null ownership stays quarantined; old global operational endpoints remain gated.
- WeatherNext 3 BigQuery provider, hourly/unit/percentile validation, query budgets, forecast refresh worker, immutable forecast revisions, region policies and admin/volunteer insight endpoints.
- Read-only scoped Gemini evidence assistant, with source collection and authorization rechecks.
- Bounded expiry cleanup for forecasts and ingress receipts, seven-day terminal job payload scrubbing, immutable-data RLS checks and a separate maintenance login.
- USGS revision ingestion/source worker and region-filtered latest observations; live feed smoke check accepted 219 revisions.
- ResQ Mapbox web portal with time/statistic controls, 3D terrain, accessible list, region configuration and unavailable/stale states. Live map rendering succeeded.
- Browser enrollment, email verification, TOTP, social/enterprise sign-in and invitation controls are implemented; live identity-provider success paths remain unverified.
- Admin and volunteer apps now have Sentinel navigation and web adapters. Both JavaScript/Wasm compilations, production JavaScript distributions, public portal URL injection and common JVM tests passed. Native adapters remain unavailable and say so.
- PostgreSQL 18.6/PostGIS 3.6.2 installed into an isolated loopback test environment. All eleven migrations applied, full schema verification passed, and backup/restore into a second test database passed. The earlier PostgreSQL 15 installation/data was not upgraded or removed.
- 122 backend tests passed on PostgreSQL 18/PostGIS with no skipped tests; 12 desktop/mobile portal tests passed. Type checks, builds, migration checks and restore verification passed.
- Production dependency audit: zero advisories at the last check. Full audit still reports 18 advisories in development tooling. No force downgrade was applied.

## Deployment and access

Google WeatherNext dataset access is pending. No real BigQuery or Gemini call has been claimed. Configure the project/dataset/runtime identity after approval; an owner email is not a project ID.

Current target: **Railway**, with isolated staging and production. Use the [production runbook](railway-production-deployment-runbook.md) and [data migration/recovery record](railway-data-migration-and-recovery.md). Obsolete hosting guides have been deleted/replaced; runtime code, provider-specific configuration files, secrets, cloud resources and DNS were not changed in this documentation task.

The current API still needs trusted-proxy/rate-limit configuration, scoped operational cutover, automatic forecast scheduling and durable operational monitoring. Volunteer mobile RevenueCat integration exists, but backend entitlements and web/desktop billing are incomplete. Both apps' operational repositories still use local demonstration state; Android volunteer Firebase exists but the backend gateway and authenticated live repository graph remain incomplete.

The existing PostgreSQL 17.2 source without PostGIS is migration input, not a compatible target runtime. Its preserved-data rehearsal and immutable-ID requirements are retained in the migration record. Existing public services remain where they were until a separately verified cutover.

The backend Mapbox public token is present in the local ignored environment and was used successfully without printing it.

## Work still required

Use the complete seven-stage roadmap, API/screen/data registers and manual decision ledger for all remaining work. In particular, legacy operational service cutover, enterprise/platform workflows, the other hazard providers and impact models, sensing/relay, FCM/safety/media, mobilization and the full native/admin screen matrices remain unfinished. Provider access and passing tests do not substitute for those code deliverables.
