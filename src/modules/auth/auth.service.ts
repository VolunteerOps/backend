import { prisma } from '../../core/prisma.js';
import { ApiError } from '../../core/errors.js';
import type { VerifiedFirebaseIdentity } from '../../core/firebase.js';
import { signupSchema } from './auth.schema.js';
import { randomUUID } from 'node:crypto';

const publicProfile = {
  id: true, email: true, fullName: true, phoneNumber: true, avatarUrl: true,
  isActive: true, createdAt: true, updatedAt: true,
} as const;

export const retiredPasswordAuth = () => new ApiError(410, 'FIREBASE_AUTH_REQUIRED',
  'Use Firebase Authentication for sign-in, registration, token refresh and password recovery');

export class AuthService {
  static async revokeSessions(userId: number, identity: VerifiedFirebaseIdentity) {
    if (Math.floor(Date.now() / 1000) - identity.authTime > 300) {
      throw ApiError.unauthorized('Recent sign-in required', 'RECENT_AUTH_REQUIRED');
    }
    return prisma.$transaction(async tx => {
      const updated = await tx.$queryRaw<Array<{ id: number }>>`
        UPDATE firebase_identities f SET revoked_before = (clock_timestamp() AT TIME ZONE 'UTC')
        FROM users u WHERE f.user_id = ${userId} AND u.id = f.user_id AND u.is_active = true
          AND f.project_id = ${identity.projectId} AND f.uid = ${identity.uid}
          AND (f.revoked_before IS NULL OR f.revoked_before < (to_timestamp(${identity.authTime}) AT TIME ZONE 'UTC'))
        RETURNING f.id`;
      if (updated.length !== 1) throw ApiError.unauthorized('Account or session is no longer active', 'SESSION_REVOKED');
      const id = randomUUID();
      await tx.durableJob.create({ data: {
        id, businessKey: `firebase-revocation:${id}`, queue: 'identity', kind: 'FIREBASE_REVOKE_SESSIONS',
        payload: { projectId: identity.projectId, uid: identity.uid },
      } });
      await tx.auditLog.create({ data: { userId, action: 'REVOKE_FIREBASE_SESSIONS', entityType: 'User', entityId: userId } });
      return { local_revocation: 'APPLIED', firebase_revocation: 'QUEUED' };
    });
  }

  static async signup(data: unknown) {
    signupSchema.parse(data);
    throw retiredPasswordAuth();
  }

  static async bootstrap(identity: VerifiedFirebaseIdentity, fullName: string,
    database: Pick<typeof prisma, '$transaction'> = prisma) {
    const key = { projectId: identity.projectId, uid: identity.uid };
    return database.$transaction(async tx => {
      // Serialize concurrent bootstrap retries before checking for a mapping.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(key)}, 0))::text`;
      const existing = await tx.firebaseIdentity.findUnique({ where: { projectId_uid: key }, include: { user: true } });
      if (existing) {
        if (!existing.user.isActive || (existing.revokedBefore && identity.authTime * 1000 <= existing.revokedBefore.getTime())) {
          throw ApiError.unauthorized('Account or session is no longer active', 'SESSION_REVOKED');
        }
        return tx.user.findUniqueOrThrow({ where: { id: existing.userId }, select: publicProfile });
      }
      const addressOwner = await tx.user.findFirst({
        where: { email: { equals: identity.email, mode: 'insensitive' } }, select: { id: true },
      });
      // Email equality never proves ownership of a legacy account.
      if (addressOwner) throw ApiError.conflict('Account migration requires reviewed identity binding', 'IDENTITY_MIGRATION_REQUIRED');
      const user = await tx.user.create({ data: {
        email: identity.email.toLowerCase(), fullName, role: 'VOLUNTEER', passwordHash: null,
        firebaseIdentity: { create: key },
      }, select: publicProfile });
      await tx.auditLog.create({ data: { userId: user.id, action: 'FIREBASE_BOOTSTRAP', entityType: 'User', entityId: user.id } });
      return user;
    }).catch(error => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        throw ApiError.conflict('Identity enrollment conflict; retry or request reviewed migration', 'IDENTITY_CONFLICT');
      }
      throw error;
    });
  }

  static async getMe(userId: number) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: publicProfile });
    if (!user?.isActive) throw ApiError.unauthorized('Account is unavailable');
    return user;
  }

  static async updateProfile(userId: number, data: { full_name?: string; phone_number?: string; avatar_url?: string }) {
    return prisma.$transaction(async tx => {
      const updated = await tx.user.updateMany({ where: { id: userId, isActive: true }, data: {
        fullName: data.full_name, phoneNumber: data.phone_number, avatarUrl: data.avatar_url,
      } });
      if (updated.count !== 1) throw ApiError.unauthorized('Account is unavailable');
      return tx.user.findUniqueOrThrow({ where: { id: userId }, select: publicProfile });
    });
  }
}
