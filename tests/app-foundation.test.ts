import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';

process.env.NODE_ENV = 'test';
process.env.CORS_ORIGIN = 'https://sentinel.test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/unused?sslmode=disable';
process.env.JWT_SECRET = 'test-only-key-not-for-deployment';
process.env.DATABASE_CONNECT_TIMEOUT_MS = '100';
const { app } = await import('../src/app.js');
const { prisma } = await import('../src/core/prisma.js');

test('API starts without a database, protects auth/me and reports database unavailability', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const health = await fetch(`${url}/api/health`);
    assert.equal(health.status, 200);
    await health.json();
    const profile = await fetch(`${url}/api/auth/me`);
    assert.equal(profile.status, 401);
    await profile.json();
    for (const endpoint of ['/api/organizations/00000000-0000-4000-8000-000000000001/sentinel/regions', '/api/platform/organizations', '/api/me/memberships', '/api/organizations/00000000-0000-4000-8000-000000000001']) {
      const protectedRoute = await fetch(`${url}${endpoint}`);
      assert.equal(protectedRoute.status, 401);
      await protectedRoute.json();
    }
    const ready = await fetch(`${url}/api/ready`);
    assert.equal(ready.status, 503);
    assert.deepEqual(await ready.json(), { ok: false, scope: 'database_prerequisites', blockers: ['DATABASE_UNAVAILABLE'] });
    const signup = await fetch(`${url}/api/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.org', password: 'test-password-only', full_name: 'Test Name', role: 'SUPER_ADMIN' }),
    });
    assert.equal(signup.status, 400);
    const error = await signup.json() as { details: Array<{ path: string }> };
    assert.equal(error.details.some(detail => detail.path === 'role'), true);
    for (const path of ['login', 'refresh', 'change-password']) {
      const retired = await fetch(`${url}/api/auth/${path}`, { method: 'POST' });
      assert.equal(retired.status, 410);
      assert.equal((await retired.json() as { error: string }).error, 'FIREBASE_AUTH_REQUIRED');
    }
    const csrf = await fetch(`${url}/api/auth/session`, { method: 'POST' });
    assert.equal(csrf.status, 403);
    await csrf.json();
    for (const [path, method] of [['logout', 'POST'], ['session', 'DELETE']]) {
      const cleared = await fetch(url + '/api/auth/' + path, { method,
        headers: { Origin: 'https://sentinel.test', 'X-Requested-With': 'VolunteerOps', Cookie: 'vops_firebase_session=expired-cookie' } });
      assert.equal(cleared.status, 204);
      assert.ok(cleared.headers.get('set-cookie')?.includes('vops_firebase_session=;'));
    }
    const stream = await fetch(`${url}/api/telemetry/live-stream`);
    assert.equal(stream.status, 503);
    assert.equal((await stream.json() as { error: string }).error, 'TENANT_MIGRATION_REQUIRED');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
