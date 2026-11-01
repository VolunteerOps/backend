import { publicFirebaseConfiguration } from '../../core/public-firebase.js';
﻿import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthService, retiredPasswordAuth } from './auth.service.js';
import { signupSchema, updateProfileSchema } from './auth.schema.js';
import { ah } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { createSessionOriginGuard, SESSION_COOKIE } from '../../middleware/firebase-auth.middleware.js';
import { validateBody } from '../../middleware/validator.js';
import { authRateLimiter } from '../../middleware/rateLimiter.js';
import { serialize } from '../../lib/serialize.js';
import { config } from '../../core/config.js';
import { ApiError } from '../../core/errors.js';
import { getFirebaseIdentityVerifier } from '../../core/firebase.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { requestActor } from '../organizations/context.js';

const router = Router();
const guardOrigin = createSessionOriginGuard(config.CORS_ORIGIN);
const cookieOptions = {
  httpOnly: true, secure: config.NODE_ENV === 'production' || config.COOKIE_SECURE,
  sameSite: 'lax' as const, path: '/',
};
function clearCookies(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  for (const name of ['vops_access_token', 'vops_session', 'vops_refresh_token']) {
    res.clearCookie(name, { ...cookieOptions, domain: config.COOKIE_DOMAIN || undefined,
      path: name === 'vops_refresh_token' ? '/api/auth' : '/' });
  }
}

router.get('/config',(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.query.app!==undefined&&!['volunteer','ops'].includes(String(req.query.app))){res.status(400).json({error:'INVALID_APP'});return;}
 const firebase=publicFirebaseConfiguration(process.env,req.query.app==='ops'?'ops':'volunteer');
 res.json({status:firebase?'CONFIGURED_UNVERIFIED':'NOT_CONFIGURED',api_key:firebase?.apiKey??null,project_id:firebase?.projectId??null,firebase});
});
router.post('/firebase/bootstrap', authRateLimiter,
  validateBody(z.object({ full_name: z.string().trim().min(2).max(120) }).strict()),
  ah(async (req, res) => {
    if (!req.firebaseIdentity || req.firebaseCredential !== 'bearer') throw ApiError.unauthorized('Verified Firebase ID token required');
    const user = await AuthService.bootstrap(req.firebaseIdentity, req.body.full_name);
    const contexts = await OrganizationsService.memberships({ userId: user.id, identity: req.firebaseIdentity });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(serialize({ user, ...contexts }));
  }));

router.post('/session', authRateLimiter, guardOrigin, requireAuth,
  ah(async (req, res) => {
    if (req.firebaseCredential !== 'bearer') throw ApiError.unauthorized('Firebase bearer token required');
    const cookie = await getFirebaseIdentityVerifier().createSessionCookie(req.headers.authorization!.slice(7));
    clearCookies(res);
    res.cookie(SESSION_COOKIE, cookie, { ...cookieOptions, maxAge: 5 * 24 * 60 * 60 * 1000 });
    res.setHeader('Cache-Control', 'no-store');
    res.status(204).end();
  }));

// Clears this browser only; does not claim to revoke copied or other-device tokens.
router.delete('/session', guardOrigin, (_req, res) => { clearCookies(res); res.status(204).end(); });
router.post('/sessions/revoke', authRateLimiter, requireAuth, ah(async (req, res) => {
  const result = await AuthService.revokeSessions(req.user!.userId, req.firebaseIdentity!);
  clearCookies(res);
  res.status(202).json(result);
}));
router.post('/logout', guardOrigin, (_req, res) => { clearCookies(res); res.status(204).end(); });
router.get('/me', requireAuth, ah(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(serialize({ user: await AuthService.getMe(req.user!.userId), ...await OrganizationsService.memberships(requestActor(req)) }));
}));
router.patch('/profile', requireAuth, validateBody(updateProfileSchema), ah(async (req, res) => {
  res.json(serialize({ user: await AuthService.updateProfile(req.user!.userId, req.body) }));
}));
router.post('/signup', authRateLimiter, validateBody(signupSchema), () => { throw retiredPasswordAuth(); });
for (const path of ['/login', '/refresh', '/change-password']) {
  router.post(path, authRateLimiter, () => { throw retiredPasswordAuth(); });
}
export default router;
