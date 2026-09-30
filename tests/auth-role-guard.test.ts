import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/unused?sslmode=disable';
process.env.JWT_SECRET = 'test-only-key-not-for-deployment';
const { requireRole, createLegacyAuthenticator } = await import('../src/middleware/auth.middleware.js');

test('legacy admin role cannot bypass a coordinator guard', () => {
  const req = { user: { userId: 1, role: 'admin' } } as Request;
  assert.throws(() => requireRole('COORDINATOR')(req, {} as Response, () => {}), { statusCode: 403 });
});

test('global SUPER_ADMIN is not an implicit grant for every role', () => {
  const req = { user: { userId: 1, role: 'SUPER_ADMIN' } } as Request;
  assert.throws(() => requireRole('VOLUNTEER')(req, {} as Response, () => {}), { statusCode: 403 });
});

test('explicit role allowlists still work', () => {
  const req = { user: { userId: 1, role: 'COORDINATOR' } } as Request;
  let admitted = false;
  requireRole('COORDINATOR')(req, {} as Response, () => { admitted = true; });
  assert.equal(admitted, true);
});

test('current database role and profile override stale signed claims on every request', async () => {
  let role: 'COORDINATOR' | 'VOLUNTEER' = 'COORDINATOR';
  let reads = 0;
  const authenticate = createLegacyAuthenticator(
    () => ({ userId: 1, role: 'SUPER_ADMIN', email: 'stale@example.org' }),
    async id => {
      reads++;
      return { id, role, isActive: true, email: 'current@example.org', fullName: 'Current Name' };
    },
  );
  const req = { headers: { authorization: 'Bearer test-token' } } as Request;
  await authenticate(req, {} as Response, error => assert.equal(error, undefined));
  assert.equal(req.user?.role, 'COORDINATOR');
  assert.equal(req.user?.email, 'current@example.org');
  role = 'VOLUNTEER';
  await authenticate(req, {} as Response, error => assert.equal(error, undefined));
  assert.equal(req.user?.role, 'VOLUNTEER');
  assert.equal(reads, 2);
});

test('disabled and deleted accounts cannot authenticate with previously valid tokens', async () => {
  for (const account of [null, { id: 1, role: 'VOLUNTEER' as const, isActive: false, email: 'test@example.org', fullName: 'Test' }]) {
    const authenticate = createLegacyAuthenticator(() => ({ userId: 1 }), async () => account);
    const req = { headers: { authorization: 'Bearer test-token' }, user: { userId: 1 } } as Request;
    await authenticate(req, {} as Response, error => assert.equal(error, undefined));
    assert.equal(req.user, undefined);
  }
});

test('authorization database outage fails closed without exposing connection details', async () => {
  const authenticate = createLegacyAuthenticator(() => ({ userId: 1 }), async () => { throw new Error('secret connection'); });
  const req = { headers: { authorization: 'Bearer test-token' } } as Request;
  let reported: unknown;
  await authenticate(req, {} as Response, error => { reported = error; });
  assert.equal((reported as { statusCode: number }).statusCode, 503);
  assert.equal((reported as Error).message.includes('secret'), false);
  assert.equal(req.user, undefined);
});

test('malformed and refresh-token payloads never reach the account loader', async () => {
  for (const payload of [null, 'invalid', {}, { userId: '1' }, { userId: -1 }, { userId: 1.5 }, { userId: 1, tokenType: 'refresh' }]) {
    const authenticate = createLegacyAuthenticator(() => payload, async () => { assert.fail('Unexpected database read'); });
    const req = { headers: { authorization: 'Bearer test-token' } } as Request;
    await authenticate(req, {} as Response, error => assert.equal(error, undefined));
    assert.equal(req.user, undefined);
  }
});

test('direct signup service callers cannot bypass the public schema', async () => {
  const { AuthService } = await import('../src/modules/auth/auth.service.js');
  await assert.rejects(AuthService.signup({
    email: 'test@example.org', password: 'test-password-only', full_name: 'Test Name', role: 'SUPER_ADMIN',
  }), { name: 'ZodError' });
});