# Stage 3 provider setup and acceptance

See [implementation evidence](stage-3-implementation.md) for work completed and engineering work still outstanding. The steps below require provider registration, commercial configuration, missing owner assets or actual signed-device/inbox access. Do not paste credentials into chat or commit .env.

## 1. Register ResQOps in the existing Firebase project

1. Keep FIREBASE_PROJECT_ID unchanged to preserve existing Firebase UIDs. Register a new Web app named resqops in Firebase Project settings. A separate app registration does not create a separate authorization system.
2. Copy its appId to FIREBASE_OPS_WEB_APP_ID in backend .env and resq-api Railway variables. FIREBASE_OPS_WEB_API_KEY and FIREBASE_OPS_WEB_AUTH_DOMAIN have been initialized locally from the same project's current public settings; confirm them against the new registration.
3. Keep the volunteer settings FIREBASE_WEB_API_KEY, FIREBASE_WEB_AUTH_DOMAIN and FIREBASE_WEB_APP_ID unchanged. Never place a service-account credential in either frontend.
4. Enable Email/Password and Google providers. Add resq-volunteer-staging.up.railway.app and resq-admin-staging.up.railway.app to Authentication authorized domains. Review API-key HTTP referrer/API restrictions for both hosts and the Firebase auth domain.
5. After updating the API variables, redeploy the current API build. GET /sentinel/config returns the volunteer public configuration; GET /sentinel/config?app=ops returns ResQOps. The latter intentionally returns firebase:null if its appId is missing; it never falls back to the volunteer registration.
6. Register Android applications with their real application IDs: volunteer com.resq.app and current coordinator com.example.admin. Product display name is ResQOps; changing an existing package ID must be coordinated with the Play listing. Download each matching google-services.json into its own androidApp directory. Add the debug and release signing SHA fingerprints as appropriate. Google sign-in needs default_web_client_id generated from that registration.
7. Register each iOS bundle ID and configure its GoogleService-Info.plist and sign-in callback settings in Xcode. Windows compilation is not iOS device acceptance; iOS social/provider parity is still an engineering acceptance item.
8. With accounts you control, verify signup, email verification, password recovery, Google sign-in, logout and account switching on the deployed browser builds and signed Android builds. Confirm your profile survives reload. Coordinator access still requires an approved workspace and recent TOTP where required.

Provider verification limit: the existing Firebase service account received `PERMISSION_DENIED` when reading project sign-in/provider configuration. The deployed volunteer public config is present, but authorized domains/provider switches require the Firebase Console checks above. ResQOps public config remains absent until its new app ID is supplied.

## 2. Activate real RevenueCat products and paywalls

1. Account access is now connected through MCP OAuth and the official CLI. The existing ResQ project has both apps, separate entitlements, priced Test Store products and published customized paywalls. Start with [the exact account configuration and remaining store steps](stage-3-revenuecat-setup.md); no management API key is required for the connected CLI.
2. Both apps are configured in the existing ResQ project. Preserve existing customer IDs and product identifiers. Entitlement identifiers in code are resq_pro and resqops_pro; map the matching products to those exact entitlements.
3. Configure monthly, annual and non-consumable lifetime products in the correct Play/App Store listings. Monthly and yearly are recurring; lifetime is one purchase and must not be configured as a recurring subscription. Configure approved regional prices rather than changing checkout currency in code.

| Product | Monthly USD / KSh | Yearly USD / KSh | Lifetime USD / KSh |
| --- | --- | --- | --- |
| ResQ Pro | 4.99 / 650 | 39.99 / 5,200 | 149.99 / 19,500 |
| ResQOps Pro | 19.99 / 2,600 | 159.99 / 20,800 | 599.99 / 78,000 |

4. These are planned catalog prices, not an exchange-rate quote. Configure the final regional store price/taxes. Actual purchase buttons must display RevenueCat's localized product price. ResQOps includes up to three sponsored volunteers across the paying coordinator's workspaces. All tiers have usage limits for hosted AI/forecast services; lifetime does not promise unlimited compute.
5. Existing offerings and package identifiers have been preserved and mapped to separate priced products. Published branded paywalls use the actual ResQ illustration and uploaded Oswald/Overlock fonts. Verify the published designs on real store builds before activating paid products. The app selects `sale` for ResQ and `default` for ResQOps explicitly; do not swap those offerings.
6. The matching public Google Play keys are now saved in backend `.env`: REVENUECAT_ANDROID_API_KEY for volunteer and REVENUECAT_OPS_ANDROID_API_KEY for coordinator, using Gradle properties or build environment. Release builds reject test_ keys. iOS needs its separate appl_ key and native linking/configuration.
7. Set REVENUECAT_SECRET_API_KEY only in backend .env and resq-api; it must support subscriber reads for the project(s) used by these apps. If ResQ and ResQOps are separate RevenueCat projects, also set REVENUECAT_OPS_SECRET_API_KEY to the ResQOps project subscriber-read key. The server routes each entitlement lookup to its own key; if omitted, the volunteer key is used for both apps within one project.
8. Google Play Billing handles Android purchases; iOS uses StoreKit. Browser checkout requires RevenueCat Web Billing/payment setup; the web plan screens do not simulate a purchase. Configure that provider and implement/verify browser checkout before claiming web purchase support.
9. Test success, cancellation, pending payment, restore, renewal, expiration, refund, account switching and sponsored-seat release with store sandbox accounts. Verify server entitlements independently. A UI success callback alone is not payment acceptance. Launch paid store products only after real product/store validation.

[RevenueCat customer info](https://www.revenuecat.com/docs/customers/customer-info) and [localized paywall variables](https://www.revenuecat.com/docs/tools/paywalls/creating-paywalls/variables) describe entitlement expiry and store-provided prices.

## 3. Sentinel assistant and weather

1. Add SENTINEL_GEMINI_API_KEY and an enabled SENTINEL_GEMINI_MODEL to backend .env and resq-api. Empty configuration fails with AGENT_NOT_CONFIGURED; keys stay server-side. An alternative provider key requires a corresponding server adapter rather than passing it to the client.
2. Complete the existing [weather provider setup](google-weather-setup.md), configure verified geographic regions and run the forecast/source workers. A map token alone does not provision weather data or train a disaster prediction model.
3. Verify current forecast initialization/retrieval timestamps, coverage and uncertainty in the portal. Missing or stale sources must remain visible as unavailable. Human coordinators approve all mobilization; the agent cannot dispatch anyone.
4. Test the same question as a paid volunteer and a paid coordinator. Check role-appropriate wording, cited evidence and refusal to invent unsupported predictions. Verify unpaid access and quota exhaustion return explicit errors.

## 4. Missing Google button asset

1. Place the intended google.png at backend/portal/google.png; it was not present at implementation time.
2. Once the approved asset is present, its integration into both Compose button resources remains an engineering task. No code work is delegated to you here; Apple sign-in buttons have been removed.

## 5. End-to-end acceptance

1. Invite a volunteer to a verified staging workspace with at least one region. Confirm receipt in an inbox you control and accept through the authenticated invitation inbox.
2. Add stock at two storage locations, transfer it, author/publish a training course, enroll/pass the lessons and have a coordinator review the qualification. Verify an unqualified volunteer cannot be assigned when the mission requires it. A coordinator saves/publishes a mission; the volunteer applies; the coordinator assigns; activate the mission; check in; submit a field report and message; complete with actual hours; approve/correct the hours. Repeat a command with the same idempotency key and verify no duplicate.
3. Check a second workspace and a region-limited member cannot access those records. Remove membership during live use and confirm subsequent refresh/events fail closed.
4. Review web screens at 360, 768 and 1440 CSS-pixel widths and on signed native devices. Confirm there is no practice workspace, preview setup or welcome-page Sentinel shortcut.
5. Verify Pro purchases and sponsored access only after provider setup. Record actual store transaction and entitlement evidence without secrets. Do not mark Stage 3 fully accepted while the engineering items in the implementation document remain open.

## Replay-key operation

The operator has already generated and configured `OPERATIONS_CURSOR_KEY` locally and on the staging API. No initial manual setup is needed.

To rotate it later:

1. Generate a cryptographically random 32-byte value encoded as exactly 64 hexadecimal characters in your local password manager or secret tool.
2. Replace `OPERATIONS_CURSOR_KEY` in the ignored backend `.env`; do not commit or send the value in chat.
3. Set the identical value on Railway `resq-api` in the staging environment, then redeploy the API. Use a separate value for production.
4. Existing cursors will request resnapshot. Fetch `/operations/snapshot` before fetching the record pages, then subscribe using its cursor. Deduplicate replayed records by ID/version. The current apps poll and do not yet consume this stream.
5. Verify current membership still gates snapshot/replay. The key is not a replacement for Firebase or workspace authorization.

See [Stage 4 implementation](stage-4-implementation.md) for the personal usage ledger and remaining billing engineering.
