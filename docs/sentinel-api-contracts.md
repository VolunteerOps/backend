> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Sentinel API contracts â€” Step 1 skeleton

> 30 September 2026 update: see [Sentinel setup and activation](sentinel-setup-and-activation.md) for the implemented WeatherNext 3 BigQuery path, Mapbox portal, scoped endpoints, PostgreSQL 18/PostGIS verification and current Railway deployment target. Earlier baseline claims below are historical; the remaining full-scope requirements still apply.

> Current code and verification: [organization admission and RLS](sentinel-organization-admission.md). The inventory below remains the full target scope; older implementation-status statements are superseded by that record.

> Current implementation: [13 September continuation](sentinel-continuation-status.md). The earlier baseline below is historical where it describes local JWT authentication, missing Firebase HTTP mappings, or absent identity workers. Organization isolation, live client integration and the disaster engine remain unfinished.

Status: **Firebase/Sentinel contracts remain planned, not implemented routes or published OpenAPI**. The implemented foundation health/readiness boundary is listed separately below. Foundation infrastructure is partial; no production cutover authorized. Trace: specification S03/S04/S06/S08/S09 and primary plan â€œAPI and admission contractâ€, â€œRecords and contractsâ€, â€œAPI additionsâ€. See [specification and evidence rules](sentinel-implementation-plan.md).

## Implemented foundation boundary

| Endpoint / component | Current behavior and limits |
| --- | --- |
| `GET /api/health` | Basic API liveness; used by Dockerfile. Does not certify database or Sentinel readiness. |
| `GET /api/ready` | HTTP 200/503 for `database_prerequisites` only: PG18, PostGIS, nonprivileged non-owner runtime role and TLS. Does **not** certify migrations, tenant isolation or Sentinel readiness. No fuller response schema is asserted here. |
| Firebase verifier/session/revoke-all adapter | Lazy Firebase Admin ADC identity verification is implemented, but **not wired to HTTP**. Bootstrap/session/CSRF routes and database identity mapping remain planned. Sanitized identity carries no grants. |
| Existing legacy authentication | Local JWT remains active pending reviewed cutover. Public signup schema/service reject privileged roles; middleware refreshes database account role/status each request, removes admin/implicit `SUPER_ADMIN` bypasses and returns 503 on DB failure. This is not tenant authorization or Firebase cutover. |

The final foundation suite passed 72 tests, including HTTP smoke checks; type checking and the build passed. No real PG18/PostGIS/container verification ran. Detailed [evidence and blockers](sentinel-implementation-plan.md#current-partial-step-1-baseline) are separate from the future endpoint inventory.

## Planned common contract requirements

- Preserve existing serialization/naming conventions after inspecting handlers; publish versioned OpenAPI and shared JSON fixtures during affected implementation stages. Exact schemas, version transport, pagination, idempotency-header names, error bodies and numeric limits remain to be finalized, not inferred from this table.
- Native Firebase bearer ID tokens and web Firebase session cookies identify the caller; PostgreSQL resolves current active user, organization/unit/region/capabilities and authentication assurance. Body/query organization IDs cannot grant scope. Bootstrap accepts verified identity without a mapping but grants no operational access. Public discovery must not enumerate private/inactive partners.
- Enforce strict Zod allowlists/units/bounds, request and per-item limits, rate/organization quotas, ownership, composite constraints and RLS. Final batch/window/rate limits are required inputs to implementation and load tests. Reject oversized input before expensive verification/correlation.
- Mutations need idempotency keys, expected versions where state can race, atomic state/audit/outbox writes and structured conflicts. Define key retention and same-key/different-payload rejection. Add required CORS headers only for explicitly permitted origins. Sensitive actions reauthorize inside their transaction.
- Stream snapshots/replay are scoped and authenticated; expiry, revocation and membership changes close/recheck streams. Cursor gaps require explicit resnapshot. Durable rows/polling recover lost notifications; a cursor is not permission.
- Return admission errors after appropriate authentication: `ORG_NOT_ACTIVE`, `ENROLLMENT_PENDING`, `MEMBERSHIP_REQUIRED`, `SSO_REQUIRED`, `MFA_REQUIRED`, plus stale-version conflicts. Public responses stay generic. Legacy unscoped mutation/list routes must be removed or safely scoped, not retained as bypasses.

## Planned endpoint inventory

Paths reproduce primary-plan targets; they do not assert availability or settled OpenAPI syntax.

| Family | Required behavior / authorization |
| --- | --- |
| `POST /api/auth/firebase/bootstrap` | Verified UID mapping, idempotent minimal unassigned identity, no public role grant. Not platform-owner bootstrap. |
| `POST /api/auth/session`, `DELETE /api/auth/session` | Recent-auth Firebase web cookie exchange/clear, CSRF/origin protection and revocation rules. |
| `GET /api/auth/me` | Current profile, platform capabilities, memberships, allowed contexts and assurance; no permission authority from custom claims. |
| `POST /api/partnership-requests`, `POST /api/auth/organization-discovery` | Bounded public intake/discovery; no automatic active workspace or privileged admission. |
| `/api/platform/organizations`, `/:id/activate`, `/:id/suspend`, `/:id/offboard` | Tech-admin lifecycle with expected version, idempotency, impact preview and audit. |
| `/api/platform/users`, grants, entitlements | Explicit owner capability, step-up, last-owner safeguards; global actions distinct from membership removal. |
| `/api/organizations/:orgId/domains`, enterprise connections | Activated-owner enrollment grant or scoped admin, exact domain/provider trust and secret references only. |
| `/api/organizations/:orgId/memberships`, invitations/imports/join requests | Scoped roster; import preview/per-row results, bounded grants, no global identity deletion. |
| `POST /api/invitations/accept`, `/api/me/memberships` | Verified recipient, single-use transactional acceptance and private context selection. |
| `/api/organizations/:orgId/coordination-grants` | Bilateral named incident/resource sharing, expiry/revocation and lead org. |
| `/api/organizations/:orgId/preparedness-campaigns`, milestones/readiness evidence | Scoped seasonal/region/validity references, owned milestones, revision/cancellation. |
| `/api/organizations/:orgId/bulletins` | Submit/review/supersede/cancel; second reviewer before manual bulletin can drive automatic outward warnings. |
| `/api/sentinel/regions`, sources/policies | Authorized geometry, source coverage, model gates, playbooks and versions. |
| `/api/sentinel/regions/:id/weather`, weather source health | Licensed/scoped context and unavailable/expired states, never arbitrary public weather proxy. |
| `/api/sentinel/hazards`, detail/revisions/zones | Public authoritative facts separate from private evidence/operational overlays; provenance/uncertainty/freshness. |
| `/api/sentinel/devices`, `/me/consents` | Enrolled credential/capability/consent lifecycle; app/environment-bound push registrations. |
| `POST /api/sentinel/sensor-observations/batch` | Authenticated origin, bounded compact feature windows; commit before per-item receipt. |
| `POST /api/sentinel/relay-envelopes/batch` | Authenticated forwarder plus independent original signature, consent/trust/expiry validation; accepted/duplicate/rejected per item. |
| `/api/sentinel/sensor-clusters`, hazard arrival estimates | Restricted aggregate candidates; validated recipient-specific absolute interval or unavailable reason. |
| `/api/sentinel/observations/batch` | Offline pre-assignment/manual reports and authorized media references; provenance, partial results, dedup and corroboration. |
| `/api/sentinel/me/heartbeats`, `/me/safety-checks` | Consent-aware eligible-baseline heartbeat and personal safety state. |
| `/api/sentinel/safety-checks/:id/responses` | Owner-only response, observed and received timestamps; one assistance case/escalation per relevant action. |
| `/api/sentinel/hazards/:id/mobilization-proposals` | Explainable demand/exclusions/shortages, willingness/reservation distinct from dispatch. |
| `/api/sentinel/mobilization-proposals/:id/approve` | Scoped recent-assurance approval, expected version, current hazard/credential/capacity checks and atomic deployment/audit/outbox. |
| `/api/sentinel/regions/:id/readiness` | Score components, capacity/shortages/completeness, freshness and version. |
| `/api/sentinel/stream?cursor=` | Scoped replayable event stream, reauthorization and resnapshot semantics. |

## Logical records and envelopes

Retain existing internal user IDs and references. Required records: organizations/units/memberships/scopes/platform grants/domains/connections/invitations/join requests/auth policies/entitlements/provisioning audit; hazards/source revisions/evidence/zones/exposure; devices/consents/feature windows/candidates/global receipts; model/calibration/arrival estimates; safety checks/responses/assistance; relay receipts; proposals/reservations/approvals/resources/readiness; campaigns/milestones/bulletins; durable jobs/outbox/stream events.

Add unique `FirebaseIdentity` project/UID mapping, session/revocation audit without duplicate Firebase refresh tokens, app/environment-bound `PushRegistration`, `WeatherQueryPoint`, expiring `WeatherSnapshot`, licensed `WeatherFeatureAssessment` and `ProviderUsagePolicy`. Names are logical until schema review. Weather content cannot be retained as permanent source evidence unless licensed.

Sensor envelope fields: `schema_version`, `message_id`, `device_credential_id`, `kind` (`MOTION`, `PRESSURE`, `ACOUSTIC`, `SAFETY_CANDIDATE`), `observed_at`, `expires_at`, `clock_uncertainty_ms`, coarse `location` cell/accuracy/age, `feature_version`, optional `model_version`, strictly allowlisted numeric `features`, `quality_flags`. Exact feature definitions/units/ranges require versioned schemas. Missing location is allowed only for non-spatial workflows. Immutable original device/message dedup keys survive partition changes and every transport/gateway. JSON identity fields do not authenticate the envelope.

Signed relay envelope adds protocol/message/origin credential, observation/expiry, recipient class, payload hash/signature and bounded hop metadata; encrypted payload remains opaque to peers. Specify canonical encoding, algorithm/key identifiers, rotation and signed backend receipt format before implementation. Local queue, peer custody and backend acceptance are distinct; gateway copies never become independent observations.

Arrival result contains absolute lower/upper times or an explicit unavailable reason, source/model/revision, generation/expiry, uncertainty and validity. Clients subtract current time/delivery age, invalidate superseded estimates and suppress expired/negative/poor-fit countdowns. Never return a fixed promised duration.

Delivery contract distinguishes queued, provider-accepted, device-received, human-acknowledged/responded and expired/failed/superseded states; final enum naming remains planned. FCM is not an evidence receipt or proof of safety. Only a verified signed backend relay receipt proves ingress acceptance, not hazard confirmation or help dispatched.

## Fixture and verification backlog

Required shared fixtures: A/B organizations, unassigned identity, tech admin; wrong issuer/assurance/revoked membership; UID/link collisions; cookie/CSRF; domain/invite replay and concurrent acceptance; scoped import/removal/global-delete separation; duplicate direct/relay batches with partial rejection; clock/location/feature bounds; stale/cancelled CAP/weather/arrival; geometry/dateline/zero coordinates; stream gap/revocation; concurrent cross-org responder approval and rollback; assistance dedup; campaign supersession and second-reviewer bulletin gate.

Publish runnable Firebase/Sentinel contract tests and OpenAPI when routes/schemas exist; the implemented foundation checks do not complete that backlog. No tests ran in this documentation task. **Blocked:** Firebase HTTP identity/session/CSRF integration, UID mapping/migration, organization/RLS and reused operational/storage/export/stream scoping, durable jobs/outbox/receipts/workers, remaining route/schema implementation, finalized limits/protocol formats, client workspace inspection and actual provider/device evidence. Owner configuration alone does not implement these contracts.# Sentinel API contracts (disaster engine)

Base mount: `/api/organizations/:orgId/sentinel` (auth required, `Cache-Control: no-store`).
This reconciles `volunteerops-sentinel-disaster-engine.md` unscoped routes with the
roadmap org-scoped register: the org-scoped mount above is canonical.

## Disaster engine endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/regions/:regionId/predictions` | Multi-source fused hazard predictions (cached 10 min). Runs without WeatherNext. |
| POST | `/regions/:regionId/predictions/refresh` | Coordinator only. Forces a fresh run, persists a `HAZARD_PREDICTION` snapshot + audit. |
| GET | `/regions/:regionId/sources` | Per-source health: enabled, status, observation count, keyless, reliability note. |
| GET | `/regions/:regionId/readiness` | Includes `disaster_engine` block (version, SHADOW mode, source registry). |
| GET | `/regions/:regionId/radar` | Pins include disaster-engine predictions (category `PREDICTION`). |
| GET | `/regions/:regionId/insights` | Existing WeatherNext indicator counts. Pair with `/predictions` for engine output. |

### Prediction shape

```json
{
  "status": "AVAILABLE|PARTIAL|UNAVAILABLE",
  "mode": "SHADOW", "validation": "UNVALIDATED_INDICATOR", "operationalWarning": false,
  "engineVersion": "disaster-engine/1.0.0", "generatedAt": "ISO-8601",
  "region": { "id": "uuid", "name": "Nairobi" },
  "predictions": [{
    "id": "pred-…", "hazard": "FLOOD|HEAVY_RAIN|HEAT|STRONG_WIND|STORM|WILDFIRE_WEATHER|LANDSLIDE|EARTHQUAKE",
    "kind": "PREDICTED|OBSERVED", "level": "MONITOR|WATCH|WARNING|SEVERE",
    "severity": 0.0, "confidence": 0.0, "evidenceScore": 0.0, "calibratedProbability": null,
    "longitude": 0, "latitude": 0, "validFrom": "ISO-8601", "validTo": "ISO-8601",
    "sources": ["OPEN_METEO"], "independentSources": 1,
    "explanation": ["rain 24h 62mm"], "missingInputs": ["river discharge / gauge level"], "evidence": ["OPEN_METEO:…"]
  }],
  "sources": [{ "source": "OPEN_METEO", "status": "OK|UNAVAILABLE|DISABLED|NOT_CONFIGURED", "observations": 5, "keyless": true }],
  "coverageGaps": ["…"], "disclaimer": "…"
}
```

## Sources and reliability

WeatherNext 3 (0.90, private, highest model weight) > USGS observed (0.95) / NWS official (1.00) >
GDACS (0.85) > ReliefWeb (0.80) > GloFAS (0.70) > Open-Meteo (0.60) > community (0.30).
Correlated copies (same upstream/external id, e.g. WeatherNext BigQuery + GCS) count once.
Contradictory evidence lowers confidence. `calibratedProbability` stays `null` and
`operationalWarning` stays `false` until held-out calibration + reviewer sign-off.

Keyless now: Open-Meteo forecast, Open-Meteo Flood/GloFAS, USGS, GDACS RSS, NWS (US only).
Needs config: WeatherNext (BigQuery/GCS access pending), ReliefWeb (approved appname).
Deferred: NASA FIRMS (MAP_KEY), Google Weather (licence review).
