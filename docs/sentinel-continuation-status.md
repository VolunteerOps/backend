# Sentinel continuation — 30 September 2026

The authoritative scope is [volunteerops-sentinel-disaster-engine.md](volunteerops-sentinel-disaster-engine.md). The detailed setup and verification guide is [sentinel-setup-and-activation.md](sentinel-setup-and-activation.md).

**0 of 7 steps are fully complete.** Steps 1–3, 5 and 7 have implementation slices; Steps 4 and 6 still need their core operational implementations. This checkpoint supersedes the older 72/94/105-test records and their claims that PostgreSQL tooling and all client work were unavailable.

## Implemented and verified

- Firebase HTTP/session authentication, identity binding, organization admission/RLS and durable identity work from the prior checkpoint remain in place.
- Device registration, versioned opt-in consent, revocation, bounded deduplicated heartbeat receipts and a fenced device worker.
- Organization/region ownership columns, composite foreign keys and RLS for operational tables. Legacy null ownership stays quarantined; old global operational endpoints remain gated.
- WeatherNext 3 BigQuery provider, hourly/unit/percentile validation, query budgets, forecast refresh worker, immutable forecast revisions, region policies and admin/volunteer insight endpoints.
- Read-only scoped Gemini evidence assistant, with source collection and authorization rechecks.
- Bounded expiry cleanup for forecasts and ingress receipts, seven-day terminal job payload scrubbing, immutable-data RLS checks and a separate maintenance login.
- USGS revision ingestion/source worker and region-filtered latest observations; live feed smoke check accepted 219 revisions.
- ResQ Mapbox web portal with time/statistic controls, 3D terrain, accessible list, region configuration and unavailable/stale states. Live map rendering succeeded.
- Browser enrollment, email verification, TOTP, social/enterprise sign-in and invitation controls are implemented; live identity-provider success paths remain unverified.
- Admin and volunteer apps now have Sentinel navigation and web adapters. Both JavaScript/Wasm compilations, production JavaScript distributions, public portal URL injection and common JVM tests passed. Native adapters remain unavailable and say so.
- PostgreSQL 18.6/PostGIS 3.6.2 installed into an isolated loopback test environment. All ten migrations applied, full schema verification passed, and backup/restore into a second test database passed. The earlier PostgreSQL 15 installation/data was not upgraded or removed.
- 118 backend tests passed on PostgreSQL 18/PostGIS with no skipped tests; 12 desktop/mobile portal tests passed. Type checks, builds, migration checks and restore verification passed.
- Production dependency audit: zero advisories at the last check. Full audit still reports 18 advisories in development tooling. No force downgrade was applied.

## Deployment and access

Google WeatherNext dataset access is pending. No real BigQuery or Gemini call has been claimed. Configure the project/dataset/runtime identity after approval; an owner email is not a project ID.

Render target: **With Intent / Volunteer Ops**. Render MCP is now connected and authenticated through browser OAuth. With Intent and its existing volunteerops-backend/resq-web services were verified; no Render PostgreSQL instances or admin/volunteer services were returned. The backend live revision is still the September 10 commit. Proposed pilot Blueprint, runtime/retention grants and client build scripts are prepared. No Render resource changes, migrations, deployments, Git commits or pushes occurred.

The backend Mapbox public token is present in the local ignored environment and was used successfully without printing it.

## Work still required

Use the final section of the setup guide for the seven-step gap inventory. In particular, legacy operational service cutover, enterprise/platform workflows, the other hazard providers and impact models, sensing/relay, FCM/safety/media, mobilization and the full native/admin screen matrices remain unfinished. Provider access and passing tests do not substitute for those code deliverables.
