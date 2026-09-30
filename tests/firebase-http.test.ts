import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { createFirebaseAuthenticator, createCookieMutationGuard, createSessionOriginGuard } from '../src/middleware/firebase-auth.middleware.js';
import type { FirebaseAccount, IdentityGateway } from '../src/middleware/firebase-auth.middleware.js';
import type { VerifiedFirebaseIdentity } from '../src/core/firebase.js';
import { ApiError } from '../src/core/errors.js';

const identity: VerifiedFirebaseIdentity = {
  projectId: 'demo-sentinel', uid: 'verified-uid', email: 'responder@example.org',
  authTime: 100, expiresAt: 500, signInProvider: 'password', secondFactor: null,
};
const account: FirebaseAccount = {
  id: 41, email: 'database@example.org', fullName: 'Database Name',
  role: 'VOLUNTEER', isActive: true, revokedBefore: null,
};
const gateway: IdentityGateway = {
  verifyIdToken: async token => { assert.equal(token, 'id-token'); return identity; },
  verifySessionCookie: async token => { assert.equal(token, 'session-cookie'); return identity; },
};
const response = {} as Response;

test('Firebase bearer identity uses immutable project/UID and current database profile', async () => {
  const req = { headers: { authorization: 'Bearer id-token' } } as unknown as Request;
  await createFirebaseAuthenticator(() => gateway, async verified => {
    assert.equal(verified, identity); return account;
  })(req, response, error => assert.equal(error, undefined));
  assert.equal(req.user?.userId, 41);
  assert.equal(req.user?.email, account.email);
  assert.equal(req.user?.role, 'VOLUNTEER');
  assert.equal(req.firebaseCredential, 'bearer');
});

test('Firebase session cookies use session verifier', async () => {
  const req = { headers: {}, cookies: { vops_firebase_session: 'session-cookie' } } as unknown as Request;
  await createFirebaseAuthenticator(() => gateway, async () => account)(req, response, error => assert.equal(error, undefined));
  assert.equal(req.firebaseCredential, 'cookie');
  assert.equal(req.user?.userId, 41);
});

test('unmapped Firebase identities can bootstrap but have no application authorization', async () => {
  const req = { headers: { authorization: 'Bearer id-token' } } as unknown as Request;
  await createFirebaseAuthenticator(() => gateway, async () => null)(req, response, error => assert.equal(error, undefined));
  assert.equal(req.firebaseIdentity, identity);
  assert.equal(req.user, undefined);
});

test('legacy cookies never trigger Firebase verification or a database lookup', async () => {
  const req = { headers: {}, cookies: { vops_access_token: 'old', vops_session: 'old' } } as unknown as Request;
  await createFirebaseAuthenticator(() => { throw new Error('unexpected'); }, async () => { throw new Error('unexpected'); })
    (req, response, error => assert.equal(error, undefined));
  assert.equal(req.user, undefined);
});

test('explicit invalid bearer cannot fall back to a valid cookie', async () => {
  for (const authorization of ['Basic bad', 'Bearer ', 'Bearer token extra']) {
    const req = { headers: { authorization }, cookies: { vops_firebase_session: 'session-cookie' } } as unknown as Request;
    let failure: unknown;
    await createFirebaseAuthenticator(() => gateway, async () => account)(req, response, error => { failure = error; });
    assert.equal((failure as ApiError).statusCode, 401);
    assert.equal(req.user, undefined);
  }
});

test('revoked Firebase tokens fail closed before the account loader', async () => {
  const req = { headers: { authorization: 'Bearer id-token' } } as unknown as Request;
  let failure: unknown;
  await createFirebaseAuthenticator(() => ({ ...gateway, verifyIdToken: async () => { throw ApiError.unauthorized(); } }),
    async () => { assert.fail('Account lookup after invalid identity'); })
    (req, response, error => { failure = error; });
  assert.equal((failure as ApiError).statusCode, 401);
});

for (const revoked of [{ ...account, isActive: false }, { ...account, revokedBefore: new Date(100_000) }]) {
  test(`database rejects ${revoked.isActive ? 'revoked session' : 'disabled account'}`, async () => {
    const req = { headers: { authorization: 'Bearer id-token' } } as unknown as Request;
    let failure: unknown;
    await createFirebaseAuthenticator(() => gateway, async () => revoked)(req, response, error => { failure = error; });
    assert.equal((failure as ApiError).code, 'SESSION_REVOKED');
    assert.equal(req.firebaseIdentity, undefined);
    assert.equal(req.user, undefined);
  });
}

test('authorization outage has a retryable, secret-free error', async () => {
  const req = { headers: { authorization: 'Bearer id-token' } } as unknown as Request;
  let failure: unknown;
  await createFirebaseAuthenticator(() => gateway, async () => { throw new Error('private connection'); })
    (req, response, error => { failure = error; });
  assert.equal((failure as ApiError).statusCode, 503);
  assert.equal((failure as Error).message.includes('private'), false);
});

test('session origin guard requires exact trusted origin and a custom header', () => {
  const guard = createSessionOriginGuard(['https://admin.example']);
  for (const headers of [{}, { origin: 'null' }, { origin: 'https://admin.example.evil', 'x-requested-with': 'VolunteerOps' },
    { origin: 'https://admin.example' }]) {
    guard({ headers } as unknown as Request, response, error => assert.equal((error as ApiError).code, 'CSRF_REJECTED'));
  }
  guard({ headers: { origin: 'https://admin.example', 'x-requested-with': 'VolunteerOps' } } as unknown as Request,
    response, error => assert.equal(error, undefined));
});

test('cookie mutations require CSRF protection; native bearer requests do not', () => {
  const guard = createCookieMutationGuard(['https://admin.example']);
  guard({ method: 'POST', headers: {}, firebaseCredential: 'cookie' } as unknown as Request, response,
    error => assert.equal((error as ApiError).statusCode, 403));
  for (const req of [{ method: 'GET', headers: {}, firebaseCredential: 'cookie' },
    { method: 'POST', headers: {}, firebaseCredential: 'bearer' }]) {
    guard(req as unknown as Request, response, error => assert.equal(error, undefined));
  }
});

