import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { ApiError } from '../../core/errors.js';
import { assertInvitableRole, authorizeOrganization, capabilities, checkAssurance, requireRecentMfa, type OrganizationRole } from './authorization.js';
import { withActor, requireOrganization, lockOrganization, type Actor, type TenantTransaction } from './context.js';
import type { invitationSchema, membershipStatusSchema } from './organizations.schema.js';

export const invitationHash = (token: string) => createHash('sha256').update(token).digest('hex');
export async function appendAudit(tx: TenantTransaction, actor: Actor, organizationId: string,
  action: string, reason: string, metadata: Record<string, string | number | boolean | null>) {
  // INSERT without RETURNING: an invitee may append evidence but cannot read the audit log.
  await tx.organizationAudit.createMany({ data: [{
    id: randomUUID(), organizationId, actorUserId: actor.userId, action, reason, metadata,
  }] });
}

export async function issueInvitation(tx: TenantTransaction, actor: Actor, organizationId: string,
  input: z.infer<typeof invitationSchema>) {
  const token = randomBytes(32).toString('base64url');
  const invitation = await tx.organizationInvitation.create({ data: {
    id: randomUUID(), organizationId, recipientEmail: input.recipient_email, role: input.role,
    regionIds: [...new Set(input.region_ids)], tokenHash: invitationHash(token), issuerUserId: actor.userId,
    expiresAt: new Date(Date.now() + input.expires_in_hours * 3600_000),
  } });
  await appendAudit(tx, actor, organizationId, 'INVITATION_ISSUED', input.reason,
    { invitation_id: invitation.id, role: invitation.role });
  // The secret is returned once for controlled manual delivery, never persisted or audited.
  return { id: invitation.id, token, expires_at: invitation.expiresAt, delivery: 'MANUAL_DELIVERY_REQUIRED' };
}

export class OrganizationsService {
  static async memberships(actor: Actor) {
    return withActor(actor, async tx => {
      const memberships = await tx.organizationMembership.findMany({
        where: { userId: actor.userId }, orderBy: { id: 'asc' }, take: 100,
        include: { organization: { select: {
          id: true, slug: true, displayName: true, status: true, enrollmentReady: true,
          allowedProviders: true, requireMfa: true,
        } } },
      });
      const grant = await tx.platformGrant.findUnique({ where: { userId: actor.userId } });
      let platformAccess = 'PLATFORM_GRANT_REQUIRED';
      if (grant?.active) {
        try { requireRecentMfa(actor.identity); platformAccess = 'ALLOWED'; }
        catch (error) { if (!(error instanceof ApiError)) throw error; platformAccess = error.code; }
      }
      return {
        platform_grant: grant?.active ? 'TECH_ADMIN' : null,
        platform_access: platformAccess,
        platform_capabilities: platformAccess === 'ALLOWED' ? ['partners.manage'] : [],
        memberships: memberships.map(member => {
          let denied: string | null = null;
          try { authorizeOrganization(member.organization, member, actor.userId, member.organizationId, actor.identity, 'organization.read'); }
          catch (error) { if (!(error instanceof ApiError)) throw error; denied = error.code; }
          return {
            id: member.id, organization_id: member.organizationId, organization_name: member.organization.displayName,
            slug: member.organization.slug, organization_status: member.organization.status,
            role: member.role, status: member.status, version: member.version, region_ids: member.regionIds,
            access: denied ?? 'ALLOWED', capabilities: denied ? [] : member.regionIds.length > 0
              ? ['organization.read'] : capabilities[member.role as OrganizationRole],
          };
        }),
      };
    });
  }

  static async detail(actor: Actor, organizationId: string) {
    return withActor(actor, async tx => {
      const { organization, member } = await requireOrganization(tx, actor, organizationId, 'organization.read');
      return { id: organization.id, name: organization.displayName, slug: organization.slug,
        status: organization.status, version: organization.version, membership_id: member.id, role: member.role };
    });
  }

  static async roster(actor: Actor, organizationId: string, after?: string) {
    return withActor(actor, async tx => {
      await requireOrganization(tx, actor, organizationId, 'members.read');
      return tx.organizationMembership.findMany({ where: { organizationId, ...(after ? { id: { gt: after } } : {}) },
        orderBy: { id: 'asc' }, take: 100, select: { id: true, userId: true, role: true,
          status: true, version: true, regionIds: true, user: { select: { fullName: true, email: true } } } });
    });
  }

  static async invite(actor: Actor, organizationId: string, input: z.infer<typeof invitationSchema>) {
    return withActor(actor, async tx => {
      const { role } = await requireOrganization(tx, actor, organizationId, 'members.invite');
      assertInvitableRole(role, input.role);
      return issueInvitation(tx, actor, organizationId, input);
    });
  }

  static async accept(actor: Actor, token: string) {
    return withActor(actor, async tx => {
      const hash = invitationHash(token);
      await tx.$queryRaw`SELECT set_config('vops.invitation_hash', ${hash}, true)`;
      const invite = await tx.organizationInvitation.findUnique({ where: { tokenHash: hash } });
      if (!invite) throw ApiError.notFound('Invitation', 'INVITATION_UNAVAILABLE');
      // The bound invitation allows access only to its workspace, never arbitrary caller scope.
      await tx.$queryRaw`SELECT set_config('vops.organization_id', ${invite.organizationId}, true)`;
      await lockOrganization(tx, invite.organizationId);
      const current = await tx.organizationInvitation.findUniqueOrThrow({ where: { id: invite.id } });
      const organization = await tx.organization.findUniqueOrThrow({ where: { id: invite.organizationId } });
      const issuer = await tx.user.findUnique({ where: { id: current.issuerUserId }, select: { isActive: true } });
      if (!issuer?.isActive) throw ApiError.notFound('Invitation', 'INVITATION_UNAVAILABLE');
      if (organization.status !== 'ACTIVE') throw ApiError.forbidden('Organization is not active', 'ORG_NOT_ACTIVE');
      if (!organization.enrollmentReady) throw ApiError.forbidden('Organization verification is pending', 'ENROLLMENT_PENDING');
      checkAssurance(organization, actor.identity, current.role !== 'VOLUNTEER');
      if (current.revokedAt || current.recipientEmail !== actor.identity.email.toLowerCase() ||
          (current.acceptedByUserId !== null && current.acceptedByUserId !== actor.userId)) {
        throw ApiError.notFound('Invitation', 'INVITATION_UNAVAILABLE');
      }
      const existing = await tx.organizationMembership.findUnique({
        where: { organizationId_userId: { organizationId: invite.organizationId, userId: actor.userId } },
      });
      if (current.acceptedByUserId === actor.userId) {
        if (!existing || existing.status !== 'ACTIVE') throw ApiError.forbidden('Membership is no longer active', 'MEMBERSHIP_REQUIRED');
        return { membership_id: existing.id, status: existing.status };
      }
      if (current.expiresAt.getTime() <= Date.now()) throw ApiError.conflict('Invitation expired', 'INVITATION_EXPIRED');
      if (existing) throw ApiError.conflict('Existing membership requires an access review', 'MEMBERSHIP_EXISTS');
      await tx.$queryRaw`SELECT set_config('vops.admission', 'true', true)`;
      const member = await tx.organizationMembership.create({ data: {
        id: randomUUID(), organizationId: invite.organizationId, userId: actor.userId,
        role: current.role, regionIds: current.regionIds,
      } });
      await tx.organizationInvitation.update({ where: { id: invite.id }, data: {
        acceptedByUserId: actor.userId, acceptedAt: new Date(),
      } });
      await appendAudit(tx, actor, invite.organizationId, 'INVITATION_ACCEPTED', 'Recipient accepted verified invitation',
        { invitation_id: invite.id, membership_id: member.id, role: member.role });
      return { membership_id: member.id, status: member.status };
    });
  }

  static async updateMembership(actor: Actor, organizationId: string, memberId: string, input: z.infer<typeof membershipStatusSchema>) {
    return withActor(actor, async tx => {
      await requireOrganization(tx, actor, organizationId, 'members.manage');
      const member = await tx.organizationMembership.findFirst({ where: { id: memberId, organizationId } });
      if (!member) throw ApiError.notFound('Membership');
      if (member.version !== input.expected_version) throw ApiError.conflict('Membership has changed', 'STALE_VERSION');
      if (member.status === 'REMOVED') throw ApiError.conflict('Removed membership requires review', 'MEMBERSHIP_REMOVED');
      if (member.status === 'ACTIVE' && member.role === 'ORG_ADMIN') {
        const administrators = await tx.organizationMembership.count({ where: { organizationId, role: 'ORG_ADMIN', status: 'ACTIVE' } });
        if (administrators <= 1) throw ApiError.conflict('The last organization administrator must be retained', 'LAST_ADMIN_REQUIRED');
      }
      await tx.$queryRaw`SELECT set_config('vops.membership_write', 'true', true)`;
      const updated = await tx.organizationMembership.update({ where: { id: member.id }, data: {
        status: input.status, version: { increment: 1 },
      } });
      await tx.organizationInvitation.updateMany({ where: {
        organizationId, issuerUserId: member.userId, acceptedByUserId: null, revokedAt: null,
      }, data: { revokedAt: new Date() } });
      await appendAudit(tx, actor, organizationId, 'MEMBERSHIP_STATUS_CHANGED', input.reason,
        { membership_id: member.id, from: member.status, to: updated.status });
      return { id: updated.id, status: updated.status, version: updated.version };
    });
  }

  static async audit(actor: Actor, organizationId: string, after?: string) {
    return withActor(actor, async tx => {
      await requireOrganization(tx, actor, organizationId, 'audit.read');
      return tx.organizationAudit.findMany({ where: { organizationId, ...(after ? { id: { gt: after } } : {}) }, orderBy: { id: 'asc' }, take: 100 });
    });
  }

  static async revokeInvitation(actor: Actor, organizationId: string, invitationId: string, reason: string) {
    return withActor(actor, async tx => {
      const { role } = await requireOrganization(tx, actor, organizationId, 'members.invite');
      const invitation = await tx.organizationInvitation.findFirst({ where: { id: invitationId, organizationId,
        ...(role === 'ORG_ADMIN' ? {} : { issuerUserId: actor.userId }),
      } });
      if (!invitation) throw ApiError.notFound('Invitation');
      if (invitation.acceptedAt) throw ApiError.conflict('Accepted membership requires a separate access review', 'INVITATION_ALREADY_ACCEPTED');
      if (!invitation.revokedAt) {
        await tx.organizationInvitation.update({ where: { id: invitation.id }, data: { revokedAt: new Date() } });
        await appendAudit(tx, actor, organizationId, 'INVITATION_REVOKED', reason, { invitation_id: invitation.id });
      }
      return { id: invitation.id, status: 'REVOKED' };
    });
  }
}
