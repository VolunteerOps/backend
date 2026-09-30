# Organization onboarding skeleton

> Current code and verification: [organization admission and RLS](sentinel-organization-admission.md). The inventory below remains the full target scope; older implementation-status statements are superseded by that record.

Step 1 documentation; trace S04/S09/S10 in the [specification](sentinel-implementation-plan.md). **No partner workspace or affiliation is claimed provisioned or active. All enrollment/control-plane workflows remain planned.**

| State | Current evidence |
| --- | --- |
| Implemented | Onboarding checklist only, no tenant lifecycle/invitation/domain/client implementation. Parent reports standalone Firebase verification and hardened legacy signup/auth, not Firebase HTTP cutover or organization admission; local JWT remains active. See [foundation evidence](sentinel-implementation-plan.md#current-partial-step-1-baseline). |
| Owner action | Approve partnership, exact institution scope/admins/domains/entitlements, data agreement and readiness owners. |
| Blocked | Organization models/isolation, platform and enrollment APIs/screens, identity assurance, invitation email/links and readiness evidence. |
| Verified | No provisioning, DNS, SSO, invitation, membership isolation or partner drill checked here. |

## Required intake record

Every field is `REQUIRED` before the relevant gate: partnership approval/reference; organization legal/display identity and slug; units/country offices versus separate organizations; nominated admin verified identity/intended email and preauthorized role; domains or approved alternative control evidence; regions/unit/function scope; entitlements/quotas; authentication/MFA policy; retention/residency/transfer and deletion/hold agreement; support/escalation/response lead; locale/timezone/guidance; invite-email sender/link origins; training/consent/readiness owners. A logo/shared domain/parent label does not imply access or affiliation.

Store approved nonsecret lifecycle/grants/policy/audit in scoped PostgreSQL records once implemented. Invitation secrets are random, hashed, expiring and bound to org/recipient/role/issuer/use limit, never logged. Provider credentials stay in [enterprise secret storage](enterprise-identity-setup.md). No exact console/API mutation commands exist until planned endpoints and client routes are implemented; the [API inventory](sentinel-api-contracts.md) is a contract target, not execution instructions.

## Planned gated lifecycle

1. Rate-limited public partnership request or unassigned Firebase signup creates no active organization/admin/dashboard. Only explicit tech-admin approval creates `PROVISIONED` workspace, nominated admins, domains/scopes/entitlements/quotas/data policy.
2. Owner explicitly activates `ACTIVE` workspace, enabling bounded enrollment/domain tasks. Keep workspace status separate from domain/SSO readiness and membership; activation alone grants no operational admission.
3. Nominated admin verifies identity/MFA and institutional control under owner-limited enrollment grant. Use normalized exact-label single-use DNS challenge or audited owner-approved alternative if parent-domain DNS is unavailable; no automatic parent/UN/Red Cross identity claim. SSO is tested before required, with organization-specific assurance on every privileged request.
4. Initial admin role is preauthorized. Org admins can invite only permitted lower/equal roles, review join requests and preview/deduplicate roster imports with per-row results. Imports create unclaimed drafts/invitations, not passwords or email-only linked accounts. Personal-email volunteers/external coordinators may be invited. Domain-eligible self-service defaults to volunteer/join-pending after activation, never admin.
5. Verified invitation acceptance is atomically single-use; controlled HTTPS/App Links/deferred-install/manual-code flows neither sign in nor mutate role automatically. Public store installation confers no membership. Distinguish generated invitation from email actually delivered.
6. Complete region-specific readiness and scopes before operational access. Shared identity permits multiple isolated memberships; org switches preserve draft owner and enforce new SSO/MFA. Explicit bilateral expiring coordination grants with one lead org replace unrestricted roster sharing.
7. `SUSPENDED`, `OFFBOARDING`, `ARCHIVED` deny actions/admission appropriately, revoke online scope/streams/queued delivery/invites and retry remote revocation without reactivation. Audit active mission/assistance handover, assignment/resource reconciliation and retention; do not erase evidence or other memberships. Global identity controls belong to tech admin; user privacy deletion remains a verified supported flow.

## Verification and readiness record

No commands run. After implementation record actual API/CLI/UI checks in staging: A/B/unassigned/owner access matrix; inactive discovery/activation race; DNS lookalike/replay/shared-domain dispute; forged/expired/concurrent invite acceptance; initial-admin escalation; import results/roster privacy; wrong SSO/MFA and social bypass; organization switch/cache/media/stream/export isolation; revocation during pending work; cross-org double booking; bilateral expiry; scoped removal versus global delete and handover.

Each organization/region checklist records owner/status/evidence/blocker/date for: activation; DNS/SSO/admin access; volunteer admission/consent/training; verified sources; approved local warning/evacuation SOP; resources/safe staging; real push acknowledgement; offline map/report workflow; human escalation/on-call; seasonal drill; deployment authority. Checklist completion is not scientific certification. See [Kenya readiness](kenya-seasonal-readiness.md) for regional detail and [operations](sentinel-operations-runbook.md) for recovery. No production cutover or live response activation authorized.