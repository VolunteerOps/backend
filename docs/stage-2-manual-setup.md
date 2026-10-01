# Stage 2 manual setup and acceptance

Stage 2 follows the seven-stage roadmap. Code and synthetic tests do not establish live provider or signed-device acceptance. Use [stage-2-implementation.md](stage-2-implementation.md) for the actual release evidence and remaining implementation limits. Preserve the Stage 1 backup identity and encryption key.

## 1. Firebase and Identity Platform

1. Select the existing Firebase project used by the released volunteer app; preserve its project ID and every existing Firebase UID. Do not create new accounts by matching legacy email addresses. Use the reviewed identity operator for legacy bindings.
2. In Firebase project settings, register the browser applications for the staging admin and volunteer origins. Copy the public web configuration into backend .env: FIREBASE_PROJECT_ID, FIREBASE_WEB_API_KEY, FIREBASE_WEB_AUTH_DOMAIN and FIREBASE_WEB_APP_ID. Do not substitute an Android-restricted API key for a browser key.
3. Create the backend service account with the required Firebase Authentication permissions. Save its base64 JSON in GOOGLE_SERVICE_ACCOUNT_B64 in the private .env file. The Railway credential wrapper materializes it privately; never copy it into either client or marketing environment.
4. Add resq-admin-staging.up.railway.app, resq-volunteer-staging.up.railway.app and the configured Firebase auth domain to Authentication authorized domains. Configure email action templates and permitted action URLs. Enable email/password and only approved social providers. Enable email-enumeration protection.
5. Configure Google, Apple, Facebook and Microsoft credentials in Firebase, with their exact provider redirect URLs. Secrets stay at the provider/Firebase, not in client configuration. Apple relay recipients must verify their actual bound address. Account collisions require authenticating the existing identity and explicit linking; do not merge by email.
6. For an institution, obtain its approved SAML/OIDC metadata, certificate/issuer and nominated administrators. Configure the connection in Identity Platform in the selected project. Put only its exact saml.NAME or oidc.NAME identifier in FIREBASE_ENTERPRISE_PROVIDERS. Backend identity verification currently rejects tenant-ID claims: do not configure multi-tenant Identity Platform accounts without a separately reviewed immutable tenant mapping change.
7. Enable TOTP MFA in Identity Platform. In the browser app, sign in, use Set up authenticator, store the secret in your authenticator, confirm its code, then sign in again with TOTP. Privileged backend calls require TOTP evidence and authentication within five minutes. Password/social credentials cannot bypass an SSO-only organization policy.
8. Sync the reviewed Firebase values into resq-api and resq-identity using Railway's variable editor or the scoped deployment commands in the Stage 1 guide. Run the identity worker with node scripts/start-with-google-credentials.mjs dist/workers/identity.worker.js and GOOGLE_CREDENTIALS_REQUIRED=true. Use the existing restricted sentinel_identity database login, never the API/migrator/backup login.
9. Verify /api/auth/config and /sentinel/config expose only public values, complete browser signup/verification/bootstrap, and confirm /api/auth/me reports zero memberships. Exercise revoke-all and confirm the identity worker completes remote revocation. Never treat CONFIGURED_UNVERIFIED as a successful provider test.

Official references: [Firebase browser authentication](https://firebase.google.com/docs/auth/web/start), [Firebase Auth REST API](https://firebase.google.com/docs/reference/rest/auth).

## 2. Invitation email

1. Configure a verified sending domain in Resend (the implemented sender adapter). Add its exact SPF/DKIM records in your DNS account and publish your chosen DMARC policy. No recipient was contacted by this implementation.
2. Create a sending API key limited to that domain. In the private backend .env set RESEND_API_KEY, INVITATION_EMAIL_FROM to an address at that domain, and VOLUNTEER_APP_ORIGIN to the exact HTTPS volunteer origin. Do not add a path, query, credentials or fragment.
3. The mail worker requires a dedicated sentinel_mail LOGIN with no superuser, CREATE, replication, database ownership or BYPASSRLS privileges. Its reviewed grants are in deploy/database/mail-role.sql. Invitation jobs are exposed through a filtered view with status/lease-only update grants; it has no base-table access to other queues. MAIL_DATABASE_URL belongs only in private .env and the mail service. Check the implementation ledger for whether this login has actually been provisioned.
4. Create/select a private Railway service resq-invitation-email in the existing staging project. Build the backend Dockerfile and set the start command to node dist/workers/invitation-email.worker.js. Set DATABASE_URL from MAIL_DATABASE_URL, changing localhost:15432 to resq-postgres.railway.internal:5432 for Railway private networking. Preserve sslmode=verify-full and DATABASE_TLS_CA.
5. Set RESEND_API_KEY, INVITATION_EMAIL_FROM and VOLUNTEER_APP_ORIGIN on that service. Give it a private worker-health port, no public domain, and the same bounded restart policy as other workers. Add it to worker monitoring.
6. Set INVITATION_EMAIL_ENABLED=true and the three sender variables on resq-api, then deploy both services. Disabled delivery is reported as NOT_CONFIGURED; no response claims an email was sent. Configured issuance commits an invitation and a durable job together.
7. Send a labelled staging invitation to an inbox you control. Verify provider acceptance, actual inbox receipt, wrong-recipient rejection, explicit acceptance, replay behavior and removal behavior. The link contains only an invitation ID; the verified recipient inbox supplies authorization. No bearer token travels through a callback, store referrer or analytics URL.
8. Confirm dead/expired jobs and failures are monitored. PROVIDER_ACCEPTED means the email provider accepted the request, not inbox delivery or human acknowledgement. Configure bounce/complaint monitoring in the provider account and record the owner.
9. To rotate the mail password, stop the mail worker, change only sentinel_mail's password using the database operator, replace MAIL_DATABASE_URL in .env, update DATABASE_URL on that service via stdin/private variable editor, restart, and confirm a labelled delivery. Keep the old credential out of logs, shell history and git. Rotate the Resend key separately and retest.

[Resend send-email API](https://resend.com/docs/api-reference/emails/send-email) defines the implemented request and idempotency mechanism.

## 3. Signed Android and Apple links

1. Obtain the SHA-256 certificate fingerprints from the actual Google Play app-signing certificate (and any separately authorized staging signer). Obtain the actual Apple team ID and bundle identifier. Debug certificates are not release evidence.
2. Set ANDROID_APPLICATION_ID, ANDROID_SHA256_FINGERPRINTS (comma-separated uppercase colon-separated SHA-256 fingerprints), and IOS_ASSOCIATED_APP_ID (TEAMID.bundle.identifier) in private .env.
3. Run: node --env-file=.env scripts/generate-app-associations.mjs. It refuses missing/invalid signing inputs and writes the standard association files into both app web resource directories. Review the intended host/app relationship before deploying: if admin and volunteer use different signed apps, generate each host's association with its own identifiers.
4. Build and deploy the web apps. Fetch /.well-known/assetlinks.json and /.well-known/apple-app-site-association over their exact HTTPS hosts; verify JSON MIME, no redirects and matching signing identities.
5. Configure Android verified App Links intent filters and Apple Associated Domains entitlements for those exact hosts in the signed native targets. Provision signing profiles through your store/developer accounts. Installation never receives an invitation bearer secret.
6. Test cold start, warm start, login, browser refresh, installation then sign-in, wrong account, expired invitation and account switch on actual signed Android/iOS builds. Invitations remain in the verified recipient inbox even if an installation loses URL state.

## 4. Institution admission and legacy ownership

1. Submit the partnership application from a personal account. An MFA-protected platform owner reviews it and provisions a workspace with an approved provider policy.
2. Activate the workspace; complete exact-domain DNS proof where available; record the separate reviewed institutional evidence. Domain ownership does not create memberships or establish a cross-workspace sharing grant.
3. Nominate the first administrator through the existing platform invitation API. The nominee signs in with the approved method and recent TOTP, verifies the intended recipient address, and explicitly accepts.
4. Create units/regions, invite members with reviewed roles/scopes, and test role A/B/unassigned/owner isolation. Expired/removed membership requires review; an old invitation cannot reactivate it.
5. Review every legacy volunteer-to-user/workspace mapping before backfill. The Stage 1 source IDs and mission links remain preserved; this release does not invent tenant ownership or merge accounts by email. Keep the signed mapping record and source/recovery artifacts privately.
6. Test directory opt-in/opt-out, share revoke, recipient blocking, report review, imports in preview mode, per-row import results and invitation throttles. Review pending join requests; approval creates an invitation, not membership.
7. For support, record a reason, identify an active platform operator and grant at most 60 minutes. The implemented support read is configuration-only. Revoke it and confirm access fails. Protect the last active platform owner and complete administrator handover before deletion/offboarding.
8. For bilateral coordination, identify both organizations, one lead, the resource reference and expiry; require the partner's explicit acceptance. The grant record does not itself enable Stage 3/6 incident-data APIs.

## 5. Release acceptance and remaining gates

Run all five journeys in the roadmap using real configured identities and your controlled inboxes on browser and each supported native target. Record date, target/build ID, role/provider, expected/actual result and request IDs without tokens or private profile exports. Test SSO-only bypass denial, revoked HTTP/storage/worker access, consent revocation, provider collision, email change, account deletion request/status, and private responder conflict results.

Native iOS signing/device execution needs macOS and the developer account. The shared password adapter is memory-only; browser uses Firebase session persistence. Android retains its Firebase SDK adapter. Consult the implementation ledger for target-specific social/SSO/linking limitations rather than assuming common compilation proves native provider support. Account deletion requests require a reviewed retention/erasure workflow; requesting deletion is not cancellation of a store subscription.

## 6. Personal export and consent checks

1. Use the personal export action while recently authenticated. Both clients collect all consent pages; they stop rather than combine records if the account changes or a cursor repeats. The export scope is personal profile, directory preferences, consent history and membership summaries, not organization mission files.
2. For API clients, GET /api/me/export returns at most 1,000 consent records and consents_next_cursor. Repeat with ?after=CURSOR until the cursor is null; retain the authenticated user and discard partial output after an account change. Exports are private and responses use no-store.
3. Directory/public-profile consent can be revoked from personal settings. Device sensing, location and relay consent must use the existing registered-device consent endpoint so its consent version changes and pending jobs fail reauthorization. A personal consent request for those purposes returns DEVICE_CONSENT_REQUIRED.
