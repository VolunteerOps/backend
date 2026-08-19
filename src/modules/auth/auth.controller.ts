import { Router, Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import {
  signupSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  refreshTokenSchema,
} from './auth.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { serialize } from '../../lib/serialize.js';
import { config } from '../../core/config.js';

const router = Router();

function getClientMetadata(req: Request) {
  return {
    userAgent: req.headers['user-agent'] || undefined,
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || undefined,
  };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  // Short-Lived Access Token Cookie (15 minutes, accessible across entire API)
  res.cookie('vops_access_token', accessToken, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SECURE ? 'none' : 'lax',
    domain: config.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Legacy compatibility cookie
  res.cookie('vops_session', accessToken, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SECURE ? 'none' : 'lax',
    domain: config.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Long-Lived Refresh Token Cookie (7 days, scoped only to /api/auth)
  res.cookie('vops_refresh_token', refreshToken, {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SECURE ? 'none' : 'lax',
    domain: config.COOKIE_DOMAIN || undefined,
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearAuthCookies(res: Response) {
  const cookieOptions = {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: (config.COOKIE_SECURE ? 'none' : 'lax') as any,
    domain: config.COOKIE_DOMAIN || undefined,
  };

  res.clearCookie('vops_access_token', { ...cookieOptions, path: '/' });
  res.clearCookie('vops_session', { ...cookieOptions, path: '/' });
  res.clearCookie('vops_refresh_token', { ...cookieOptions, path: '/api/auth' });
}

router.post(
  '/signup',
  authRateLimiter,
  validateBody(signupSchema),
  ah(async (req, res) => {
    const clientInfo = getClientMetadata(req);
    const result = await AuthService.signup(req.body, clientInfo);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.status(201).json(
      serialize({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        token: result.accessToken, // Backwards compatibility
      })
    );
  })
);

router.post(
  '/login',
  authRateLimiter,
  validateBody(loginSchema),
  ah(async (req, res) => {
    const clientInfo = getClientMetadata(req);
    const result = await AuthService.login(req.body, clientInfo);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json(
      serialize({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        token: result.accessToken, // Backwards compatibility
      })
    );
  })
);

router.post(
  '/refresh',
  authRateLimiter,
  validateBody(refreshTokenSchema),
  ah(async (req, res) => {
    // 1. Extract from cookie, request body, or header
    const tokenFromCookie = req.cookies?.['vops_refresh_token'];
    const tokenFromBody = req.body?.refreshToken || req.body?.refresh_token;
    const tokenFromHeader = req.headers['x-refresh-token'] as string;

    const refreshTokenString = tokenFromCookie || tokenFromBody || tokenFromHeader;

    const clientInfo = getClientMetadata(req);
    const result = await AuthService.refresh(refreshTokenString, clientInfo);

    setAuthCookies(res, result.accessToken, result.refreshToken);

    res.json(
      serialize({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        token: result.accessToken, // Backwards compatibility
      })
    );
  })
);

router.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const user = await AuthService.getMe(req.user!.userId);
    res.json(serialize({ user }));
  })
);

router.patch(
  '/profile',
  requireAuth,
  validateBody(updateProfileSchema),
  ah(async (req, res) => {
    const updated = await AuthService.updateProfile(req.user!.userId, req.body);
    res.json(serialize({ user: updated }));
  })
);

router.post(
  '/change-password',
  requireAuth,
  validateBody(changePasswordSchema),
  ah(async (req, res) => {
    const result = await AuthService.changePassword(
      req.user!.userId,
      req.body.current_password,
      req.body.new_password
    );
    clearAuthCookies(res);
    res.json(result);
  })
);

router.post(
  '/logout',
  ah(async (req, res) => {
    const tokenFromCookie = req.cookies?.['vops_refresh_token'];
    const tokenFromBody = req.body?.refreshToken || req.body?.refresh_token;
    const refreshTokenString = tokenFromCookie || tokenFromBody;

    await AuthService.logout(refreshTokenString, req.user?.userId);
    clearAuthCookies(res);
    res.json({ success: true, message: 'Logged out successfully' });
  })
);

export default router;
