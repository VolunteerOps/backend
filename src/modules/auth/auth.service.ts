import crypto from 'crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../../core/prisma.js';
import { config } from '../../core/config.js';
import { ApiError } from '../../core/errors.js';
import { AuthPayload } from '../../middleware/auth.middleware.js';

export interface ClientMetadata {
  userAgent?: string;
  ipAddress?: string;
  family?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number; // in seconds (900s / 15m)
}

export class AuthService {
  static async signup(
    data: { email: string; password: string; full_name: string; role?: string; phone_number?: string },
    clientInfo?: ClientMetadata
  ) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(data.password);
    const normalizedRole = (data.role?.toUpperCase() === 'ADMIN' ? 'COORDINATOR' : data.role?.toUpperCase()) || 'VOLUNTEER';

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        fullName: data.full_name,
        role: normalizedRole as any,
        phoneNumber: data.phone_number,
      },
    });

    const tokens = await this.generateTokens(user, clientInfo);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  static async login(
    data: { email: string; password: string },
    clientInfo?: ClientMetadata
  ) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const valid = await argon2.verify(user.passwordHash, data.password);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user, clientInfo);
    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  static async refresh(
    refreshTokenString: string,
    clientInfo?: ClientMetadata
  ) {
    if (!refreshTokenString) {
      throw ApiError.unauthorized('Refresh token is required', 'MISSING_REFRESH_TOKEN');
    }

    const refreshSecret = config.JWT_REFRESH_SECRET || config.JWT_SECRET;
    let decoded: any;

    try {
      decoded = jwt.verify(refreshTokenString, refreshSecret);
    } catch {
      throw ApiError.unauthorized('Refresh token is invalid or has expired', 'INVALID_REFRESH_TOKEN');
    }

    if (decoded.tokenType !== 'refresh' || !decoded.userId) {
      throw ApiError.unauthorized('Invalid token payload type', 'INVALID_TOKEN_TYPE');
    }

    const tokenHash = this.hashToken(refreshTokenString);

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // REPLAY ATTACK DETECTION:
    // If token record not found or already revoked, an attacker or compromised client reused an old token.
    // Invalidate the ENTIRE token family immediately to protect the account.
    if (!tokenRecord || tokenRecord.isRevoked) {
      const targetFamily = tokenRecord?.family || decoded.family;
      if (targetFamily) {
        await prisma.refreshToken.updateMany({
          where: { family: targetFamily },
          data: { isRevoked: true },
        });
      }
      throw ApiError.unauthorized(
        'Refresh token reuse detected. Security alert: Please sign in again.',
        'TOKEN_REUSE_DETECTED'
      );
    }

    // Check expiration
    if (new Date() > tokenRecord.expiresAt) {
      await prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true },
      });
      throw ApiError.unauthorized('Refresh token has expired', 'EXPIRED_REFRESH_TOKEN');
    }

    // Check user active status
    if (!tokenRecord.user.isActive) {
      throw ApiError.unauthorized('Account has been deactivated', 'USER_DEACTIVATED');
    }

    // REFRESH TOKEN ROTATION (RTR):
    // 1. Revoke the current refresh token
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { isRevoked: true },
    });

    // 2. Issue a new access token & new refresh token preserving the same family
    const tokens = await this.generateTokens(tokenRecord.user, {
      userAgent: clientInfo?.userAgent || tokenRecord.userAgent || undefined,
      ipAddress: clientInfo?.ipAddress || tokenRecord.ipAddress || undefined,
      family: tokenRecord.family,
    });

    return {
      user: this.sanitizeUser(tokenRecord.user),
      ...tokens,
    };
  }

  static async logout(refreshTokenString?: string, userId?: number) {
    if (refreshTokenString) {
      const tokenHash = this.hashToken(refreshTokenString);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, isRevoked: false },
        data: { isRevoked: true },
      });
    } else if (userId) {
      await prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    return { success: true, message: 'Logged out successfully' };
  }

  static async getMe(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        volunteer: {
          include: {
            skills: {
              include: { skill: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw ApiError.notFound('User');
    }

    return this.sanitizeUser(user);
  }

  static async updateProfile(userId: number, data: { full_name?: string; phone_number?: string; avatar_url?: string }) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.full_name,
        phoneNumber: data.phone_number,
        avatarUrl: data.avatar_url,
      },
    });

    return this.sanitizeUser(updated);
  }

  static async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError.notFound('User');

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw ApiError.badRequest('Current password is incorrect');

    const newHash = await argon2.hash(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Invalidate existing refresh tokens on password change
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    return { success: true, message: 'Password updated successfully' };
  }

  private static async generateTokens(
    user: { id: number; email: string; role: string; fullName: string },
    clientInfo?: ClientMetadata
  ): Promise<TokenPair> {
    const family = clientInfo?.family || crypto.randomUUID();

    // 1. Short-Lived Access Token (e.g. 15m)
    const accessPayload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as any,
      name: user.fullName,
      tokenType: 'access',
    };

    const accessToken = jwt.sign(accessPayload, config.JWT_SECRET, {
      expiresIn: (config.JWT_ACCESS_EXPIRES_IN || '15m') as any,
    });

    // 2. Long-Lived Refresh Token (e.g. 7d)
    const refreshSecret = config.JWT_REFRESH_SECRET || config.JWT_SECRET;
    const refreshPayload = {
      userId: user.id,
      family,
      jti: crypto.randomUUID(),
      tokenType: 'refresh',
    };

    const refreshToken = jwt.sign(refreshPayload, refreshSecret, {
      expiresIn: (config.JWT_REFRESH_EXPIRES_IN || '7d') as any,
    });

    // Parse refresh expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    const tokenHash = this.hashToken(refreshToken);

    await prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        family,
        expiresAt,
        userAgent: clientInfo?.userAgent || null,
        ipAddress: clientInfo?.ipAddress || null,
      },
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 15 * 60, // 900 seconds (15 minutes)
    };
  }

  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private static sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
