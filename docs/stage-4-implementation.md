# Stage 4 implementation

Status: **started, not accepted**. Stage 3 is still open. This document does not override its remaining engineering or provider acceptance requirements.

## Implemented foundation

- Versioned backend catalog (`2026-10-01`) distinguishes essential free paths, agent chat, future agent proposals, and coordinator summary exports. Monthly, yearly and lifetime durations share the role's capabilities.
- Agent chat and summary export use shared capability authorization: current identity, active organization/region membership, role, authoritative direct/sponsored entitlement, then membership revalidation after the provider lookup. Model readiness is checked before reserving an assistant attempt. This helper does not yet cover future jobs or billing streams.
- Canonical `UsageLedger` with user foreign key, owner-only forced RLS, unique user/request key, bucket index and restricted runtime grants. Reservations serialize across all a person's workspaces and devices. Same-key replay is not charged twice; changed-payload key reuse conflicts. Finalization/release is idempotent and terminal states cannot be rewritten.
- Assistant quota is 20 volunteer / 60 coordinator attempts per person per UTC day. Provider failures count; an interrupted reservation remains charged. Metadata records catalog version and limit without the prompt. Missing model configuration is rejected before charging. `/api/me/usage` returns the authenticated person's usage. Assistant HTTP retries still create a new attempt; durable response replay is not implemented.
- Summary exports require ResQOps Pro and coordinator authorization and create an organization audit entry. Essential mission participation, messages, reports, support and account paths do not call the premium gate.

Migration: `20261001T1700_stage4_personal_usage`, from `6d00f9417e6f890944875849b1dac5ad1215ea821e8b88741f93f0459b04389a` to `37664ea1c77704cc73364a56a8bfafe27a55732848e19f55d6f7b6cc22ac90ff`. Runtime grants: `deploy/database/billing-usage-role.sql`.

## Remaining engineering

1. Durable billing customers, product mappings, subscription snapshots, provenance-bearing grants, webhook inbox/audit and fenced reconciliation. Current authoritative reads remain per-request and fail closed on outages.
2. Authenticated raw-body webhook handling, duplicate/reordered/transfer tests, periodic reconciliation, replay diagnostics and bounded cache policy.
3. Complete sponsorship commerce, reservations, billing-admin controls and contract grants. Existing three-seat individual-coordinator sponsorship does not implement all organization billing requirements.
4. Durable assistant HTTP idempotency and response recovery; provider cost attribution beyond attempted-query units; forecast quota buckets.
5. RevenueCat Web Billing checkout/return/verification/customer management and platform parity. Real merchant/store configuration is still needed.
6. Share the catalog with marketing and client code rather than duplicated static prices. Add pricing navigation/route/sitemap and full sponsored/expired/grace/pending UI. Current shared backend feature metadata is the first part of that work.
7. Complete purchase/restore/refund/transfer/account-switch, webhook loss, quota concurrency and essential-safety acceptance with actual providers and signed devices.

Provider actions remain in [Stage 3 RevenueCat setup](stage-3-revenuecat-setup.md). No provider credential has been invented or exposed.
