> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Google Weather setup and licensing skeleton

> 30 September 2026 update: see [Sentinel setup and activation](sentinel-setup-and-activation.md) for the implemented WeatherNext 3 BigQuery path, Mapbox portal, scoped endpoints, PostgreSQL 18/PostGIS verification and current Railway deployment target. Earlier baseline claims below are historical; the remaining full-scope requirements still apply.

Step 1 documentation; trace S03/S08/S10 in the [specification](sentinel-implementation-plan.md). **Retrieval, processing, display, derivation and retention remain disabled pending approval and implementation. No paid resource or live use authorized.**

| State | Current evidence |
| --- | --- |
| Implemented | Specification/checklist only. Proposed provider/service/content-store/policy controls are future work, not an existing adapter. |
| Owner action | Obtain applicable contractual permission and approved Cloud project/server credential/budget/region/data inputs below. |
| Blocked | Licensing for intended risk/high-risk/Mapbox/ML uses, implemented expiring store and policy gates, validated regional features and owner setup. |
| Verified | No account terms, API call, billing setup, coverage, retention purge/restore or model improvement verified here. |

## Owner inputs and actions

All values `REQUIRED`: customer agreement/billing jurisdiction including EEA applicability; written permission or legal review for disaster/high-risk use, risk derivation, display with/near Mapbox and any model train/test/validation; retention/backup/delete rules by content class; attribution; Cloud project ID/billing owner; API credential secret reference and allowed runtime egress restrictions; region IDs/sampling points/basins/facilities/staging sites; area/point/cadence/concurrency/pagination/spend caps; quota alert owner; independently licensed validation/antecedent-history datasets.

Only after authorization: select billing-enabled Cloud project, enable Weather API, create least-privilege API-restricted server credential with supported restrictions, set quotas/budget alerts and approve sampling coverage. Proposed adapter location is `src/modules/sentinel/providers/google-weather.provider.ts`; config belongs in parent-owned `src/core/config.ts`/deployment secrets once implemented. **No accepted Weather environment keys exist by virtue of this document.** Never embed server credentials in either app, logs, public URLs or source.

Consult actual [Weather policies](https://developers.google.com/maps/documentation/weather/policies), [Maps terms](https://cloud.google.com/maps-platform/terms) and [service terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) at activation. The primary plan records restrictions on derived content, ML, non-Google maps and High Risk Activities; this skeleton is not legal approval. Disclaimer/separate panel is not a workaround; if blocked, retain Mapbox and independently licensed sources, not a silent paid replacement.

## Required implementation policy

- Independent policy flags for retrieval/processing/display/derivation/retention fail closed. Sample configured points rather than each volunteer; deduplicate/bound queries and isolate weather failures from urgent sensor work.
- Reviewed API maxima: current conditions, hourly forecasts up to 240 hours, daily up to 10 days, hourly history only 24 hours. These are not guaranteed regional coverage/update rates or seasonal antecedent data. Alerts require issuer/area/expiry/schema/coverage verification.
- Preserve units/accumulation periods/precipitation probability, temperature/humidity/wind/gust/direction/pressure, location/coverage and actual observation/retrieval/validity/issuance when supplied. Never invent issuance; surface/sea-level pressure differs.
- Flood uses gauges/GloFAS/basin/soil/drainage; landslide needs licensed longer antecedent history/slope/susceptibility; fire-weather needs fuel/drought and official/FIRMS evidence; storm needs national warnings/tracks. No universal flood conversion, ignition proof or correlated-forecast double votes. Weather cannot increase seismic confidence, predict earthquake/tsunami or create arrival countdowns.
- Start with explainable shadow features; calibrated probability needs held-out regional/hazard evidence and weather/no-weather comparison. Precipitation probability is not disaster probability. Google content cannot be training/testing/validation input without explicit permission; use synthetic fixtures and independently licensed datasets.

## Retention gates — recheck before activation

The primary plan's reviewed **non-EEA** ceilings were: current/hourly forecast/public alerts 1 hour; daily forecast 24 hours; today's forecast values 30 days; hourly history 240 hours. These are content-specific ceilings, not refresh schedules or permission to retain mixed responses at the longest interval. Recheck customer/EEA/product terms; mixed fields use shortest limit unless segregated.

Use isolated expiring content storage with license-compatible backup/deletion and restore-time expiry. Do not copy expiring values into permanent hazard revisions, notifications/outbox, logs, exports, analytics or mobile offline caches. Keep audit metadata/derived features only where expressly permitted and label assessments no longer replayable. Purge policy needs tests across all copies, not merely a table TTL. Attribution is required wherever permitted content is shown; no speculative weather-tile overlay.

## Verification and recovery — not performed

No implemented provider/test command is available from this skeleton; raw credential-bearing request commands are intentionally not invented. After policy/adapter implementation record the exact synthetic fixture suite and sanitized readiness/coverage commands. Cases: policy-disabled/no request, missing fields/units/times, insufficient history, stale/429/outage, caps/pagination/concurrency, correlated evidence, weather cannot affect seismic confidence, expiry/log/export/mobile/restore purge and prohibited display suppression. Then an owner-authorized bounded real request confirms actual coverage/quota/attribution, not scientific benefit.

On revocation/terms change/credential compromise disable affected use, rotate server credential, purge content under applicable policy and revalidate before restart; preserve only permitted audit metadata. Remaining blockers are every required agreement/value, expiring-store implementation and validation/real coverage evidence. No production activation approved.