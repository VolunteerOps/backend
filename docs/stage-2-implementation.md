# Stage 2 implementation ledger

Updated 1 October 2026. Governing scope: [seven-stage roadmap](resq-production-implementation-roadmap.md), Stage 2. Manual/provider gates: [step-by-step setup](stage-2-manual-setup.md).

## Implemented

- Personal profile and owner-only sensitive fields; separate opt-in recruitment projection; consent records/export with complete paging and account-switch rejection; revocable expiring profile shares; opaque public IDs; blocking/reporting; deletion request/status/cancellation.
- Recipient-bound invitation inbox, acceptance by inbox ID or hashed secret, decline, revoke, resend, explicit delivery state, bounded preview/import results and throttles. Acceptance rechecks current issuer membership/grant, role, scope, workspace readiness and identity assurance in the transaction. Existing user IDs and other memberships remain unchanged.
- Directory recruitment and profile-share recruitment, public workspace opt-in, personal join requests, scoped review, withdrawal and explicit recipient acceptance. No purchase/email domain/social signup grants coordinator authority.
- Partner application review; separate provision/activation/verification; exact-domain expiring DNS challenge and dispute handling; units; institutional authentication policy; last-owner protection; expiring configuration-only support; bilateral expiring coordination records with explicit partner acceptance.
- Shared responder reservation serialized across organizations, exposing only an unavailable/conflict response to the other coordinator. Scoped removal/suspension invalidates reservations when checked.
- Resend invitation sender and durable mail worker. The proposed mail login can update only invitation job lease/status columns through a queue-filtered view; it cannot read other queues or edit recipients/payloads. Links identify recipient-bound inbox records and contain no bearer secret. Sender disabled until configured; provider acceptance is distinct from inbox delivery.
- Live Compose account and enterprise panels in admin/volunteer; independent personal account access; labelled practice path. Browser Firebase SDK handles session restoration, social/enterprise login, TOTP, linking and verified email change. Shared password REST adapter serves other targets; existing Android Firebase adapter retained. Runtime secrets stay out of client bundles.
- Signed-app association generator requires real signing inputs. No fabricated signing identities were published.

## Validation and deployment

- Backend: 131 tests passed with no skips against disposable PostgreSQL 18/PostGIS, including the expanded real-role RLS/enrollment/enterprise/reservation suite and restricted mail-queue permissions. Type checks, full backend build and portal build passed. The later offboarding and bootstrap regression run also passed (5 tests). OpenAPI contains 85 implemented/retired routes.
- Both Compose JavaScript production distributions built successfully with the Firebase browser adapter. Final shared Node suites passed: 27 admin tests and 36 volunteer tests, zero failures/errors, including password-adapter refresh/logout and export pagination/account-switch tests. The final directory/export UI changes and new export guards compile. Final production distributions rebuilt successfully from the final tree; public backend metadata and required artifacts verified for both apps. Landing Next.js type checking and full production build passed. Both projects passed :shared:compileKotlinJvm and :androidApp:compileDebugKotlin on Windows; this is compilation evidence, not signed-device or live-provider acceptance.
- Five additive Stage 2 migrations applied and fully verified against staging through the restricted TLS migrator. Current storage hash: 24fd3be1dfd8b3d9c19cb4d6e3c57198ea998f5041d3fa6e50601ea539f85210. Historical migrations were not rewritten; legacy application rows were not reassigned.
- API/runtime grants, new mail login and API deployment currently await the explicit approval requested after automatic approval review rejected the bundled privilege-change/deployment action. No mail credentials have yet been created by that rejected command. Read-only staging check at 02:37 UTC confirmed /api/health HTTP 200 and /api/ready HTTP 503 (SCHEMA_MIGRATION_REQUIRED): the running Stage 1 API hash differs from the migrated schema until the matching release is deployed.

## Acceptance still open

Real Firebase credentials, verified email sender, institution-approved SSO metadata and signed-device identities are absent. Live provider, actual email and signed native-link acceptance cannot be claimed. The identity and email workers cannot be declared operational without those inputs.

Native provider parity remains limited: shared native/JVM password flows are memory-only; full browser social/SSO/TOTP/linking works through the browser adapter when configured; Android Google/Apple/Microsoft use its native Firebase adapter and Android Facebook reports unsupported. iOS/JVM enterprise/social browser handoff and target-specific provider linking still require implementation/verification. Do not mark Stage 2 fully accepted based on browser/common-source compilation.

Remaining implementation before full acceptance includes qualification-verified directory filtering, reviewed legacy workspace mapping, complete native deep-link handlers, public preview access auditing, and remaining client review details. These are engineering work, not owner configuration tasks. Directory cursor/filter controls and the audited OFFBOARDING-to-ARCHIVED transition are implemented; offboarding preserves shared personal identities. The current APIs keep unavailable operational routes gated and do not claim directory grants confer incident sharing.

No Stage 2 application deployment has been published yet. No new mail login or MAIL_DATABASE_URL was created by the rejected command. Existing .env values, including the previously approved Stage 1 backup credentials, remain intact. The Stage 2 schema is already installed in staging; API readiness requires the matching API deployment after the pending approval.

Device-level SENSING/LOCATION/RELAY consent changes must use the existing versioned device endpoint. The personal consent endpoint rejects those purposes with DEVICE_CONSENT_REQUIRED instead of falsely recording a revocation that leaves device collection enabled. Declined invitations are excluded from the pending home inbox; revoked/declined deliveries show CANCELLED.

Frontend secret scan: landing .next/static, backend dist/portal and both final client distributions checked against 17 private environment values; 49 files scanned, zero matches.

Isolated Edge browser startup smoke passed for both final distributions: Compose canvas rendered inside its shadow root, browser identity bridge loaded, absent Firebase configuration rejected, and no uncaught page errors. External network calls were intercepted or blocked; this does not claim live-provider acceptance. Anonymous screenshots and the smoke runner are under ignored .sentinel-deploy/.
