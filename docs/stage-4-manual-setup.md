# Stage 4 provider setup and acceptance

Stage 4 has begun; it is not accepted. See [engineering status](stage-4-implementation.md). The personal usage schema, restricted grants and API configuration have already been applied to staging; there is no manual database work for that change.

## Backend purchase verification

1. Open the existing ResQ RevenueCat project `projf7905c83` with your account. Preserve the current Firebase UID customer identifiers and existing products/offerings.
2. Obtain a server credential authorized to read subscriber state for that project. Set `REVENUECAT_SECRET_API_KEY` in the ignored backend `.env` and Railway `resq-api` staging variables. The current implementation calls RevenueCat's subscriber API; never substitute a public SDK key or copy the operator OAuth token into the service.
3. Both apps currently use the same RevenueCat project. Leave `REVENUECAT_OPS_SECRET_API_KEY` unset unless ResQOps deliberately moves to a separate project, which requires an explicit identity/purchase migration.
4. Redeploy the API. With an authenticated test user, verify `/api/me/subscription` reports verified provider state and `/api/me/usage` returns only that user's allowance consumption.
5. Keep sandbox grants disabled except for the explicitly documented staging UID allowlist. Never enable sandbox access in production.

## Store and browser configuration

1. Follow the exact app IDs, products, credentials and signed-device checks in [RevenueCat setup](stage-3-revenuecat-setup.md).
2. Configure actual Google Play credentials/products and store notifications before calling a purchase live. The catalog alone does not activate a product.
3. Configure iOS store credentials and signed targets where supported. Windows compilation cannot certify an iOS purchase.
4. Confirm eligibility for RevenueCat Web Billing and its payment provider. Browser checkout engineering is still outstanding; do not wire a webhook to an unimplemented endpoint or assume the current web plan screen can charge customers.

## Acceptance record

After the remaining billing engineering is implemented, record environment, app version, test-account identifier, provider transaction/event identifier, test time and result for purchase, pending/cancelled payment, restore/reinstall, cross-device use, account switch, renewal, grace, expiry, refund and transfer. Do not record payment credentials or full tokens.

Verify personal quotas across two devices and workspaces, sponsorship removal and membership revocation. Mission participation, account management and essential communication must remain available when Pro expires. Record real inbox and signed-device evidence separately from automated test output.
