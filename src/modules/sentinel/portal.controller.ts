import { Router, static as serveStatic } from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { publicFirebaseConfiguration } from '../../core/public-firebase.js';
import { config } from '../../core/config.js';

export function publicPortalConfiguration(env: NodeJS.ProcessEnv = process.env, app: 'volunteer' | 'ops' = 'volunteer') {
  const mapboxToken = env.MAPBOX_ACCESS_TOKEN?.trim();
  const firebase = publicFirebaseConfiguration(env, app);
  return { firebase, mapbox_access_token: mapboxToken?.startsWith('pk.') ? mapboxToken : null,
    enterprise_providers: (env.FIREBASE_ENTERPRISE_PROVIDERS || '').split(',').map(p => p.trim())
      .filter(p => /^(saml|oidc)\.[a-zA-Z0-9_-]{1,100}$/.test(p)).slice(0, 20),
    weather_access: env.WEATHERNEXT_ACCESS_ENABLED === 'true' ? 'CONFIGURED' : 'AWAITING_ACCESS' };
}
const router = Router();
// Compiled builds and flattened Compute artifacts keep portal/ alongside modules/.
// tsx executes the source tree, whose built assets still live under dist/portal/.
const root = fileURLToPath(new URL(import.meta.url.endsWith('.ts')
  ? '../../../dist/portal/' : '../../portal/', import.meta.url));
router.use((_req, res, next) => {
  // Only explicitly configured app origins may frame this page.
  const frames = config.CORS_ORIGIN.filter(origin => /^https?:\/\/[a-zA-Z0-9.:-]+$/.test(origin));
  const firebaseDomain = publicPortalConfiguration().firebase?.authDomain;
  const authOrigin = firebaseDomain && /^[a-zA-Z0-9.-]+$/.test(firebaseDomain) ? 'https://' + firebaseDomain : '';
  res.removeHeader('X-Frame-Options');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'", "script-src 'self' https://apis.google.com",
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob: https://*.mapbox.com",
    "font-src 'self' data:", "worker-src 'self' blob:",
    "connect-src 'self' https://*.mapbox.com https://*.tiles.mapbox.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com " + authOrigin,
    "frame-src 'self' https://accounts.google.com " + authOrigin,
    "frame-ancestors 'self' " + frames.join(' '), "object-src 'none'", "base-uri 'none'",
  ].join('; '));
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.get('/map-widget-config', (_req,res)=>res.json({token:publicPortalConfiguration().mapbox_access_token,origins:config.CORS_ORIGIN.filter(origin=>/^https?:\/\/[a-zA-Z0-9.:-]+$/.test(origin))}));
router.get('/config', (req, res) => {
  if (req.query.app !== undefined && !['volunteer', 'ops'].includes(String(req.query.app))) {
    res.status(400).json({ error: 'INVALID_APP' }); return;
  }
  res.json(publicPortalConfiguration(process.env, req.query.app === 'ops' ? 'ops' : 'volunteer'));
});
router.use(serveStatic(root, { index: 'index.html', dotfiles: 'deny', etag: false, fallthrough: true }));
router.get('/', (_req, res) => {
  if (!existsSync(resolve(root, 'index.html'))) {
    res.status(503).json({ error: 'PORTAL_BUILD_REQUIRED', message: 'Build the Sentinel portal before serving it' });
  } else res.sendFile(resolve(root, 'index.html'));
});
export default router;
