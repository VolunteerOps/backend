# Stage 3 implementation and release evidence

Status: **in progress; not fully accepted**. This stage also brings forward the specifically requested Pro billing and Sentinel work from roadmap stages 4 and 5. The controlling scope remains the seven-stage roadmap. Provider configuration and completed code are separate from end-to-end production acceptance.

## Implemented in this change

- Additive canonical operation-record, receipt and sponsorship migrations, including organization/region/user foreign keys, RLS, restricted runtime grants and immutable retry responses. Historical global operational routes remain gated; legacy rows are not assigned to an arbitrary workspace.
- Scoped mission draft/publish/activate/pause/complete/cancel; volunteer application/waitlist; coordinator assignment with shared responder reservations, mission version checks and serialized capacity; own-assignment check-in/completion; saved missions and withdrawal; reports/messages; actual submitted hours and separate coordinator approval/correction. A UUID Idempotency-Key makes repeated identical commands return the committed result and rejects key reuse with a changed payload.
- Inventory opening counts, reviewed adjustments, transfers and assignment reservations with an atomic stock ledger; shortages reject the entire assignment. Cancellation releases stock and mission completion consumes it once. Both clients include stock-transfer forms.
- Training authoring/publishing, prerequisites, serialized enrollment capacity, ordered assessed lessons and attempt throttling, coordinator completion review, expiring qualifications and revocation. Answer keys and personal progress are private; finishing a quiz does not self-certify a volunteer.
- Private support cases have coordinator triage, replies, resolution/reopening and versioned retries. Other volunteers cannot read the case or its event metadata.
- Durable operation events with bounded SSE replay, target-record authorization, periodic database reauthorization, connection lifetime and backpressure limits. The clients currently use foreground-only refresh and explicit mutation retry; they do not claim offline synchronization or FCM delivery.
- Shared live workspace screens in both applications, behind verified Firebase identity and profile setup. Production web entry points ignore the old embed flag. Old sample repositories remain only as isolated design/test code; public website practice routes redirect to the real apps and practice bundles are excluded from new website containers.
- Bounded responsive onboarding/auth forms, splash artwork, Google-only entry buttons, external Terms/Privacy links and persisted profile name/region/skills/availability/update consent. No welcome/login Sentinel or preview-setup buttons.
- Separate public Firebase configuration for volunteer and ResQOps browser registrations in the same Firebase project. App IDs never confer roles. Admin JS now uses the modular Firebase npm SDK. Native ResQOps Android adapters and RevenueCat KMP integration are added; provider registration and signed-device verification remain required.
- In-app upgrade entry and profile card; dismissible branded Pro screens using existing ResQ onboarding illustration, monthly/yearly/lifetime catalog and USD/KSh display. Store prices remain authoritative. ResQOps branding uses Papaya #E4D076 for Ops.
- Backend RevenueCat entitlement verification using the authenticated Firebase UID; expired/missing/refunded entitlements do not unlock Pro, and sandbox purchases require an explicit staging UID allowlist. Active grace and verified lifetime purchases are supported. Sponsorship is limited to three active seats per paying coordinator across workspaces; recipients must already be workspace volunteers. Sponsor membership, account activity and current paid entitlement are rechecked when sponsored access is used.
- Sentinel assistant accepts authorized volunteers as well as coordinators, receives the verified role, requires Pro, calls bounded evidence tools and never executes deployments. Durable daily allowance: 20 attempted queries per volunteer / 60 per coordinator across all workspaces and devices, resetting at midnight UTC (Stage 4 personal ledger). Missing provider credentials fail closed. Evidence tools also receive a bounded role-filtered mission/assignment/qualification/stock snapshot. Existing weather/hazard source freshness and uncertainty behavior is retained.
- Embedded Sentinel web and Android maps render bounded forecast and hazard points, time filters, attribution and a list equivalent. The frame accepts data only from configured parent origins and clears expired overlays. iOS/JVM/Wasm currently show the list fallback.
- Homepage and volunteer/coordinator pages contain responsive Pro catalogs and ResQ-specific artwork. Coordinator product is ResQOps. Pricing is explicitly awaiting store activation until live products are configured.

## Diagnoses

On 1 October, Railway reported volunteer deployment ec99c8d4-8bef-4763-8f65-c020a7476e9c and admin deployment e01a7b54-6480-4ab6-ab32-2e78870e6660: both predated the local Stage 2 Firebase integration. The shown "not connected yet" warning came from that older build.

The landing website /api/maps/config returned 503 and the backend /sentinel/config returned a null map token, while the ignored backend .env contained a public pk. token. The existing token has been synchronized to both staging services. A backend .env file does not automatically populate another Railway service.

## Verification and staging deployments

- Full backend suite: 138 passed, zero skipped, against disposable PostgreSQL 18. Subsequent focused PostgreSQL checks also passed for training assessment/capacity, support-case privacy/replies, atomic stock transfer/retries and private event visibility; the final TypeScript check passed.
- Canonical migration verification succeeded on staging at schema hash `6d00f9417e6f890944875849b1dac5ad1215ea821e8b88741f93f0459b04389a`. Migration deployment: `2e24c301-adab-4243-9de7-39b1e42cd424`.
- Final healthy staging deployments: API `4f8d6a23-071c-48bc-9e7f-b6fd09e00e91`, volunteer `d80ef9f3-19fe-45f2-bec5-d3add8aad3f2`, ResQOps `82fe4091-1566-4b0c-a195-db19efedae16`, website `ffdf1cfb-2247-43f2-907e-8c9c86cec85e`. API readiness returned HTTP 200 after deployment.
- Both deployed apps rendered at 360, 768 and 1440 CSS-pixel widths without horizontal overflow or uncaught JavaScript errors. The exact final releases also passed startup, SPA deep-link, missing-asset 404 and font/WASM MIME checks (10 volunteer and 9 coordinator assets). The website Mapbox canvas and new API Sentinel map widget loaded successfully. These checks do not substitute for signed-device purchase or inbox acceptance.
- Final shared JavaScript tests passed: volunteer 36 and ResQOps 27, with no failures or skips. Both final Android debug compilations passed with the public SDK keys loaded. The Node test harness emits Skiko WASM-loading warnings; those tests do not claim UI rendering coverage.
- RevenueCat MCP OAuth and official CLI OAuth succeeded. Account work is scoped to the existing ResQ project `projf7905c83`; unrelated projects were not changed. See [RevenueCat configuration evidence](stage-3-revenuecat-setup.md).
- The requested `backend/portal/google.png` remains absent. The exact Google icon integration requires that asset; Google-only sign-in controls are in place.

## Remaining implementation and acceptance

These are engineering work, not manual tasks delegated to the owner: complete original-screen repository cutover and durable encrypted native/offline cache/outbox; location/facility PostGIS editors and map clustering; credential evidence/import, certificates and achievement rules; report media/incident workflows beyond reviewed report links; messaging thread presentation/unread/broadcast acknowledgements; notifications/FCM; client search/analytics/export screens and broader reporting metrics; client stream adoption and full replay/resnapshot acceptance; mobile provider/map parity outside Android; RevenueCat browser checkout and durable webhook/reconciliation. Current Android maps use the embedded map adapter rather than the dedicated native Mapbox SDK. The live workspace is a connected implementation, not completion of every original operational screen.

Actual provider/store configuration and the full coordinator/volunteer acceptance scenario are still outstanding. The API checks authoritative RevenueCat state per request but does not yet implement the roadmap's durable billing reconciliation subsystem. No store charge, delivered invitation, calibrated disaster prediction or full Stage 3 acceptance is claimed.

Provider-only actions and the manual acceptance checklist are in [stage-3-manual-setup.md](stage-3-manual-setup.md). Stage 3 must not be marked complete until the remaining engineering work and roadmap acceptance scenario pass.

## Design references

Local Figma thumbnails were inspected; existing illustrated community/response artwork, blue/white surfaces and Papaya accents were retained. Mobbin references informed dismissible benefit-first plan selection, visible renewal terms and team sponsorship organization: [Duolingo manage subscription](https://mobbin.com/flows/e17a737c-b580-4a04-bbd7-c6d4651dc056), [Duolingo family upgrade](https://mobbin.com/flows/8127cf41-d878-4028-bd38-ed7621a4873b). No Duolingo assets were copied.

## Continuation: operational acceptance and Stage 4 foundation

Implemented after the initial release:

- AES-256-GCM opaque stream cursors bind identity, organization and region, expire after 24 hours, and fail on tampering or key rotation. `/operations/snapshot` captures a boundary before record pagination; SSE emits checkpoints for filtered events and requests resnapshot when the position disappears. Numeric reconnect cursors are retired. Clients still poll; stream-client adoption is not claimed.
- Coordinator report review with linked scoped reports, version checks and retry receipts; replies reference an available message in the same mission; coordinator moderation removes the displayed text and records an audit reason. Both shared apps have review/reply/moderation controls.
- Training authoring and report review now use paginated authorized course/report choices instead of raw IDs. Certificate/achievement workflows remain outstanding. Denied requests clear visible workspace records and region selection.
- Authorized record text search through the bounded list route; date-filtered metrics use creation timestamps and reject intervals exceeding 31 days or 1,000 source records. Volunteers receive only their own hours. Pro coordinator CSV summary exports are audited. Dedicated client search/metrics/export screens remain outstanding.
- Both hosting adapters cache only fingerprinted non-HTML resources immutably; stable files revalidate.
- Stage 4 begins with a versioned feature policy, shared premium capability authorization, and a durable user-wide usage ledger. See [Stage 4 implementation](stage-4-implementation.md).

The replay key was generated and saved in the ignored backend `.env` and staging API as `OPERATIONS_CURSOR_KEY`; its value is not documented. The additive personal-usage migration deployed successfully as `8a42c2b4-6c5e-447c-8066-8aa57169c1ff`, and the restricted runtime grants were applied afterward. Current canonical hash: `37664ea1c77704cc73364a56a8bfafe27a55732848e19f55d6f7b6cc22ac90ff`.

This continuation does **not** close the remaining engineering list above or establish full Stage 3 acceptance. No inbox delivery, native purchase, browser checkout or provider configuration is inferred from compilation or PostgreSQL tests.

### Continuation release evidence

- Final backend regression: **139 passed, zero failures/skips**; TypeScript and generated OpenAPI checks passed (96 routes).
- Healthy staging API: `96af5899-8a31-4d04-862a-be055f9ca459`; final volunteer web: `6c4ec250-9700-419e-be6a-da713f5209e8`; final ResQOps web: `2a6080e4-b1f3-4a00-a491-766024c26b4a`. API readiness/catalog returned 200; anonymous usage/snapshot requests returned 401.
- A ResQOps compilation error in the denied-state handler was corrected before the final healthy deployment. Failed build `14fee9e1-738a-44f2-a08b-3a0fb424ff8c` did not replace the healthy service.
- Both quota-wording paywall drafts were visually reviewed and published after explicit approval: ResQ revision 6 and ResQOps revision 9. Store activation remains separate.
- Both final shared JS test suites and Android debug compilations passed. Volunteer native compilation was rechecked with its preserved Ktor 3.5.1/explicit-engine configuration. The separate `shared/build.web.gradle.kts` retains Ktor 3.6.0 and web/Node targets; an earlier concern that native edits removed Railway web support was incorrect. No further Gradle edits were made.
- Initial release browser checks timed out while the large WASM asset was downloading. A bounded longer trace confirmed volunteer canvas rendering. Both static adapters now negotiate gzip with bounded in-memory compressed caching, correct Vary/content-length/HEAD headers and q=0 opt-out. Local transport checks passed; this improves delivery without changing application authorization.

The detailed requirement inventory is in [Stage 3 acceptance](stage-3-acceptance.md).

### Static-delivery follow-up

The compressed hosting releases are healthy: volunteer `f0e1f3cd-7680-4b03-8d54-1d2891d9208e` and ResQOps `7b3c6cf6-a0d2-4e6a-9bcf-4abd70659db1`. They supersede the continuation client deployment IDs above; the API and schema versions are unchanged. Both exact releases passed the 360 CSS-pixel browser check: visible canvas, zero uncaught JavaScript errors, no horizontal overflow, correct SPA deep links, real missing-asset 404s and font/WASM MIME. Volunteer served two compressed JS/WASM assets with one immutable fingerprinted asset (10 MIME checks); ResQOps served three compressed assets with two immutable fingerprinted assets (7 MIME checks). Evidence: `.sentinel-deploy/stage3-release-smoke.mjs`. This is public-entry acceptance only, not the authenticated mission scenario.
