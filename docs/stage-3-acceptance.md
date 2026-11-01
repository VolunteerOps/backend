# Stage 3 acceptance ledger

Stage 3 remains **not accepted**. Automated service tests, client compilation and public-entry browser checks establish different things; none substitutes for a real coordinator/volunteer session or inbox delivery.

| Requirement | Evidence implemented | Remaining work |
| --- | --- | --- |
| Scoped operations | Real PostgreSQL RLS, role/region denial, private-event filtering, idempotency receipts | Complete original-domain inventory and original-screen live repository cutover |
| Mission allocation | Publish/apply/assign/check-in/report/message/hour correction; capacity/responder/stock races | Recorded service intervals, overlap/timezone checks and remaining arrival/handover/manual-check-in workflows |
| Inventory | Atomic reservations, adjustments, transfers, release/consumption | Facility/location PostGIS editors and full map workflows |
| Reports | Shared submission, versioned coordinator review, scoped report links | Clean media attachment workflow, incident domain and durable offline drafts |
| Communications | Mission messages, same-mission replies and audited removal | Conversation presentation, unread cursors, broadcasts and delivery acknowledgements |
| Training | Ordered assessments, capacity/prerequisites, reviewed credentials, expiry/revocation, paginated prerequisite choices | Credential evidence/import, certificates and achievement rules |
| Support | Private cases, coordinator triage/replies/reopening, retry/privacy tests | Broader original Help screen cutover |
| Search/reporting | Authorized text search, bounded creation-date metrics, audited Pro summary CSV | Client search/chart/download screens, broader metrics and after-action review |
| Replay | Persisted events, identity/scope-bound encrypted cursors, snapshot boundary, checkpoints and missing-position resnapshot | Client subscription/resnapshot adoption and full stream acceptance |
| Offline | Explicit foreground refresh and pending command retry | Encrypted per-account native cache/outbox, safe draft synchronization, partial acknowledgement/backoff/conflict workflows |
| Notifications | No completion claim | Registration, durable inbox, FCM outbox/provider retries, invalid-token cleanup and device/human delivery states |
| Maps/platforms | Website/web and Android embedded map; bounded evidence and list fallback | Native Mapbox SDK parity, viewport/clustering/facilities and remaining iOS/JVM integration |
| Hosting | SPA deep links, real missing-asset 404, font/WASM MIME, no-cache HTML and immutable fingerprinted assets | Final release-specific browser checks recorded in the implementation ledger |
| Real-world acceptance | Automated service scenario and public staging health | Real Firebase accounts, coordinator TOTP, actual delivered invitation, signed native targets and provider evidence |

## Automated continuation evidence

- Backend final suite: 139 passed, zero failures or skips, including actual PostgreSQL isolation, report review/moderation, metrics and concurrent global quota reservations. Output: `.sentinel-deploy/stage3-stage4-final-tests.log` (ignored local artifact).
- TypeScript validation passed. OpenAPI inventory has 96 routes and its generated-contract check passed.
- Staging API deployment `96af5899-8a31-4d04-862a-be055f9ca459` is healthy. Readiness and catalog return 200; anonymous personal-usage and scoped-snapshot requests return 401.
- The new personal ledger migration and grants are live; the assistant still fails closed when provider/billing credentials are absent.

## Owner inputs observed missing

The ignored `.env` still lacks `FIREBASE_OPS_WEB_APP_ID`, `REVENUECAT_SECRET_API_KEY`, `SENTINEL_GEMINI_API_KEY` and `SENTINEL_GEMINI_MODEL`. `portal/google.png` is absent. Values were checked for presence only and were not printed. These inputs do not account for the unfinished engineering rows above.

[Implementation ledger](stage-3-implementation.md) | [Provider/manual guide](stage-3-manual-setup.md) | [Stage 4 implementation](stage-4-implementation.md)

## Client verification

Both shared JavaScript test suites and both Android debug compilations passed for the continuation. Volunteer Android was rechecked successfully with the preserved Ktor 3.5.1/explicit-engine configuration. Railway uses a separate `shared/build.web.gradle.kts` selected by settings, with Ktor 3.6.0 and Node tests; an earlier diagnosis that the native Gradle edit removed web-only support was incorrect.

The first final browser check timed out while downloading the 8.65 MB WASM asset. A longer trace confirmed the volunteer canvas renders without an uncaught JavaScript error. Negotiated gzip compression has been added to both hosting adapters and passed local decompression, q=0, HEAD, missing-asset and deep-link checks. Both compressed releases passed final public-entry rendering, zero page errors, no horizontal overflow, deep links, missing-asset 404s, MIME and compressed/immutable-asset checks. Exact deployment IDs are recorded in the implementation ledger. Authenticated workflow acceptance remains open.
