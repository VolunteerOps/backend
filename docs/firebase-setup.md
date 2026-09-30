# Firebase Auth, social providers and FCM setup skeleton

> Current implementation: [13 September continuation](sentinel-continuation-status.md). The earlier baseline below is historical where it describes local JWT authentication, missing Firebase HTTP mappings, or absent identity workers. Organization isolation, live client integration and the disaster engine remain unfinished.

Step 1 documentation; trace S04/S08/S10 in the [specification](sentinel-implementation-plan.md). **No production cutover, identity migration, provider change or billing authorization.**

| State | Current evidence |
| --- | --- |
| Implemented | Parent reports `firebase-admin` and lazy ADC-backed `src/core/firebase.ts`: ID/session verification with revocation, issuer/audience/expiry/email/UID/shared-directory checks; sanitized identity without grants; recent-auth â‰¤5 minutes, five-day session creation and revoke-all adapter. **Not wired to HTTP.** Final artifacts/tests belong in the [root runbook](../DEPLOYMENT_RUNBOOK.md). |
| Owner action | Supply approved per-environment project/app/provider values and complete console actions below. |
| Blocked | DB identity mapping/UID migration, HTTP middleware/session/CSRF/origin/revocation routes and current scoped grants, reviewed cutover, both clients, FCM outbox/token lifecycle and real provider/device evidence. Owner setup alone does not implement these workflows. Legacy local JWT auth is still active; Firebase is not live authentication. |
| Verified | Parent reports passing foundation tests/types/build at the [checkpoint](sentinel-implementation-plan.md#current-partial-step-1-baseline), with more HTTP tests pending. No Firebase console, emulator, real social/MFA/session/revocation/push check was performed here; unit evidence does not certify providers. |

## Required inputs and placement

All actual values are `REQUIRED`; labels below are inventory fields unless explicitly identified as supported configuration. Parent reports the verifier factory requires `FIREBASE_PROJECT_ID`. Production forbids emulator trust; development emulator use requires a demo-project ID, `FIREBASE_ALLOW_AUTH_EMULATOR=true` and loopback `FIREBASE_AUTH_EMULATOR_HOST`. An emulator is not a production fallback. `.env.example` was updated; actual `.env` and credentials remain untouched.

| Input | Owner action / placement |
| --- | --- |
| Development/staging/production Firebase project IDs, Cloud project numbers, runtime identity | Select separate environments, authorize APIs/quotas/billing alerts and least-privilege Auth/FCM access. Supply `FIREBASE_PROJECT_ID` and match exact project issuer/audience; verifier emits identity, not permissions. |
| Both apps' Android application IDs and debug/release/Play SHA-1/SHA-256 | Register each actual app/signing identity in Firebase project settings. Download matching `google-services.json`; inject into the inspected Android app-module location through approved client/CI configuration (final path pending workspace inspection). |
| Both iOS bundle IDs, Apple team IDs, app registrations | Register actual targets; place matching `GoogleService-Info.plist` in the inspected iOS target/build configuration. No iOS verification without macOS/signed devices. |
| Web app IDs/config, HTTPS origins/auth domain/action-link domain | Register permitted origins and email-action/redirect URLs exactly; wire public client config to inspected JS/Wasm host. Web session uses HttpOnly secure Firebase cookie/CSRF, not a second JWT or persistent unprotected tokens. |
| Backend credentials | Implemented verifier uses lazy Firebase Admin application default credentials (ADC). Prefer workload identity; if necessary use a secret-managed server-side credential file via the ADC convention `GOOGLE_APPLICATION_CREDENTIALS`. No real credential resolution is verified here. Never place private keys in source, clients, images, logs or chat. |
| APNs key/certificate, key ID/team ID, entitlements | Owner uploads credentials in Firebase Cloud Messaging settings and enables signed iOS push entitlements. Keep private material in consoles/secret manager. |
| Web VAPID key pair, service-worker scope | Configure Firebase Web Push and HTTPS/service worker. Public VAPID key goes only to matching app config; secret/private material stays managed. |

## Console checklist â€” both apps, all environments

1. Enable email/password; configure verification/recovery templates, sender/action domains, authorized redirects and abuse controls. Do not migrate demo identities. Approve numeric-ID-preserving UID migration registry/reset/invitation strategy before cutover; optional Argon2 import requires supported tooling/parameter rehearsal, not assumed Node support.
2. Google: configure consent screen, OAuth clients, actual signing/origins, verification and exact redirects. Apple: team/service IDs, key ID/private key, return URLs and review requirements. Facebook: Meta app ID/secret, login/redirect configuration, review/live mode and privacy/deletion URLs. Microsoft: Entra app/client ID, approved tenant/consent and credentials/redirects. Keep provider secrets in Firebase/provider consoles or secret manager, never mobile/browser bundles.
3. Enable the four selected providers in Firebase and test each app's platform support, cancellation, email verification, collision/linking and recent reauthentication. Google/Microsoft social login is not institutional SSO or organization admission. Apple private relay/email changes must not remap UID by email string.
4. Complete [Identity Platform SSO/MFA](enterprise-identity-setup.md) separately. Native adapters use SDK token refresh; desktop/unsupported targets require reviewed system-browser, one-use short-lived PKCE/state handoff preserving assurance, not embedded WebView/provider secrets/token URLs.
5. Configure FCM HTTP v1/least-privilege runtime identity, APNs and web prerequisites; approve quotas/budgets. Bind tokens to verified user/device/app/platform/environment; logout/rotation/revocation must unbind. Private topics are not authorization. Payloads carry minimal approved content plus revision/expiry, not health/precise location/private mission briefs.

## Verification, recovery and blockers

No executable Firebase setup/bootstrap/migration command is established by this skeleton; do not invent one. Parent reports `npm test`, `npm run test:types` and `npm run build` passed at the checkpoint; final focused verifier/HTTP results belong in the root runbook and the test count is not final. Complete HTTP integration tests for wrong project/issuer/audience, expired/revoked/disabled users, unverified identities, role loss, local JWT rejection **after authorized cutover**, and CSRF/origin violations; preserve numeric IDs and reject email-only privileged linking. Existing legacy hardening rejects privileged public signup, refreshes account role/status from DB each request, removes admin/implicit `SUPER_ADMIN` bypasses and returns 503 on DB failure. It is not Firebase HTTP integration or tenant isolation.

Manual configured-provider checks: verify email/recovery for both apps; each social login/link/cancel flow; web session creation/logout/revoke-all; SSO/MFA assurance on org switch; unassigned login cannot access operations. In signed test builds send only labeled test messages, then record provider acceptance, device receipt and human action separately. Test token rotation/account change, stale/duplicate/reordered messages, notification denial, offline state and environment isolation. Auth emulator success does not certify FCM/APNs/VAPID/social providers or actual revocation setup.

Rotation/recovery: rotate runtime/provider/APNs credentials under change control, verify replacements before retiring old credentials where supported, test callback continuity and audited revoke-all. Database disablement must deny online scope immediately while external revocation retries. Keep account recovery and last-owner protection; never restore local JWT bypass as fallback. Remaining blockers include every `REQUIRED` input, supported client implementations/devices, actual provider approvals and controlled identity migration/cutover authorization.