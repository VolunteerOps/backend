import type { Request } from 'express';
import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';
import type { VerifiedFirebaseIdentity } from '../../core/firebase.js';
import { authorizeOrganization, requireRecentMfa, type Capability } from './authorization.js';

export interface Actor { userId: number; identity: VerifiedFirebaseIdentity }
export type TenantTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export async function lockOrganization(tx: TenantTransaction, organizationId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'vops:organization:' + organizationId}, 0))::text`;
}
export function requestActor(req: Request): Actor {
  if (!req.user || !req.firebaseIdentity) throw ApiError.unauthorized();
  return { userId: req.user.userId, identity: req.firebaseIdentity };
}

/** Context is transaction-local, reconstructed from verified identity each time. */
export async function withActor<T>(actor: Actor, action: (tx: TenantTransaction) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    const role = await tx.$queryRaw<Array<{ unsafe: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_roles WHERE
        (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)
        AND pg_has_role(current_user, oid, 'MEMBER')) OR EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('organizations', 'organization_memberships',
          'organization_invitations', 'organization_audit', 'platform_grants', 'member_devices', 'ingress_receipts',
          'stored_objects', 'organization_units', 'forecast_runs', 'volunteers', 'skills', 'volunteer_skills', 'locations',
          'events', 'deployments', 'field_reports', 'communications', 'notifications', 'telemetry_pings', 'feedback',
          'volunteer_profiles', 'directory_preferences', 'profile_shares', 'recruitment_blocks', 'consent_records',
          'account_deletion_requests', 'recruitment_reports', 'personal_audit', 'join_requests', 'domain_claims',
          'support_access_grants', 'coordination_grants', 'partner_applications', 'responder_reservations')
          AND pg_has_role(current_user, c.relowner, 'MEMBER')) AS unsafe`;
    if (role.length !== 1 || role[0].unsafe) {
      throw new ApiError(503, 'UNSAFE_RUNTIME_ROLE', 'Tenant operations require a non-owner runtime database role');
    }
    // Account disable and session revocation serialize with sensitive actions.
    const accounts = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT u.id FROM public.users u JOIN public.firebase_identities f ON f.user_id = u.id
      WHERE u.id = ${actor.userId} AND u.is_active = true
        AND f.project_id = ${actor.identity.projectId} AND f.uid = ${actor.identity.uid}
        AND (f.revoked_before IS NULL OR f.revoked_before < (to_timestamp(${actor.identity.authTime}) AT TIME ZONE 'UTC'))
      FOR SHARE OF u, f`;
    if (accounts.length !== 1 || actor.identity.expiresAt * 1000 <= Date.now()) {
      throw ApiError.unauthorized('Account or session is no longer active', 'SESSION_REVOKED');
    }
    await tx.$queryRaw`SELECT set_config('vops.user_id', ${String(actor.userId)}, true),
      set_config('vops.email', ${actor.identity.email.toLowerCase()}, true),
      set_config('vops.retention', '', true), set_config('vops.operations', '', true), set_config('vops.all_regions', '', true),
      set_config('vops.region_id', '', true), set_config('vops.organization_id', '', true), set_config('vops.platform', '', true),
      set_config('vops.public_workspaces', '', true), set_config('vops.organization_settings', '', true), set_config('vops.directory', '', true), set_config('vops.share_hash', '', true), set_config('vops.invitation_issuer', '', true), set_config('vops.roster', '', true), set_config('vops.admission', '', true),
      set_config('vops.membership_write', '', true), set_config('vops.invitation_hash', '', true)`;
    return action(tx);
  }, { maxWait: 5000, timeout: 10_000 });
}

export async function requirePlatform(tx: TenantTransaction, actor: Actor) {
  requireRecentMfa(actor.identity);
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('vops:platform-grants', 0))::text`;
  const grants = await tx.$queryRaw<Array<{ user_id: number }>>`
    SELECT user_id FROM public.platform_grants WHERE user_id = ${actor.userId}
      AND active = true AND role = 'TECH_ADMIN'`;
  if (grants.length !== 1) throw ApiError.forbidden('Explicit platform grant required', 'PLATFORM_GRANT_REQUIRED');
  await tx.$queryRaw`SELECT set_config('vops.platform', 'true', true)`;
}

export async function requireOrganization(tx: TenantTransaction, actor: Actor, organizationId: string, capability: Capability) {
  const member = await tx.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: actor.userId } },
  });
  if (!member || member.status !== 'ACTIVE') throw ApiError.forbidden('Active organization membership required', 'MEMBERSHIP_REQUIRED');
  // A shared advisory key serializes every lifecycle/membership path without
  // granting ordinary members UPDATE policies on the organization itself.
  await lockOrganization(tx, organizationId);
  const organization = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const current = await tx.organizationMembership.findUnique({ where: { id: member.id } });
  const role = authorizeOrganization(organization, current, actor.userId, organizationId, actor.identity, capability);
  await tx.$queryRaw`SELECT set_config('vops.organization_id', ${organizationId}, true),
    set_config('vops.roster', ${capability === 'organization.read' ? '' : 'true'}, true)`;
  return { organization, member: current!, role };
}
