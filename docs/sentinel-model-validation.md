> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Model and software validation — Step 1 skeleton

**Scientific, device and full-platform acceptance remain planned; no model is certified, no live sensor warning/countdown is authorized, and no tests were run for this documentation task.** Trace: specification S01/S03/S05/S08/S10 and primary plan “Validation and Release Gates”. [Evidence rules](sentinel-implementation-plan.md).

## Foundation software evidence — 13 September 2026

`npm test` passed all 72 tests, `npm run test:types` passed, and `npm run build` passed Prisma generation/emission and TypeScript compilation on Windows. HTTP smoke tests start the actual API on loopback; the Firebase SDK rejects local JWTs. Positive identity/revocation/session paths use mocks. The implemented foundation includes direct-PG configuration/readiness, standalone Firebase Admin verification/session/revocation adapters and legacy signup/auth hardening; Firebase HTTP cutover and identity/tenant models remain incomplete. See the [final evidence record](sentinel-implementation-plan.md#current-partial-step-1-baseline).

No Docker or `psql` was found. `npm run db:readiness` has not run against a real database; real PG18/PostGIS migration/RLS/container/restore acceptance is blocked. `/api/ready` checks `database_prerequisites` only, not migration, tenant or Sentinel readiness. The completed production dependency audit reported 17 vulnerabilities (10 moderate, 7 high); reachability review and remediation remain unresolved. Passing foundation tests cannot certify owner/provider configuration, tenant isolation, scientific validity or launch. See [remaining Step 1 work](sentinel-implementation-plan.md#next-coding-and-validation-work--step-1-only).

## Activation modes and promotion record

| Mode | Required meaning |
| --- | --- |
| `DISABLED` | No collection or relay. Default until configured, consented and approved. |
| `PILOT/SHADOW` | Consented acquisition, executable detection/estimation and restricted admin evidence; no public earthquake countdown or sensor-only disaster declaration. |
| `VALIDATED_LIVE` | Only approved source/model/region/device configurations may drive operational warnings. |
| `DRILL` | Isolated conspicuously labeled synthetic exercises; no real warnings or deployments. |

Every promotion needs model artifact/license/version/hash/label set; source/region/device coverage; dataset provenance/permissions/splits; thresholds and rejection rules; expert review; dated measured results; owner and approver; rollback/kill switch; unresolved limitations. Unknown or absent model remains unavailable. Confidence sliders, tech-admin privilege, passing unit tests and deadline pressure cannot certify a scientific model. Code completion, provider configuration and operational authorization are separate.

## Scientific acceptance backlog

| Area | Required evaluation and negative cases |
| --- | --- |
| Seismic candidates | Recorded events and matched non-events, distinct devices, handling/vehicles/construction/phone drops, stationarity/quality, background gaps, compromised origins, clock/location perturbations, sparse coverage. Measure precision/recall, false warnings, misses and detection latency. |
| Arrival estimator | Expert-reviewed source localization error, magnitude/intensity error where modeled, interval coverage, fit residuals, blind zones and end-to-end latency. Test uncertainty, nonpositive lead, expiry and revision suppress countdowns. No hard-coded duration. |
| Pressure/acoustic/safety | Sensor bias/elevation/indoor reference, benign sounds, device placement/activity and missing labels/models. Evaluate hazard-specific calibration and safety-prompt cancellation/escalation. Generic classifier performance is not hazard validity. |
| Flood/landslide | Basin/rain/gauge/soil/slope/susceptibility validity and incomplete inventories/history; no universal rainfall-to-inundation model. Lead-time revisions/cancellations and regional calibration. |
| Fire/storm | Weather risk is context, not proof of ignition/perimeter; pressure is not standalone storm forecast. Independent official evidence, false positives and track/coverage uncertainty. |
| Tsunami | Only trusted official warning/clearance sources; quake/phone clusters cannot authorize. |
| Weather increment | Same pipeline with/without weather on time/geography-held-out event/non-event data, leakage-free forecast vintages, precision/recall, false alerts, lead time and calibration. Correlated forecasts are not independent votes. Weather never raises seismic confidence; precipitation probability is not disaster probability. |

Use deterministic seeds where applicable. Synthetic fixtures establish software behavior only. Google Weather content must not train/test/validate models without explicit applicable permission; use independently licensed datasets and synthetic software fixtures. Record expired/unreplayable licensed inputs rather than silently retaining them. Domain experts must set numeric acceptance thresholds before live evaluation; none are approved here. Contradictions/low quality may lower confidence.

## Full backend acceptance backlog — not satisfied by checkpoint tests

- Disposable PG18/PostGIS migration/parity and pooled RLS context-reset tests, composite foreign-key isolation, non-owner runtime roles, A/B/unassigned/tech-admin fixtures across endpoints/workers/storage/exports/stream replay/caches/analytics; no private global nearby/roster enumeration.
- Extend standalone Firebase verifier and legacy auth tests into HTTP acceptance: wrong issuer/audience/expiry/revoked/disabled/unverified cases, UID/email collisions and linking attacks, concurrent bootstrap, preserved user relations, current role removal, cookies/CSRF/origin, legacy token rejection after authorized cutover. Local JWT remains active now. Emulator/mocks do not prove configured social providers/MFA/real revocation.
- Domain IDNA/lookalikes/shared disputes, expired/replayed challenges, activation races, forged/concurrent invitations/imports, first-admin elevation, wrong SSO issuer/provider/assurance, linked-social/password bypass, native callback security, recent-auth/MFA and unsupported-target fail-closed.
- One-time owner bootstrap/last-owner safety, scoped removal versus global deletion and self-service deletion/holds, provisioning partial failure/reconciliation, suspension during queued work/streams, handover and revoked offline actions. Sharing expiry, support audit, feature rollback and noisy-org fairness.
- FCM token rotation/logout/account/environment isolation, unauthorized recipients, payload privacy, quotas/retries, invalid tokens, expired/duplicate/reordered messages. Provider acceptance is not human receipt; real FCM/APNs/web push requires real configured devices.
- Weather missing fields/units/reference levels/time windows/history, 429/outages, query budgets, policy-disabled behavior, mixed retention, logs/exports/mobile copies/restore expiry; no prohibited Mapbox display/derived data.
- Sources malformed/untrusted/oversized/XML entities, source revisions/checkpoints/retries, CAP test/update/cancel/expiry, forecast-cycle change, missing licensed coverage and manual bulletin second-reviewer enforcement.
- Geometry meters/SRID, zero coordinates, dateline/boundaries/invalid shapes, missing exposure, overlapping hazards and stale road restrictions; no invented safe route.
- Sensor feature units/bounds, duplicate devices/gateways, replay/compromised origins, delayed/out-of-order data, clock/location error, insufficient coverage. Worker crash/lease/fencing, bursts/starvation/expiry, outbox replay and candidate/action dedup.
- Concurrent cross-org assignment/reservation contention, credentials/capacity/hazard changes, stale proposal version, expired sharing, repeated check-in/completion/cancellation and atomic audit/outbox rollback. Assistance dedup and no automatic deployment.
- Campaign issue/validity/county/basin scope, source supersession/cancellation, insufficient gauges/readiness blockers and worldwide seasonal differences; no ENSO/local-countdown conversion.

## Client, relay and operational evidence

The [Android handoff](sentinel-android-sensing-and-relay.md) owns detailed replay/radio/permission scenarios; [volunteer](sentinel-volunteer-implementation.md) and [admin](sentinel-admin-implementation.md) matrices own complete navigable user journeys. Verify actual routes, not just backend endpoints or marketing pages. Required viewports: 360/390, 600/768, 1067/1440 dp (CSS equivalents in browser), breakpoint boundaries, portrait/landscape/resizing, keyboard/insets, 130%/200% text/zoom, keyboard focus/semantics/contrast/reduced motion/map-list equivalence. Screenshots should preserve existing design. Loading/empty/error/offline/stale/denied/unconfigured/unsupported/conflict states are mandatory.

Build/test Android/common/JVM/JS/Wasm with actual documented workspace tasks after inspection. No invented successful Gradle commands or iOS parity; iOS requires macOS and device-specific checks. Physical A→B→C radio trials, battery/background behavior, actual FCM/SSO, real Mapbox/offline downloads and signed builds are separate evidence, not inferred from mocks or compilation.

## Proposed performance and recovery envelope

- 10,000 registered volunteers; 1,000 simultaneous clients; 1,000-device feature burst over 5 seconds; 10,000-recipient warning burst; no continuous raw waveforms.
- Proposed P95 accepted-observation → candidate update ≤1 second; policy-eligible warning → first gateway attempt ≤2 seconds. These are **unmeasured test targets**, excluding acquisition/network/provider/device latency. Measure authoritative-feed and geospatial latency separately; delayed relays cannot change observation time to meet a target.
- Trace observation → ingress → correlation → assessment → policy → gateway → device acknowledgement where available. Measure queue age/fairness/source lag/coverage/clock quality/expired evidence/relay age/uncertain delivery/false positives.
- Conditional recovery goals RPO ≤5 minutes / RTO ≤60 minutes need provider support and measured restore. Test no lost committed jobs on ordinary restart, no duplicate active assignments under contention, deployment validation and credential-free fail-closed startup.

**Unresolved:** models and licensed expert-reviewed datasets, numeric scientific acceptance thresholds, calibrated region/device coverage, foundations and test implementations, provider/customer approvals, hardware and macOS access, restore/load evidence and named operational approvers. Full-scope launch remains blocked; the desired two-to-three-week window is not a commitment.