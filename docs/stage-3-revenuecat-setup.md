# Stage 3 RevenueCat configuration and remaining store setup

## Connected account and completed configuration

MCP OAuth and official CLI OAuth completed on 1 October 2026. The newly added MCP server may require a Codex session refresh before its tools appear; the CLI is authenticated and was used for the changes below. OAuth credentials remain in the tools' credential stores, not in source files.

All changes are in the existing [ResQ project](https://app.revenuecat.com/projects/f7905c83). The unrelated project was not changed. Existing Firebase UID customer identity is preserved.

| App | RevenueCat app | Android package | Offering | Entitlement |
| --- | --- | --- | --- | --- |
| ResQ | `app59122274d8` | `com.resq.app` | `sale` (`ofrng65e886c2ae`) | `resq_pro` |
| ResQOps | `appca41ece37e` | `com.example.admin` | `default` (`ofrng528cfdcb95`) | `resqops_pro` |

The original offering names and IDs were retained. Both mobile implementations now select the matching offering explicitly; the volunteer app cannot accidentally use the project's current coordinator offering.

Each offering has `$rc_monthly`, `$rc_annual` and `$rc_lifetime`, with distinct Test Store and Google Play catalog products. The old generic test products remain in the project to preserve history; package bindings now use the new products. Lifetime is non-consumable and does not renew.

| Plan | ResQ USD / KSh | ResQOps USD / KSh |
| --- | --- | --- |
| Monthly | 4.99 / 650 | 19.99 / 2,600 |
| Yearly | 39.99 / 5,200 | 159.99 / 20,800 |
| Lifetime | 149.99 / 19,500 | 599.99 / 78,000 |

These prices are applied to the Test Store. Plan `da1a1fab-bf6e-4437-8737-1aef0834c5a4` created six products with no warnings. No Google Play price activation or real customer charge is claimed. The requested USD/KSh app display is a catalog choice; actual checkout uses the store's localized price and currency.

Catalog artifacts: [Test Store pricing](../deploy/revenuecat/resq-test-catalog.csv), [Google Play mappings](../deploy/revenuecat/play-catalog.json). Preserve these product IDs when configuring the store.

## Paywalls

- [ResQ volunteer paywall](https://app.revenuecat.com/projects/f7905c83/paywalls/pw4271d91f33944198/builder)
- [ResQOps coordinator paywall](https://app.revenuecat.com/projects/f7905c83/paywalls/pw385bd00b1cb74eeb/builder)

Both existing paywalls were customized through RevenueCat's AI editor and visually reviewed. They use the actual ResQ community-response illustration, uploaded Oswald/Overlock fonts, navy/blue/Papaya colors, distinct benefits, three prices, computed annual savings, visible dismissal, restore controls, Terms/Privacy and recurring/one-time purchase wording. Restore controls and font/price bindings were checked in the component configuration because the screenshot renderer does not show every runtime control/font.

The ResQOps title colors `Ops.` Papaya. The coordinator paywall includes three sponsored volunteers; the app/server enforce that limit. Daily assistant limits apply to every duration, including lifetime. Both reviewed designs were published to the existing offerings on 1 October 2026. This publishes the paywall design and does not activate Google Play products or charge customers.

## 1. Connect Google Play credentials

1. In RevenueCat, open each app above under Apps & providers. The live store-state check currently returns **Missing credentials for the store**.
2. Connect the Google Play service account for the actual Play Console developer account. Grant only the documented billing/product permissions needed by RevenueCat; do not assume the Firebase identity service account already has Play permissions.
3. Confirm the package IDs match the store listings. `com.example.admin` is the existing coordinator source package; decide on any package migration before publishing that app, rather than silently changing it after customers install.
4. In the volunteer Play listing, configure subscription `resq_pro` with base plans `monthly` and `yearly`, plus non-consumable one-time product `resq_pro_lifetime`.
5. In the coordinator listing, configure subscription `resqops_pro` with base plans `monthly` and `yearly`, plus non-consumable `resqops_pro_lifetime`.
6. Set USD and Kenyan regional prices from the table, review taxes and store rounding, and activate the correct base plans/products for the internal testing track. The RevenueCat mappings are already attached to the matching entitlements/packages.
7. Add license testers, publish signed internal-test builds, and install through the testing link. Real purchase validation cannot be established by compiling a debug APK.

[RevenueCat's product configuration guide](https://www.revenuecat.com/docs/offerings/products-overview) explains the Play subscription/base-plan identifiers. [The store pricing format](https://www.revenuecat.com/docs/offerings/product-editor-csv) describes regional prices and availability.

## 2. Use and rotate the saved public SDK keys

The keys are already saved in ignored backend `.env` as `REVENUECAT_ANDROID_API_KEY` and `REVENUECAT_OPS_ANDROID_API_KEY`. They are public `goog_` client keys, not server credentials.

1. In each RevenueCat app's settings, obtain its public Google Play SDK key. Keep each key with its own app.
2. Replace only the corresponding line in backend `.env` when a key changes. Do not paste keys into chat or commit `.env`.
3. From a PowerShell terminal in backend, run:

```powershell
. ./scripts/configure-mobile-env.ps1
```

4. In that same terminal, build the desired sibling Android app. The script copies only these two public keys into the process environment. Each Gradle build reads its matching name. Release configuration rejects `test_` keys. Volunteer debug builds retain their explicit Test Store configuration for development.
5. Rebuild the signed release/internal-test artifact after changing a client key; changing backend Railway variables alone cannot replace a compiled native SDK key.

## 3. Supply the backend subscriber-read credential

1. Create a RevenueCat server API key authorized to read subscribers in the existing ResQ project. CLI OAuth is operator access, not a production server credential.
2. Save it as `REVENUECAT_SECRET_API_KEY` in backend `.env` and `resq-api` Railway variables. Both apps share the project, so `REVENUECAT_OPS_SECRET_API_KEY` can remain empty; it is only needed if the apps later use separate projects.
3. Keep this key out of Gradle, browser assets and mobile `.env` exports. Redeploy the API after updating it.
4. Production rejects missing purchase provenance, expired/refunded entitlements and sandbox purchases. Active grace periods and verified lifetime purchases are supported.
5. For selected staging testers only, set `REVENUECAT_ALLOW_SANDBOX=true` and `REVENUECAT_SANDBOX_UIDS` to a comma-separated list of their actual Firebase UIDs. The server also requires Railway environment name `staging` (or local test environment); this flag does not enable sandbox grants in production. Keep the default `false` outside this acceptance test.

## 4. Review and launch

1. Open both paywall builder links and inspect phone/tablet layouts and actual font rendering. Confirm all benefits and three package prices are visible, and test dismissal/restore/legal links.
2. The reviewed paywalls are published. In the signed store test, validate purchase success, cancellation, pending payment, restore, expiration, refund and account switching. Check API access independently of the client callback.
3. Confirm one paid coordinator can allocate at most three seats to active volunteers already in their workspace; remove membership or paid entitlement and verify sponsored access ends.
4. Record signed-device transaction evidence. A Test Store simulation alone does not establish Google Play acceptance.
5. Web Billing requires a supported merchant/payment connection before real browser purchases can be enabled. Web checkout and durable billing webhook/reconciliation remain engineering work; the current web UI never simulates payment success.

Store credentials, merchant eligibility, signed-device access and store release review are owner/provider dependencies. The remaining application engineering is tracked separately in [Stage 3 implementation](stage-3-implementation.md).

## Personal allowance update

On 1 October 2026, after explicit approval, both reviewed quota-wording drafts were published: ResQ revision 6 at 17:24:01 UTC and ResQOps revision 9 at 17:24:03 UTC. The paywalls now describe 20/60 attempted assistant queries per person per day across all workspaces, resetting at midnight UTC. Prices, packages and offering identifiers are unchanged. These published copy changes do not establish store activation or payment acceptance.
