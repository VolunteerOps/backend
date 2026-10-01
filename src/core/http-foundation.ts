import { traceContext } from './trace-context.js';
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { logger } from './logger.js';

export function trustedProxyAddresses(value = ''): false | string[] {
  if (!value.trim()) return false;
  const addresses = value.split(',').map(part => part.trim());
  if (addresses.some(address => !address || ['true', '*', '0.0.0.0/0', '::/0'].includes(address) || /^\d+$/.test(address))) {
    throw new Error('TRUST_PROXY_CIDRS requires explicit ingress addresses or CIDRs');
  }
  return addresses;
}
export function exactOrigins(value: string): string[] {
  const origins = value.split(',').map(part => part.trim());
  for (const origin of origins) {
    const url = new URL(origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== origin || url.username || url.password) {
      throw new Error('CORS_ORIGIN requires exact HTTP(S) origins');
    }
  }
  return [...new Set(origins)];
}
export const requestTelemetry: RequestHandler = (req, res, next) => {
  const requestId = randomUUID();
  const started = performance.now();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.on('finish', () => logger.info('HTTP_REQUEST', {
    request_id: requestId, method: req.method, status: res.statusCode,
    duration_ms: Math.round(performance.now() - started),
    route: typeof req.route?.path === 'string' ? req.route.path : 'unmatched',
  }));
  traceContext.run({ request_id: requestId }, next);
};
