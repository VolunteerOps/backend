# Platform-owner bootstrap skeleton

> Current code and verification: [organization admission and RLS](sentinel-organization-admission.md). The inventory below remains the full target scope; older implementation-status statements are superseded by that record.

Step 1 documentation; trace S04/S09/S10 in the [specification](sentinel-implementation-plan.md). **Bootstrap implementation belongs to planned later delivery; no owner grant or command was created/run here.** No public bootstrap route, default account/password, first-signup grant or production cutover is authorized.

| State | Current evidence |
| --- | --- |
| Implemented | Bootstrap document only. Parent standalone Firebase verifier emits identity without grants and is not wired to HTTP. Legacy public signup rejects privileged roles and middleware removes admin/implicit `SUPER_ADMIN` bypasses; neither creates a `TECH_ADMIN` grant or implements owner bootstrap. |
| Owner action | Supply chosen verified Firebase project/UID and recent-auth/MFA proof through secured operator configuration; nominate approval/recovery contacts. |
| Blocked | Platform grant schema, guarded authenticated operator command, audit/last-owner/recovery tests and real identity/MFA setup. |
| Verified | No bootstrap, owner/org separation, empty-grant guard or break-glass exercise performed. |

## Required values and secret placement

`REQUIRED`: environment/project ID; chosen Firebase UID (not guessed from email); approved internal identity mapping; recent verified identity and MFA evidence; authorized operator runtime identity; secret-manager references for deployment/database/Admin credentials; change approval/reason; independent recovery contacts; audit destination; permitted recovery window. UID is not a secret password, but provision it through secured operator inputs, not a public request or committed default. Do not publish service credentials/MFA recovery material.

## Planned guarded procedure

1. Complete Firebase/current-PG authorization foundation and explicit legacy-role review. Existing `SUPER_ADMIN` rows must not automatically become platform owners.
2. Implement and review an authenticated one-time out-of-band command with exact project/UID validation, recent auth/verified email/MFA, empty-platform-grant guard, concurrency/idempotency protection and atomic immutable audit. It grants explicit `TECH_ADMIN`, separate from organization roles. No new command name is claimed by this skeleton; **execution blocked until its actual path/options and tests are documented**.
3. Owner supplies approved secure inputs and runs only the reviewed command in the named environment after authorization. Record sanitized actor/target/context/reason/result; remove one-time bootstrap authority after success.
4. Verify same admin app has visibly separate Platform/Organization context. Platform provisioning/activation and time-bound audited support access use explicit policies, not a database superuser/RLS bypass or silent impersonation.
5. Protect the last active owner against deletion/demotion/disable; sensitive actions require step-up, impact/scope confirmation and reason. Org admins cannot grant platform authority. Global account deletion differs from organization removal and verified self-service deletion rights/holds.

## Verification and recovery backlog

No executable bootstrap command currently documented or run. Future automated checks: unauthenticated/wrong project/unverified/no MFA/old-auth rejection; first-signup/email-domain/body-role rejection; empty-grant race/replay; last-owner guard; cross-org/platform separation; transaction/audit failure rollback. Then owner tests actual MFA and operator access in staging and records the real command/revision/result.

Break-glass recovery requires separately secured credentials, explicit approver/impact/reason, time-bound access, owner notification, append-only audit and key rotation after use. Rehearse without leaving a backdoor/default password; provider failure must not silently restore access. Exact command and recovery mechanism remain blocked on later implementation and owner choice. Do not bootstrap by manual undocumented SQL or public `/api/auth/firebase/bootstrap` (that route is only planned unassigned identity provisioning).