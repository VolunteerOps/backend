import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getFirebaseIdentityVerifier } from '../core/firebase.js';
import { createFirebaseAuthenticator } from './firebase-auth.middleware.js';
import { ApiError } from '../core/errors.js';
import { prisma } from '../core/prisma.js';

export interface AuthPayload {
  userId: number;
  email: string;
  role: 'SUPER_ADMIN' | 'COORDINATOR' | 'TEAM_LEAD' | 'VOLUNTEER' | 'admin' | 'volunteer';
  name: string;
  tokenType?: 'access' | 'refresh';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      tokenExpired?: boolean;
    }
  }
}

export function extractToken(req: Request): string | null {
  // 1. Bearer Token Header (Mobile / Desktop KMP clients)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. httpOnly Access Token Cookie (Web Client)
  if (req.cookies && req.cookies['vops_access_token']) {
    return req.cookies['vops_access_token'];
  }

  // 3. Legacy session cookie support
  if (req.cookies && req.cookies['vops_session']) {
    return req.cookies['vops_session'];
  }

  return null;
}

interface CurrentAccount {
  id: number;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'COORDINATOR' | 'TEAM_LEAD' | 'VOLUNTEER';
  isActive: boolean;
}

export function createLegacyAuthenticator(
  verify: (token: string) => unknown,
  loadAccount: (id: number) => Promise<CurrentAccount | null>,
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    req.user = undefined;
    req.tokenExpired = false;
    const token = extractToken(req);
    if (!token) return next();

    let userId: number;
    try {
      const payload = verify(token);
      if (!payload || typeof payload !== 'object' || !('userId' in payload) ||
          typeof payload.userId !== 'number' || !Number.isSafeInteger(payload.userId) || payload.userId < 1 ||
          ('tokenType' in payload && payload.tokenType !== 'access')) return next();
      userId = payload.userId;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) req.tokenExpired = true;
      return next();
    }

    try {
      const account = await loadAccount(userId);
      if (account?.isActive && account.id === userId &&
          ['SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'VOLUNTEER'].includes(account.role)) {
        req.user = {
          userId: account.id, email: account.email, name: account.fullName, role: account.role, tokenType: 'access',
        };
      }
    } catch {
      return next(new ApiError(503, 'AUTHORIZATION_UNAVAILABLE', 'Current account authorization is unavailable'));
    }
    next();
  };
}

export const authenticate = createFirebaseAuthenticator(
  getFirebaseIdentityVerifier,
  async identity => {
    const mapping = await prisma.firebaseIdentity.findUnique({
      where: { projectId_uid: { projectId: identity.projectId, uid: identity.uid } },
      include: { user: true },
    });
    return mapping ? { ...mapping.user, revokedBefore: mapping.revokedBefore } : null;
  },
);

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (req.tokenExpired) {
    throw ApiError.unauthorized('Access token has expired. Please refresh your session.', 'TOKEN_EXPIRED');
  }
  if (!req.user) {
    throw ApiError.unauthorized('You must be logged in to access this resource', 'UNAUTHORIZED');
  }
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Authentication required');
    }

    const normalizedRole = req.user.role.toUpperCase();
    const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

    if (normalizedRole === 'ADMIN' || !normalizedAllowed.includes(normalizedRole)) {
      throw ApiError.forbidden(`Access denied. Requires role: ${allowedRoles.join(', ')}`);
    }

    next();
  };
}

export const requireAdmin = requireRole('SUPER_ADMIN', 'COORDINATOR');
export const requireCoordinator = requireRole('SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD');
