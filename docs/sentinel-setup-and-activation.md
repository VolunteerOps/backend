> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Sentinel setup and activation

Updated 30 September 2026. This guide follows [the authoritative scope](volunteerops-sentinel-disaster-engine.md). It is an implementation checkpoint, **not a full-scope completion or production certification**.

Hosting update, 1 October 2026: use the [Railway production runbook](railway-production-deployment-runbook.md) and [seven-stage platform roadmap](resq-production-implementation-roadmap.md). Provider-specific deployment instructions below have been replaced; recorded implementation evidence remains historical.

## 1. What is already prepared

- Backend Firebase identity/session boundary, organization admission and RLS, device consent/heartbeat receipts and durable workers.
- PostgreSQL ownership columns/composite constraints for legacy operational records. Unassigned legacy rows are quarantined; their unsafe global APIs still return `503 TENANT_MIGRATION_REQUIRED`.
- WeatherNext **3** BigQuery adapter, hourly normalization, bounded queries, stored forecast revisions, region policy, refresh jobs, insights and a scoped Gemini evidence assistant.
- USGS ingestion and revision-aware regional observations. A successful read-only smoke check accepted 219 revisions on 30 September.
- ResQ Mapbox portal at `/sentinel/`, with hourly timeline, variable/statistic controls, optional terrain, accessible lists, source timestamps and no-data/stale states.
- Admin and volunteer web entry points expose the portal through their existing Kotlin/Compose navigation. Admin web geographic maps use the real Mapbox adapter. Native map SDKs and live native repositories remain unfinished.
- Browser account creation/email verification, Google/Apple/Facebook/Microsoft/allowlisted enterprise sign-in, TOTP enrollment/challenge and invitation acceptance are implemented. Provider configuration and positive live sign-in verification remain required.
- Existing API/worker entrypoints and client build mechanics are inputs to the proposed Railway service configuration; old provider templates are retired deployment targets.

The Google dataset application is pending. The Google account supplied by the owner identifies who will configure the project; it is **not** a Google Cloud project ID, dataset ID or service account.

## 2. Verify the local installation

A separate PostgreSQL **18.6** instance with PostGIS **3.6.2** was installed under the ignored `.sentinel-test-pg/` directory. It uses loopback port **55440** and disposable databases `sentinel_test`, `sentinel_restore_test` and `sentinel_final_restore_test`.

This did **not** upgrade an existing Windows PostgreSQL 15 service or overwrite the older `.sentinel-test-pg/data` directory. A real existing installation still needs its administrator connection, inventory and reviewed backup/restore cutover.

PowerShell, from the backend directory:

~~~powershell
& .sentinel-test-pg/tools/pg18/pgsql/bin/pg_ctl.exe -D .sentinel-test-pg/data18 -l .sentinel-test-pg/server18.log -o '-h 127.0.0.1 -p 55440 -c timezone=UTC' -w start
$env:SENTINEL_TEST_DATABASE_URL = 'postgresql://sentinel_test_owner@127.0.0.1:55440/sentinel_test?sslmode=disable'
npm ci
npm run build
npx prisma db migrate --db $env:SENTINEL_TEST_DATABASE_URL
npx prisma db verify --db $env:SENTINEL_TEST_DATABASE_URL
npm test
npm run test:types
npm run test:portal
npm audit --omit=dev --audit-level=moderate
& .sentinel-test-pg/tools/pg18/pgsql/bin/pg_ctl.exe -D .sentinel-test-pg/data18 -m fast -w stop
~~~

Do not start an already-running cluster. This isolated cluster uses local trust authentication for disposable tests; it must never listen on a public interface or contain operational data.

Browser tests use installed Microsoft Edge on Windows. On Linux run `npx playwright install --with-deps chromium` first. The test server runs on loopback port 47831.

Prisma **8** remains the sole migration owner. Prisma 7 generates the compatibility client only. Ten migration packages, including the baseline, were applied and verified. Current contract hash: `7f31e09af996268dfba89c50a537d7876f490d9ba042aec960791ff55ff28b21`. The existing `db` migration ref was not advanced. When authoring the next migration, chain explicitly from this reviewed head.

Custom-format backups were restored into `sentinel_restore_test` and, after the retention migrations, `sentinel_final_restore_test`; full contract verification passed after restore. This is evidence for the new disposable database, not a backup of any older user database.

## 3. Prepare Google Cloud while dataset access is pending

1. In the Google Cloud console, sign in with the owner's Google account and select or create the intended project. Record its **project ID**, not its display name or owner email.
2. Link billing, set billing alerts, and enable the BigQuery API. Add the Analytics Hub API if the WeatherNext subscription workflow requires it.
3. Create a dedicated runtime service account for forecast queries. Grant BigQuery Job User on the query/billing project. Grant only the dataset read permissions required by the linked WeatherNext dataset.
4. Keep the Google application/request reference. When approval arrives, verify that the **runtime service account** can access the dataset; approval for a human email does not establish that automatically.
5. Leave `WEATHERNEXT_ACCESS_ENABLED=false`. No BigQuery queries are made by the disabled integration.
6. Review the applicable real-time experimental-data terms and attribution/retention requirements before enabling live use. The code does not accept provider terms on your behalf.

Primary references: [WeatherNext access](https://developers.google.com/weathernext/guides/access-forecast), [models](https://developers.google.com/weathernext/guides/models), [BigQuery](https://developers.google.com/weathernext/guides/bigquery), [GCS](https://developers.google.com/weathernext/guides/gcs).

The implemented path is **BigQuery**. GCS/Zarr is an alternative in the requirements, not an implemented fallback. VMG managed-inference documentation currently describes WeatherNext 2; do not configure it as a WeatherNext 3 endpoint.

## 4. Connect WeatherNext after approval

1. Subscribe to the approved listing and create the linked dataset in the intended project, following Google's access guide.
2. Confirm the linked table `weathernext_3_0_0_0p1deg` exists. The adapter reads `init_time`, point `geography`, and nested `forecast` records with `time`, `hours`, and the six statistics for temperature, wind and hourly rain.
3. Set these values on **both the API and forecast worker**:

~~~dotenv
WEATHERNEXT_ACCESS_ENABLED=true
WEATHERNEXT_PROJECT_ID=<query-and-billing-project-id>
WEATHERNEXT_DATASET_ID=<linked-dataset-id>
WEATHERNEXT_LOCATION=US
WEATHERNEXT_MAX_BYTES_BILLED=<explicit-per-query-byte-budget>
~~~

4. Supply Application Default Credentials to the forecast worker. On Railway, implement the reviewed secret-materialization wrapper described in its runbook: write the injected JSON credential to a permission-restricted ephemeral file and set `GOOGLE_APPLICATION_CREDENTIALS` to that path; no automatic secret-file mount is assumed. Prefer an appropriately configured federation mechanism if available. Never commit the credential or paste it into chat.
5. The API can keep its Firebase service account: it validates query configuration and queues requests; the forecast worker performs the billed query with its own credential.
6. Start the forecast worker with `node dist/workers/forecast.worker.js`, after configuring it as the forecast service in the intended Railway environment.
7. Sign into the portal using an active coordinator/admin membership and recent TOTP. Select a region and request a published UTC initialization.
8. Confirm queued → completed, run initialization/retrieval/expiry, values and attribution. Test a deliberately inaccessible dataset and an exceeded query budget: they must not create a successful forecast.

The adapter selects only three variables: temperature at 2 m, wind speed at 10 m and hourly precipitation. Kelvin becomes Celsius; precipitation metres become millimetres. It preserves missing values. The table supplies ensemble statistics; the portal does not manufacture individual ensemble members.

Synoptic 00/06/12/18 UTC runs allow up to 360 lead hours; intervening hourly runs allow 48. One request covers at most 48 forecast hours, 25 square degrees and 10,000 returned cells. Overflow fails explicitly; **regional tiling and large-area raster serving are still unfinished**. Start with small operator-defined regions and shorter windows. Every query has a configured byte ceiling (maximum supported configuration: 10 GB), timeout and cancellation.

There is no autonomous forecast scheduling yet: refreshes are coordinator-requested. WeatherNext access alone does not finish the broader disaster models.

## 5. Configure Firebase / Identity Platform

1. Select the shared Firebase project, enable the required sign-in providers and verify their OAuth redirect/domain settings.
2. Upgrade/configure Identity Platform where required for TOTP and institution SAML/OIDC providers.
3. Set backend `FIREBASE_PROJECT_ID` and provide a narrowly scoped Admin SDK service-account secret file through `GOOGLE_APPLICATION_CREDENTIALS`. Configure its permission to verify revoked sessions, create session cookies and revoke refresh tokens.
4. Register the browser app and set public values:

~~~dotenv
FIREBASE_WEB_API_KEY=<Firebase-web-API-key>
FIREBASE_WEB_AUTH_DOMAIN=<authorized-auth-domain>
FIREBASE_WEB_APP_ID=<Firebase-web-app-id>
FIREBASE_ENTERPRISE_PROVIDERS=oidc.approved-institution,saml.approved-partner
~~~

5. Configure OAuth providers Google, Apple, Facebook and Microsoft separately. Adding a button/provider identifier does not configure that provider's credentials.
6. Include the exact portal/API origin and both app origins in `CORS_ORIGIN`, comma separated. Wildcards do not satisfy the session CSRF guard.
7. Open the portal in a full browser page for the first sign-in. Create an account, verify the email, complete the unassigned profile, and set up an authenticator. Then sign in again with TOTP.
8. Bootstrap the first platform owner using the reviewed operator flow in [platform owner setup](platform-owner-bootstrap.md). No public role field or social provider grants ownership. Legacy email collisions require reviewed identity binding.
9. Provision/activate/verify organizations, issue recipient-bound invitations and accept them using the portal's account controls. Current owner operations are APIs/operator tooling; the complete platform console remains unfinished.

Browser requests use an HttpOnly Firebase session cookie. Firebase SDK persistence is memory-only. Privileged requests require TOTP and sign-in within five minutes. An expired/invalid cookie can still be cleared through the origin-protected logout route.

For embedded sign-in, use same-site HTTPS custom domains, for example API/admin/volunteer subdomains of a domain you own. Unrelated platform-generated hostnames can be treated as different sites by the browser, blocking the session cookie inside an iframe. The app provides **Open Sentinel in a full page** as a working alternative. Do not loosen cookie/CSRF protections to bypass this.

## 6. Configure Mapbox

The backend `.env` now contains the owner's `MAPBOX_ACCESS_TOKEN`. Its value was not printed or added to tracked files. The portal exposes only a `pk.` public token; `sk.` secret tokens are rejected by the public configuration endpoint.

1. Restrict the public token to the deployed portal origins and required Mapbox scopes.
2. Set `MAPBOX_ACCESS_TOKEN` on the Railway API service.
3. Open `/sentinel/?view=map`. Check geographic tiles, attribution, navigation and responsive sizing.
4. In the full forecast view, enable terrain and test layer visibility and the accessible list.
5. Confirm account/organization/region switches clear old overlays, chat answers and lists.

The style is copied from the existing landing site's ResQ style. Mapbox terrain uses the existing elevation source and exaggeration 1.5. A live local check rendered the map with 27 successful Mapbox responses and no failed responses. Native Android/iOS SDK adapters and offline packs remain unfinished.

References: [Mapbox documentation MCP](https://mcp-docs.mapbox.com/mcp), [terrain](https://docs.mapbox.com/mapbox-gl-js/example/add-terrain/).

## 7. Configure the evidence assistant

Set these **server-only** values on the API:

~~~dotenv
SENTINEL_GEMINI_API_KEY=<server-secret>
SENTINEL_GEMINI_MODEL=<available-Gemini-model-identifier>
~~~

Select a model available to your Google account that supports the generateContent function-calling API. The implementation has no assumed default model or fabricated provider access.

The assistant has bounded read tools for the current authorized forecast region. It rechecks database authorization before tools and before returning a response. It cannot issue warnings, edit records or deploy volunteers. Responses include server-collected source revisions and `requires_human_review: true`. Private rosters, precise responder locations and bearer tokens are not sent to the model.

Review your institution's use of an external model for forecast evidence and operator questions. Live Gemini behavior has not yet been verified.

## 8. Prepare Railway

Follow the [Railway production deployment runbook](railway-production-deployment-runbook.md) for the authoritative service topology, database TLS/roles, migrations, buckets, workers, app builds, domains and provider configuration. Stage 1 establishes staging; Stage 7 performs the approved production cutover. Preserve source data using [migration and recovery](railway-data-migration-and-recovery.md).

Current script/configuration names tied to the old provider remain implementation cleanup items, not active hosting instructions. No Railway resources or runtime credentials were changed by the documentation migration. Configure actual project/environment IDs before executing cloud commands; do not reuse identifiers from the former provider.

## 9. API integration inventory

All paths below require a current Firebase identity, active membership and permitted region unless explicitly public:

| Endpoint | Purpose |
| --- | --- |
| GET /sentinel/config | Allowlisted public browser configuration only |
| GET /api/me/memberships | Admission state, organization capabilities and separate platform grant |
| GET /api/organizations/:orgId/sentinel/regions | Authorized active regions and forecast policy |
| PUT /api/organizations/:orgId/sentinel/regions/:regionId | Organization-admin region/policy creation or next-version update |
| POST .../regions/:regionId/forecasts/refresh | Bounded coordinator/admin forecast request |
| GET .../regions/:regionId/jobs/:jobId | Authorized refresh job status |
| POST .../regions/:regionId/jobs/:jobId/retry | Audited failed/expired refresh retry with current authorization and renewed fencing |
| GET .../regions/:regionId/forecasts/latest | Current revision, hourly cells, freshness and unvalidated assessment |
| GET .../regions/:regionId/insights | Volunteer-oriented coverage/indicator summary |
| GET .../regions/:regionId/hazards | Latest USGS revisions within the region |
| POST .../regions/:regionId/agent/chat | Read-only coordinator/admin evidence assistant |

See [organization admission](sentinel-organization-admission.md) and the device API/controller for member devices, versioned consent, revocation and bounded heartbeat receipts.

## 10. Remaining implementation and verification

None of the seven steps is fully closed.

1. **Foundation:** complete ownership backfill tooling and scoped replacements for all legacy operational APIs, storage/exports/streams; close retention/replay/observability and deployment validation.
2. **Enterprise:** full tech-admin/organization UI, DNS verification, enterprise reconciliation, imports/join requests, transactional email, native auth and real provider journeys.
3. **Intelligence:** additional providers (GDACS/FIRMS/CAP/GloFAS/gauges/Google Weather), source health/checkpoints, forecast tiling/scheduling and provider-specific retention, calibrated impact/risk models, licensed exposure datasets and seasonal campaigns.
4. **Sensing/relay:** Android acquisition, acoustics, correlation, validated arrival estimates, signed/encrypted Nearby multi-hop transport and physical-device tests.
5. **Volunteer workflows:** live native repositories, FCM, safety/SOS/check-ins, field/media sync, native maps/offline packs and the full screen matrix.
6. **Mobilization:** eligibility/reservations, cross-organization assignment uniqueness, audited atomic approval, access constraints and coordination grants.
7. **Command/release:** remaining operational screens, platform activation controls, end-to-end drills, performance, platform/device verification and production release evidence.

Forecast thresholds remain unvalidated. There are no automated official warnings, tsunami declarations, movement orders or deployment decisions from this slice. Expiry hides forecast data immediately; the bounded retention job deletes expired forecast rows and ingress receipts. Terminal job payloads are scrubbed after seven days, while audit records and idempotency keys remain. Schedule and monitor cleanup before live ingestion; provider-specific retention terms, backups, legal holds and full lifecycle retention still need review.
