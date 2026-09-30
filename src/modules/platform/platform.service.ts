import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { ApiError } from '../../core/errors.js';
import { assertTransition } from '../organizations/authorization.js';
import { withActor, requirePlatform, lockOrganization, type Actor } from '../organizations/context.js';
import { appendAudit, issueInvitation } from '../organizations/organizations.service.js';
import type { provisionSchema, lifecycleSchema, verificationSchema, invitationSchema } from '../organizations/organizations.schema.js';

export class PlatformService {
  static async list(actor: Actor, after?: string) {
    return withActor(actor, async tx => {
      await requirePlatform(tx, actor);
      return tx.organization.findMany({ where: after ? { id: { gt: after } } : {}, orderBy: { id: 'asc' }, take: 100 });
    });
  }

  static async provision(actor: Actor, input: z.infer<typeof provisionSchema>) {
    return withActor(actor, async tx => {
      await requirePlatform(tx, actor);
      const existing = await tx.organization.findUnique({ where: { slug: input.slug } });
      if (existing) throw ApiError.conflict('Workspace slug is already provisioned', 'WORKSPACE_EXISTS');
      const organization = await tx.organization.create({ data: {
        id: randomUUID(), slug: input.slug, displayName: input.display_name,
        allowedProviders: [...new Set(input.allowed_providers)], requireMfa: input.require_mfa,
      } });
      await appendAudit(tx, actor, organization.id, 'ORGANIZATION_PROVISIONED', input.reason, { version: 1 });
      return organization;
    });
  }

  static async transition(actor: Actor, organizationId: string, target: 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDING', input: z.infer<typeof lifecycleSchema>) {
    return withActor(actor, async tx => {
      await requirePlatform(tx, actor);
      await lockOrganization(tx, organizationId);
      const current = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!current) throw ApiError.notFound('Organization');
      if (current.version !== input.expected_version) throw ApiError.conflict('Workspace has changed', 'STALE_VERSION');
      assertTransition(current.status, target);
      const organization = await tx.organization.update({ where: { id: organizationId }, data: {
        status: target, version: { increment: 1 }, updatedAt: new Date(),
      } });
      if (target !== 'ACTIVE') {
        // Suspended/offboarding admission cannot resume with an old invitation.
        await tx.organizationInvitation.updateMany({ where: {
          organizationId, acceptedByUserId: null, revokedAt: null,
        }, data: { revokedAt: new Date() } });
      }
      await appendAudit(tx, actor, organizationId, 'ORGANIZATION_STATUS_CHANGED', input.reason,
        { from: current.status, to: target, version: organization.version });
      return organization;
    });
  }

  static async recordVerification(actor: Actor, organizationId: string, input: z.infer<typeof verificationSchema>) {
    return withActor(actor, async tx => {
      await requirePlatform(tx, actor);
      await lockOrganization(tx, organizationId);
      const current = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!current) throw ApiError.notFound('Organization');
      if (current.status !== 'ACTIVE') throw ApiError.forbidden('Activate the workspace before verification', 'ORG_NOT_ACTIVE');
      if (current.version !== input.expected_version) throw ApiError.conflict('Workspace has changed', 'STALE_VERSION');
      const updated = await tx.organization.update({ where: { id: organizationId }, data: {
        enrollmentReady: true, verificationEvidence: input.evidence_reference, version: { increment: 1 }, updatedAt: new Date(),
      } });
      await appendAudit(tx, actor, organizationId, 'OWNER_VERIFICATION_RECORDED', input.reason,
        { evidence_reference: input.evidence_reference, version: updated.version });
      return updated;
    });
  }

  static async nominate(actor: Actor, organizationId: string, input: z.infer<typeof invitationSchema>) {
    return withActor(actor, async tx => {
      await requirePlatform(tx, actor);
      await lockOrganization(tx, organizationId);
      const organization = await tx.organization.findUnique({ where: { id: organizationId } });
      if (!organization) throw ApiError.notFound('Organization');
      if (organization.status !== 'ACTIVE') throw ApiError.forbidden('Organization must be active', 'ORG_NOT_ACTIVE');
      if (!organization.enrollmentReady) throw ApiError.forbidden('Record institutional verification first', 'ENROLLMENT_PENDING');
      return issueInvitation(tx, actor, organizationId, input);
    });
  }
}
