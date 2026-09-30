> Current delivery authority (1 October 2026): [seven-stage roadmap](resq-production-implementation-roadmap.md) and [Railway runbook](railway-production-deployment-runbook.md). This specialist document retains detailed requirements and dated evidence; older status, authentication, hosting and completion claims are superseded by the [current checkpoint](sentinel-continuation-status.md). Public volunteer accounts, consented recruitment and Pro enforcement follow the new roadmap.

# Enterprise identity setup skeleton

> Current code and verification: [organization admission and RLS](sentinel-organization-admission.md). The inventory below remains the full target scope; older implementation-status statements are superseded by that record.

Step 1 documentation; trace S04/S08/S10 in the [specification](sentinel-implementation-plan.md). **Enterprise enrollment is planned, not activated. No production/provider/billing change authorized.**

| State | Current evidence |
| --- | --- |
| Implemented | Enterprise checklist only; parent standalone Firebase Admin ADC verifier supplies sanitized identity without grants and is not wired to HTTP. Legacy local JWT remains active; institution federation, assurance policies and tenant admission remain planned. See [foundation evidence](sentinel-implementation-plan.md#current-partial-step-1-baseline). |
| Owner action | Enable approved Identity Platform/billing/MFA and owner-activate each partner; institution IT supplies trusted metadata/test users and domain evidence. |
| Blocked | Organization lifecycle/grants, per-request assurance, supported platform flows, provider configuration, domains and real test evidence. |
| Verified | No real SAML/OIDC/MFA/domain/certificate rotation or deprovisioning check performed. |

## Required project/institution inputs

For every environment/organization record `REQUIRED`: shared Firebase/Identity Platform project ID; approved org ID/slug and activation decision; exact domains; nominated initial admin verified UID/recipient; institution IT/security contacts; enabled provider connection ID; allowed methods; MFA/recent-auth policy; approved claims/group-to-bounded-role mapping; region/unit scopes; data residency/retention and recovery owner.

- SAML: exact IdP entity ID, SSO endpoint, metadata source and signing certificates/expiry, service-provider entity/ACS values from the configured console, test accounts. Use supported SP-initiated flow; no assumed IdP-initiated parity.
- OIDC: exact trusted issuer/discovery metadata, client ID, secret reference, scopes/claims and console-generated exact redirect URLs; validate signature/audience/issuer through supported SDKs. Never construct a login URL from user-submitted domain metadata.
- MFA: supported Firebase TOTP or explicitly validated institution MFA evidence, recent-auth bounds, recovery process and per-target step-up support. Linked-provider presence is not evidence of the current session's assurance; password/social cannot bypass SSO-only access.

## Actions and credential placement

1. Use one shared Firebase directory, not an assumed project/tenant per institution. Upgrade/enable Identity Platform only with owner billing approval. Configure a distinct allowlisted SAML/OIDC connection where required in its console.
2. Owner provisions/activates partner before DNS/SSO self-service; pending enrollment grants allow only nominated setup tasks, no operational data. Use exact-label normalized domain challenges or audited owner-approved alternative evidence. Mailbox control is not organization authority.
3. Institution IT installs exact redirects/ACS, allowlisted claims and test assignments. Store client secrets/cert private keys only in provider console/secret manager; PG holds trusted metadata/secret references and policy, not plaintext secrets. Final application config keys/paths remain pending implementation.
4. Implement supported SDK/native/system-browser flows in both clients after workspace inspection. Unsupported secure target/provider flow stays blocked, with no custom-token shortcut that loses MFA, long-lived VolunteerOps token or token-in-URL fallback.
5. Test SSO before requiring it. Explicit initial admin grants and allowlisted role mappings are bounded to owner-authorized organization roles; domains/groups never grant platform access. Invitations can admit personal-email volunteers/external coordinators under policy.

## Verification and rotation — pending

No enterprise verifier/console automation command exists in this documentation task. Once implemented, record actual endpoint/test commands from [contracts](sentinel-api-contracts.md); do not run imagined CLI enrollment commands. Manual integration evidence must cover correct issuer/provider/audience, wrong institution, SSO-only versus linked password/social, verified email/MFA/recent auth on cookie sessions and every privileged switch/mutation, denied unactivated/removed users, logout/revoke-all and account collision.

Institution IT must rehearse signing-certificate/client-secret rotation, metadata refresh trust, MFA recovery and deprovisioning in staging. PG denies removed membership immediately while remote operations retry idempotently; failures cannot reactivate it. Retain audit, mission/assistance handover and last-owner protections. Directory-wide SCIM sync is **not assumed**: reviewed membership import/removal/revocation is the baseline; any connector is an explicit separate integration. Blocking inputs/implementation/provider support remain open; no enterprise access verified.