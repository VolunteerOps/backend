import assert from 'node:assert/strict';
import { test } from 'node:test';
import { authorizeOrganization, assertInvitableRole, assertTransition, requireRecentMfa } from '../src/modules/organizations/authorization.js';
import type { VerifiedFirebaseIdentity } from '../src/core/firebase.js';
import { provisionSchema, invitationSchema, acceptInvitationSchema } from '../src/modules/organizations/organizations.schema.js';

const now = 1_800_000_000_000;
const identity: VerifiedFirebaseIdentity = { projectId: 'demo-sentinel', uid: 'u', email: 'u@example.org',
  authTime: now / 1000 - 20, expiresAt: now / 1000 + 3600, signInProvider: 'saml.agency', secondFactor: 'totp' };
const organization = { status: 'ACTIVE', enrollmentReady: true, allowedProviders: ['saml.agency'], requireMfa: false };
const member = { userId: 5, organizationId: 'org-a', role: 'ORG_ADMIN', status: 'ACTIVE', regionIds: [] as string[] };

test('organization authorization checks identity, organization and active membership', () => {
  assert.equal(authorizeOrganization(organization, member, 5, 'org-a', identity, 'members.invite', now), 'ORG_ADMIN');
  for (const invalid of [null, { ...member, userId: 6 }, { ...member, organizationId: 'org-b' }, { ...member, status: 'SUSPENDED' }]) {
    assert.throws(() => authorizeOrganization(organization, invalid, 5, 'org-a', identity, 'organization.read', now), { code: 'MEMBERSHIP_REQUIRED' });
  }
});
test('suspended and unverified organizations reject otherwise valid members', () => {
  assert.throws(() => authorizeOrganization({ ...organization, status: 'SUSPENDED' }, member, 5, 'org-a', identity, 'organization.read', now), { code: 'ORG_NOT_ACTIVE' });
  assert.throws(() => authorizeOrganization({ ...organization, enrollmentReady: false }, member, 5, 'org-a', identity, 'organization.read', now), { code: 'ENROLLMENT_PENDING' });
});
test('social login cannot satisfy an SSO-only policy', () => {
  assert.throws(() => authorizeOrganization(organization, member, 5, 'org-a', { ...identity, signInProvider: 'google.com' }, 'organization.read', now), { code: 'SSO_REQUIRED' });
});
test('privileged actions require recent TOTP evidence', () => {
  for (const secondFactor of [null, 'phone'] as const) assert.throws(() => requireRecentMfa({ ...identity, secondFactor }, now), { code: 'MFA_REQUIRED' });
  assert.throws(() => requireRecentMfa({ ...identity, authTime: now / 1000 - 301 }, now), { code: 'RECENT_AUTH_REQUIRED' });
  assert.throws(() => requireRecentMfa({ ...identity, authTime: now / 1000 + 1 }, now), { code: 'RECENT_AUTH_REQUIRED' });
});
test('legacy global roles and prototype keys are not organization roles', () => {
  for (const role of ['SUPER_ADMIN', 'ADMIN', 'TECH_ADMIN', '__proto__', 'constructor']) {
    assert.throws(() => authorizeOrganization(organization, { ...member, role }, 5, 'org-a', identity, 'organization.read', now), { code: 'CAPABILITY_REQUIRED' });
  }
});
test('region-limited grant cannot administer an entire roster', () => {
  assert.throws(() => authorizeOrganization(organization, { ...member, regionIds: ['region-a'] }, 5, 'org-a', identity, 'members.read', now), { code: 'SCOPE_REQUIRED' });
});
test('invitation roles never exceed the issuer role', () => {
  assertInvitableRole('COORDINATOR', 'VOLUNTEER');
  assert.throws(() => assertInvitableRole('COORDINATOR', 'ORG_ADMIN'), { code: 'GRANT_EXCEEDS_AUTHORITY' });
  assert.throws(() => assertInvitableRole('VOLUNTEER', 'VOLUNTEER'), { code: 'GRANT_EXCEEDS_AUTHORITY' });
});
test('workspace lifecycle has no implicit reactivation or offboarding completion', () => {
  assertTransition('PROVISIONED', 'ACTIVE'); assertTransition('ACTIVE', 'SUSPENDED');
  assert.throws(() => assertTransition('ARCHIVED', 'ACTIVE'), { code: 'INVALID_TRANSITION' });
  assert.throws(() => assertTransition('OFFBOARDING', 'ARCHIVED'), { code: 'INVALID_TRANSITION' });
});
test('strict schemas reject privilege injection and bound tokens and provider identifiers', () => {
  assert.equal(provisionSchema.safeParse({ slug: 'agency', display_name: 'Agency', allowed_providers: ['attacker.provider'], reason: 'Approved partnership' }).success, false);
  assert.equal(invitationSchema.safeParse({ recipient_email: 'u@example.org', role: 'TECH_ADMIN', reason: 'Reviewed admission' }).success, false);
  assert.equal(acceptInvitationSchema.safeParse({ token: 'a'.repeat(43), role: 'ORG_ADMIN' }).success, false);
  assert.equal(acceptInvitationSchema.safeParse({ token: 'a'.repeat(43) }).success, true);
});
