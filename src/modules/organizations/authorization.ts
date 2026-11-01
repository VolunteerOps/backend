import { ApiError } from '../../core/errors.js';
import type { VerifiedFirebaseIdentity } from '../../core/firebase.js';

export type OrganizationRole = 'ORG_ADMIN' | 'COORDINATOR' | 'TEAM_LEAD' | 'VOLUNTEER';
export const capabilities = {
  ORG_ADMIN: ['organization.read', 'members.read', 'members.invite', 'members.manage', 'audit.read', 'dispatch.approve', 'sentinel.configure'],
  COORDINATOR: ['organization.read', 'members.read', 'members.invite', 'dispatch.approve'],
  TEAM_LEAD: ['organization.read'],
  VOLUNTEER: ['organization.read'],
} as const;
export type Capability = typeof capabilities[OrganizationRole][number];
export interface OrganizationPolicy {
  status: string; enrollmentReady: boolean; allowedProviders: string[]; requireMfa: boolean;
}
export interface MembershipPolicy {
  userId: number; organizationId: string; role: string; status: string; regionIds: string[];
}

export function requireRecentMfa(identity: VerifiedFirebaseIdentity, now = Date.now()) {
  // Password-only is the product default. Operators may explicitly restore TOTP policy.
  if (process.env.AUTH_REQUIRE_MFA === 'true' && identity.secondFactor !== 'totp') throw ApiError.forbidden('TOTP step-up is required', 'MFA_REQUIRED');
  if (!Number.isInteger(identity.authTime) || identity.authTime * 1000 > now || now - identity.authTime * 1000 > 300_000) {
    throw ApiError.unauthorized('Sign in again before this action', 'RECENT_AUTH_REQUIRED');
  }
}

export function checkAssurance(org: OrganizationPolicy, identity: VerifiedFirebaseIdentity, privileged: boolean, now = Date.now()) {
  if (!org.allowedProviders.includes(identity.signInProvider)) {
    throw ApiError.forbidden('Use this organization’s approved sign-in method', 'SSO_REQUIRED');
  }
  if (privileged && process.env.AUTH_REQUIRE_MFA === 'true') requireRecentMfa(identity, now);
  else if (process.env.AUTH_REQUIRE_MFA === 'true' && org.requireMfa && identity.secondFactor !== 'totp') {
    throw ApiError.forbidden('TOTP step-up is required', 'MFA_REQUIRED');
  }
}

export function authorizeOrganization(org: OrganizationPolicy, member: MembershipPolicy | null,
  userId: number, organizationId: string, identity: VerifiedFirebaseIdentity, capability: Capability, now = Date.now()) {
  if (!member || member.userId !== userId || member.organizationId !== organizationId || member.status !== 'ACTIVE') {
    throw ApiError.forbidden('Active organization membership required', 'MEMBERSHIP_REQUIRED');
  }
  if (org.status !== 'ACTIVE') throw ApiError.forbidden('Organization is not active', 'ORG_NOT_ACTIVE');
  if (!org.enrollmentReady) throw ApiError.forbidden('Organization verification is pending', 'ENROLLMENT_PENDING');
  if (!Object.hasOwn(capabilities, member.role) ||
      !(capabilities[member.role as OrganizationRole] as readonly string[]).includes(capability)) {
    throw ApiError.forbidden('This membership does not permit the action', 'CAPABILITY_REQUIRED');
  }
  checkAssurance(org, identity, member.role !== 'VOLUNTEER', now);
  // Reading operational state should not expire every five minutes. Require fresh
  // password authentication only when changing admission, membership or policy.
  if (['members.invite', 'members.manage', 'sentinel.configure'].includes(capability)) requireRecentMfa(identity, now);
  // Current administration endpoints cover an entire organization. A region-limited
  // grant cannot authorize a whole roster until region-filtered administration exists.
  if (capability !== 'organization.read' && member.regionIds.length > 0) {
    throw ApiError.forbidden('Organization-wide administration requires an unrestricted membership', 'SCOPE_REQUIRED');
  }
  return member.role as OrganizationRole;
}

export function assertInvitableRole(actor: OrganizationRole, target: OrganizationRole) {
  const permitted: Record<OrganizationRole, readonly OrganizationRole[]> = {
    ORG_ADMIN: ['ORG_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER'],
    COORDINATOR: ['COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER'], TEAM_LEAD: [], VOLUNTEER: [],
  };
  if (!permitted[actor]?.includes(target)) throw ApiError.forbidden('Cannot grant the requested role', 'GRANT_EXCEEDS_AUTHORITY');
}

export function assertTransition(from: string, to: string) {
  const transitions: Record<string, readonly string[]> = {
    PROVISIONED: ['ACTIVE', 'ARCHIVED'], ACTIVE: ['SUSPENDED'],
    SUSPENDED: ['ACTIVE', 'OFFBOARDING'], OFFBOARDING: [], ARCHIVED: [],
  };
  if (!transitions[from]?.includes(to)) throw ApiError.conflict('Invalid workspace transition', 'INVALID_TRANSITION');
}
