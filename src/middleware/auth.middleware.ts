import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../core/config.js';
import { ApiError } from '../core/errors.js';

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

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as AuthPayload;
    if (payload.tokenType && payload.tokenType !== 'access') {
      return next();
    }
    req.user = payload;
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      req.tokenExpired = true;
    }
    // Token invalid or expired, continue unauthenticated
  }
  next();
}

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

    // Map legacy 'admin' to COORDINATOR / SUPER_ADMIN
    if (normalizedRole === 'ADMIN') {
      return next();
    }

    if (!normalizedAllowed.includes(normalizedRole) && normalizedRole !== 'SUPER_ADMIN') {
      throw ApiError.forbidden(`Access denied. Requires role: ${allowedRoles.join(', ')}`);
    }

    next();
  };
}

export const requireAdmin = requireRole('SUPER_ADMIN', 'COORDINATOR', 'admin');
export const requireCoordinator = requireRole('SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'admin');
