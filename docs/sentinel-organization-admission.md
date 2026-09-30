> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Organization admission implementation — 13 September 2026

This is the current organization/identity implementation record. It supersedes the earlier continuation's statement that organization models and RLS were wholly unimplemented. The complete Sentinel plan remains unfinished.

## Delivered

- Explicit `PlatformGrant` records; legacy global roles never grant platform access. Platform actions require current account/UID mapping, an active tech-admin grant and TOTP sign-in within five minutes.
- Organizations with separate provisioned/active/suspended/offboarding state, version, approved provider IDs and enrollment readiness. Activation does not itself verify an institution. The verification endpoint records an explicit owner-reviewed evidence reference, implementing the plan's manual alternative; DNS verification and enterprise-provider configuration remain unfinished.
- Organization memberships with independent roles/status/region restrictions. Active admission checks run inside a transaction, including current account status, session revocation, organization state, membership, provider and MFA policy. Region-limited memberships cannot use whole-organization administration endpoints.
- PostgreSQL RLS for organizations, memberships, invitations, platform grants and organization audit rows. Runtime database ownership/elevated privileges are rejected. Context uses transaction-local `set_config`, and both commit and rollback restore pooled connections. RLS protects these new tables; it does not retrofit legacy operations.
- Cryptographically random, hashed, recipient/org/role/issuer-bound invitations with expiry, atomic acceptance and same-user retry handling. No account linking by email. Removed memberships require access review; a new or previously accepted invitation cannot reactivate them. Membership removal revokes outstanding invitations issued by that member; workspace suspension revokes outstanding workspace invitations. Disabled issuers cannot admit invitees.
- Manual invitation revocation, membership suspension/removal, last-active-org-admin protection and transactionally appended audits. Runtime roles cannot update/delete audit rows or create/update/delete platform grants through these APIs.
- Out-of-band owner bootstrap and explicit legacy UID-binding command. Initial owner bootstrap locks the grant set and refuses a second use even if an existing grant is inactive. Mapping preserves numeric IDs and hashes, revokes legacy refresh records, and never changes global roles into platform permissions.

The new workflows are implemented in `src/modules/organizations/` and `src/modules/platform/`. No live provider or app interface is claimed configured.

## Implemented API

All endpoints require Firebase authentication; cookie mutations retain the existing CSRF requirements. Responses are `Cache-Control: no-store`. IDs are UUID strings except internal numeric user IDs. Error codes use the existing `{error, message, details?}` shape.

| Endpoint | Authorization / behavior |
| --- | --- |
| `GET /api/auth/me`, bootstrap response | Personal profile plus membership/context summaries, platform grant/access state and effective capabilities. No global legacy role is used for admission. |
| `GET /api/me/memberships` | Caller-only organization chooser and reasons such as pending verification, suspended organization, missing SSO/MFA. Currently bounded to 100 memberships. |
| `GET /api/platform/organizations` | Explicit tech-admin grant plus recent TOTP; lists provisioned workspaces. Optional UUID `after` cursor, maximum 100. |
| `POST /api/platform/organizations` | Strict `slug`, `display_name`, `allowed_providers`, optional `require_mfa`, `reason`. Creates PROVISIONED workspace; duplicate slug returns conflict. |
| `POST /api/platform/organizations/:id/activate`, `/suspend`, `/offboard` | `expected_version`, `reason`; valid lifecycle transition only. Offboarding starts from SUSPENDED; final archival remains unavailable pending operational handover implementation. |
| `POST /api/platform/organizations/:id/verification` | Active workspace; `expected_version`, `reason`, `evidence_reference`. Records owner-reviewed institutional evidence. Does not run DNS or SSO tests. |
| `POST /api/platform/organizations/:id/invitations` | Owner nomination after activation and verified enrollment readiness. |
| `GET /api/organizations/:id` | Current member with organization policy satisfied; safe workspace summary. |
| `GET /api/organizations/:id/memberships` | Unrestricted org-admin/coordinator roster; optional UUID `after`, maximum 100. No other organization roster/profile is returned. |
| `POST /api/organizations/:id/invitations` | Org-admin or coordinator; cannot grant above the issuer's authority. |
| `POST /api/invitations/accept` | Strict `{token}`. Requires matching Firebase-verified email and workspace assurance. Concurrent same-user acceptance produces one membership. |
| `DELETE /api/organizations/:id/invitations/:invitationId` | `{reason}`; org-admin may revoke workspace invitations, coordinator may revoke their own. Accepted memberships need a separate access review. |
| `PATCH /api/organizations/:id/memberships/:memberId` | Org-admin; `expected_version`, `status` (`SUSPENDED` or `REMOVED`), `reason`. Protects last active org-admin; no global account deletion. |
| `GET /api/organizations/:id/audit` | Unrestricted org-admin; bounded UUID pagination. Audit ordering follows the UUID cursor, not a chronological UI timeline. |

Invitation bodies contain `recipient_email`, `role`, optional `region_ids` and `expires_in_hours` (1–168; default 48), and `reason`. Responses expose the random token once with `delivery: MANUAL_DELIVERY_REQUIRED`. Automated email delivery, deep links, roster imports and join requests are not implemented. No emails were sent in this development session. Region IDs are restrictive scope markers; region registry/geometry validation still needs implementation.

## Migration and runtime privileges

The new migration is `migrations/app/20260913T0931_organization_admission_rls`, with 35 additive operations after the existing three migration packages. Its destination contract hash is:

`2e818e74020d477243a5385c079065efcc7cacc4348e0183656cf6e7f2de9100`

Prisma 8 owns the RLS policies and CHECK constraints. The Prisma 7 compatibility schema mirrors tables, columns, relationships and mapped indexes; it does not author RLS/CHECK migrations. No production database ref was advanced. Chain future offline migrations explicitly from this reviewed destination until an authorized database migration updates the relevant ref.

The production runtime role must be separate from the table owner, with no superuser, BYPASSRLS, CREATEROLE, CREATEDB, replication or owner-role membership. An operator must grant schema usage, the necessary table privileges and sequence access after migrations; Prisma does not provision deployment roles. Limit application access to its database/schema. Never give runtime users the migration connection or use RLS context variables as client-supplied permissions. RLS requires a trusted application to set the verified transaction context.

For these workflows, grant SELECT/INSERT/UPDATE on `organizations`, `organization_memberships` and `organization_invitations`; SELECT/INSERT on `organization_audit`; SELECT only on `platform_grants`. Existing auth/profile/audit/outbox paths retain their separately required privileges. No runtime DELETE grant is needed on new organization tables. Privileges do not bypass policies. Migration/operator identities remain secret-managed and separate.

## Operator commands

The operator command is code, not a completed owner enrollment. The chosen UID/user ID, identity proof, actual token file and secured `DIRECT_URL` remain operator inputs. The command requires a table-owner database identity and verified recent TOTP Firebase token. Store the token file outside the repository with restrictive permissions and remove it after the operation; never put token contents in command arguments or logs.

```powershell
npm run identity:operator -- --operation bind-legacy --user-id 42 --confirm-user-id 42 --token-file C:/secure/identity-token.txt --reason "Approved identity mapping in reviewed migration registry"
npm run identity:operator -- --operation bootstrap-owner --user-id 42 --confirm-user-id 42 --token-file C:/secure/identity-token.txt --reason "Approved chosen platform owner and verified identity"
```

`42` and the token path above are placeholders. A newly bootstrapped account already has a UID mapping and does not need `bind-legacy`. No public route bootstraps owners. Recovery, multi-owner grant management, last-owner transitions, support-access sessions and global account deletion remain unfinished; do not emulate those by granting runtime database ownership.

## Verification performed

Installed PostgreSQL **15.5**, discovered at `C:/Program Files/PostgreSQL/15/bin`, supplied a disposable loopback-only test instance on port 55439. It used a new cluster under ignored `.sentinel-test-pg/`; no existing PostgreSQL cluster or project connection was changed. All four migration packages applied to `sentinel_test`, and `prisma db verify` confirmed the database marker/schema matched the emitted contract.

`npm test` with `SENTINEL_TEST_DATABASE_URL` passed **105 tests, zero skipped**. The organization test exercises real services and RLS with a temporary non-owner database login, actual concurrent acceptance, alternating pooled identity contexts, independent organization memberships, removal/replay/expiry, grant forgery denial, immutable audit denial, owner bootstrap, immutable binding and bootstrap races. Firebase identities are fixtures; this is not live Firebase/SSO validation. The job test now also ran successfully against PostgreSQL.

`npm run build`, `npm run test:types`, `npm run prisma8:check` and whitespace checks passed. A focused HTTP test also verified unauthenticated denial on the newly mounted routes. The disposable PostgreSQL process was stopped after verification; its ignored data directory remains available for another isolated rehearsal.

The Docker CI workflow now provisions a disposable PostgreSQL 18 service, applies/verifies migrations and enables integration tests. That CI configuration has not been executed here. PostgreSQL **18/PostGIS**, TLS, Docker, restore/load testing, live Firebase and client/device verification remain outstanding. The readiness endpoint continues to require version 18; local PG15 evidence does not change that production requirement.

## Remaining scope

Legacy missions, volunteer operations, telemetry, storage and analytics still return `TENANT_MIGRATION_REQUIRED`. They need reviewed ownership backfills, composite ownership constraints and service refactoring. Units/regions, domain proof, enterprise setup, imports/join requests, automated delivery, device/consent records, disaster providers/fusion, mobilization and both client screen matrices remain unfinished. This slice does not complete Steps 1 or 2, and does not authorize deployment.
