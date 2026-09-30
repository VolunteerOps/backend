> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Mapbox setup skeleton

> 30 September 2026 update: see [Sentinel setup and activation](sentinel-setup-and-activation.md) for the implemented WeatherNext 3 BigQuery path, Mapbox portal, scoped endpoints, PostgreSQL 18/PostGIS verification and current Railway deployment target. Earlier baseline claims below are historical; the remaining full-scope requirements still apply.

Step 1 documentation; trace S07/S08/S10 in the [specification](sentinel-implementation-plan.md). **No Mapbox client integration, account configuration, billing or live activation completed here.**

| State | Current evidence |
| --- | --- |
| Implemented | Checklist and planned platform contracts only; no client workspace changed. |
| Owner action | Select approved account/terms/billing, real app/environment tokens/styles, supported restrictions and offline/usage budgets. |
| Blocked | Actual client source/dependency inspection, platform adapters, GeoJSON/authorization contracts, owner values and device/runtime evidence. |
| Verified | No real-token render, attribution, offline download, telemetry/privacy or routing check ran. |

## Required inputs and configuration placement

Record `REQUIRED` for account owner, environment/app IDs, Android/iOS SDK and GL JS versions compatible with actual clients, public runtime token per app/environment, style URL, allowed web origins/platform restrictions supported by that token type, attribution/telemetry policy, download area/zoom/storage limits, offline/usage budget and monitoring contacts. No values or supported app config keys are invented here.

Public least-scope runtime tokens/style URLs belong in inspected platform app configuration (Android resource/build config, iOS target config, JS/Wasm host config); final exact repository paths await client inspection. Any SDK-version-required secret download token belongs in developer/CI secret storage, injected only for dependency download, never committed Gradle files or bundles. Backend authorization tokens must never appear in map URLs. Public-token possession grants no backend permission.

Owner console actions: accept terms/billing, create styles/tokens for each environment, restrict scopes/origins where supported, approve usage/offline costs and telemetry disclosures/controls, configure spend alerts. No paid Directions/Navigation product is implicitly selected. Weather display/overlays near Mapbox remain blocked until [Google Weather policy](google-weather-setup.md) permits the exact use; a separate panel is not a loophole.

## Planned integration and verification

- Shared `MapViewport`, GeoJSON feature/selection contracts; Android Maps SDK/Compose, iOS native view bridge, GL JS host for JS/Wasm. No assumed common KMP SDK/native JVM renderer: reviewed isolated desktop GL JS host if compatible, otherwise coordinate/list fallback. No silent MapLibre substitution.
- Backend scoped paginated viewport data and PostGIS spatial analysis; map layers differentiate hazards, candidate/coverage, impact, assistance/resources/authorized positions and staging. Server validates lasso geometry and recipient authorization. Basemaps are not impact/population data or proof roads are safe.
- Preserve camera/lifecycle/disposal, list-map selection and accessibility/attribution. Never upload private responder/sensor data to Studio. Native supported offline packs only: explicit region/zoom/quota/progress/cancel/battery/Wi-Fi/eviction; only downloaded content works offline, no browser parity, tile scraping or Nearby pack redistribution.
- Routing requires separately approved licensing/cost and exclusion capability or validated graph. Unsupported road-closure avoidance returns unavailable and requires review, not a “safe” route.

No runnable Mapbox client check command is established before source/Gradle inspection. Record actual build/UI tasks later, with per-target evidence. Manual checks after approved setup: real token/style render in both apps, attribution/privacy controls, viewport authorization/A-B org isolation, invalid geometry, missing token/style and no-map fallback, lifecycle/resize/map-list equivalence, native offline quota/cancel/restart/airplane-mode, and prohibited weather layer suppression. Mock CI tests and compile success do not replace these checks.

Recovery/rotation: replace compromised tokens/styles by environment, verify permitted replacements and attribution, revoke old tokens through the console and assess cached/offline impacts. Fall back to labeled list/last-known data, not unauthorized tiles/providers. Remaining blockers: all required inputs, adapters, client access/devices, licensed routing/weather decisions and real checks.