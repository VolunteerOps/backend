import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../core/errors.js';
import type { VerifiedFirebaseIdentity } from '../core/firebase.js';

export const SESSION_COOKIE = 'vops_firebase_session';
export interface FirebaseAccount {
  id: number; email: string; fullName: string;
  role: 'SUPER_ADMIN' | 'COORDINATOR' | 'TEAM_LEAD' | 'VOLUNTEER';
  isActive: boolean; revokedBefore: Date | null;
}
export interface IdentityGateway {
  verifyIdToken(token: string): Promise<VerifiedFirebaseIdentity>;
  verifySessionCookie(token: string): Promise<VerifiedFirebaseIdentity>;
}

declare global {
  namespace Express {
    interface Request {
      firebaseIdentity?: VerifiedFirebaseIdentity;
      firebaseCredential?: 'bearer' | 'cookie';
    }
  }
}

export function createFirebaseAuthenticator(
  gateway: () => IdentityGateway,
  loadAccount: (identity: VerifiedFirebaseIdentity) => Promise<FirebaseAccount | null>,
) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    req.user = undefined;
    req.firebaseIdentity = undefined;
    req.firebaseCredential = undefined;
    // Browser session clearing must work even when its old cookie is expired or invalid.
    // Both routes enforce their own exact Origin and custom-header CSRF guard.
    if ((req.method === 'POST' && req.path === '/api/auth/logout') ||
        (req.method === 'DELETE' && req.path === '/api/auth/session')) return next();
    const header = req.headers.authorization;
    const cookie: unknown = req.cookies?.[SESSION_COOKIE];
    if (header === undefined && cookie === undefined) return next();
    try {
      // Never fall back to a cookie when an explicit bearer credential is invalid.
      let identity: VerifiedFirebaseIdentity;
      if (header !== undefined) {
        if (!/^Bearer [^\s]+$/i.test(header)) throw ApiError.unauthorized('Invalid authorization header');
        identity = await gateway().verifyIdToken(header.slice(7));
        req.firebaseCredential = 'bearer';
      } else {
        if (typeof cookie !== 'string') throw ApiError.unauthorized('Invalid session cookie');
        identity = await gateway().verifySessionCookie(cookie);
        req.firebaseCredential = 'cookie';
      }
      let account: FirebaseAccount | null;
      try { account = await loadAccount(identity); }
      catch { throw new ApiError(503, 'AUTHORIZATION_UNAVAILABLE', 'Current account authorization is unavailable'); }
      if (account && (!account.isActive ||
          (account.revokedBefore && identity.authTime * 1000 <= account.revokedBefore.getTime()))) {
        throw ApiError.unauthorized('Account or session is no longer active', 'SESSION_REVOKED');
      }
      req.firebaseIdentity = identity;
      if (account) req.user = {
        userId: account.id, email: account.email, name: account.fullName, role: account.role,
      };
      next();
    } catch (error) {
      req.firebaseIdentity = undefined;
      req.firebaseCredential = undefined;
      next(error instanceof ApiError ? error : new ApiError(503, 'IDENTITY_UNAVAILABLE', 'Identity verification is unavailable'));
    }
  };
}

export function createSessionOriginGuard(origins: readonly string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!origin || origin === 'null' || !origins.includes(origin) ||
        req.headers['x-requested-with'] !== 'VolunteerOps') {
      return next(ApiError.forbidden('Trusted origin and X-Requested-With: VolunteerOps required', 'CSRF_REJECTED'));
    }
    next();
  };
}

export function createCookieMutationGuard(origins: readonly string[]) {
  const check = createSessionOriginGuard(origins);
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.firebaseCredential === 'cookie' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return check(req, res, next);
    }
    next();
  };
}
