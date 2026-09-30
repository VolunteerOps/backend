import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import jwt from 'jsonwebtoken';
import { FirebaseIdentityVerifier, firebaseRuntimeConfig } from '../src/core/firebase.js';

const project = 'demo-sentinel';
const now = 1800000000;
const claims: DecodedIdToken = {
  aud: project, iss: `https://securetoken.google.com/${project}`, sub: 'firebase-uid', uid: 'firebase-uid',
  iat: now - 5, auth_time: now - 10, exp: now + 3600,
  email: 'responder@example.org', email_verified: true,
  firebase: { identities: { email: ['responder@example.org'] }, sign_in_provider: 'password' },
};

function fixture(decoded: DecodedIdToken = claims, fail = false) {
  const calls: Array<{ method: string; checked?: boolean }> = [];
  const gateway: Pick<Auth, 'verifyIdToken' | 'verifySessionCookie' | 'createSessionCookie' | 'revokeRefreshTokens'> = {
    async verifyIdToken(_token, checked) {
      calls.push({ method: 'id', checked });
      if (fail) throw new Error('SDK failure with secret credential');
      return decoded;
    },
    async verifySessionCookie(_cookie, checked) {
      calls.push({ method: 'session', checked });
      if (fail) throw new Error('SDK failure with secret credential');
      return decoded;
    },
    async createSessionCookie(_token, options) {
      calls.push({ method: 'create' });
      assert.equal(options.expiresIn, 432000000);
      return 'firebase-session-cookie';
    },
    async revokeRefreshTokens(uid) {
      calls.push({ method: 'revoke' });
      assert.equal(uid, claims.uid);
      if (fail) throw new Error('remote failure');
    },
  };
  return { verifier: new FirebaseIdentityVerifier(gateway, project, () => now * 1000), calls };
}

test('verifies ID tokens with revocation checks and returns identity without custom grants', async () => {
  const { verifier, calls } = fixture({ ...claims, role: 'TECH_ADMIN', admin: true });
  const identity = await verifier.verifyIdToken('id-token');
  assert.equal(identity.uid, claims.uid);
  assert.equal(identity.secondFactor, null);
  assert.equal('role' in identity, false);
  assert.equal('admin' in identity, false);
  assert.deepEqual(calls, [{ method: 'id', checked: true }]);
});

test('session cookies use their own SDK verifier and issuer', async () => {
  const { verifier, calls } = fixture({ ...claims, iss: `https://session.firebase.google.com/${project}` });
  assert.equal((await verifier.verifySessionCookie('session-cookie')).uid, claims.uid);
  assert.deepEqual(calls, [{ method: 'session', checked: true }]);
  await assert.rejects(verifier.verifyIdToken('session-cookie'));
  await assert.rejects(fixture().verifier.verifySessionCookie('id-token'));
});

for (const change of [
  { aud: 'wrong-project' }, { iss: 'https://attacker.example' }, { exp: now }, { exp: NaN },
  { uid: 'different-uid' }, { sub: '' }, { sub: 'x'.repeat(129) }, { iat: now + 1 },
  { auth_time: now + 1 }, { auth_time: -1 }, { iat: undefined }, { auth_time: undefined },
  { firebase: { ...claims.firebase, tenant: 'another-tenant' } },
  { firebase: { ...claims.firebase, sign_in_provider: 'custom' } },
  { firebase: undefined },
]) {
  test(`rejects invalid verified claims ${JSON.stringify(change)}`, async () => {
    await assert.rejects(fixture({ ...claims, ...change } as DecodedIdToken).verifier.verifyIdToken('token'),
      { code: 'INVALID_FIREBASE_IDENTITY' });
  });
}

for (const change of [{ email_verified: false }, { email: undefined }, { email: 'invalid' }]) {
  test(`requires a verified usable email ${JSON.stringify(change)}`, async () => {
    await assert.rejects(fixture({ ...claims, ...change }).verifier.verifyIdToken('token'),
      { code: 'EMAIL_VERIFICATION_REQUIRED' });
  });
}

test('SDK rejection fails closed without leaking credentials', async () => {
  const { verifier } = fixture(claims, true);
  for (const verify of [() => verifier.verifyIdToken('token'), () => verifier.verifySessionCookie('cookie')]) {
    await assert.rejects(verify, (error: Error) => !error.message.includes('secret'));
  }
});

test('rejects empty, oversized and whitespace credentials before calling the SDK', async () => {
  const { verifier, calls } = fixture();
  for (const token of ['', 'x'.repeat(16385), 'Bearer token', 'token\n']) {
    await assert.rejects(verifier.verifyIdToken(token));
  }
  assert.deepEqual(calls, []);
});

test('session creation requires recent authentication and a revocation check', async () => {
  const { verifier, calls } = fixture();
  assert.equal(await verifier.createSessionCookie('id-token'), 'firebase-session-cookie');
  assert.deepEqual(calls, [{ method: 'id', checked: true }, { method: 'create' }]);
  const stale = fixture({ ...claims, auth_time: now - 301 });
  await assert.rejects(stale.verifier.createSessionCookie('id-token'), { code: 'RECENT_AUTH_REQUIRED' });
  assert.equal(stale.calls.some(call => call.method === 'create'), false);
});

test('MFA evidence comes only from supported verified second-factor claims', async () => {
  for (const factor of ['totp', 'phone', 'custom', undefined]) {
    const { verifier } = fixture({ ...claims, mfa: true, firebase: { ...claims.firebase, sign_in_second_factor: factor } });
    assert.equal((await verifier.verifyIdToken('token')).secondFactor, factor === 'totp' || factor === 'phone' ? factor : null);
  }
});

test('revoke-all calls Firebase and reports remote failure as retryable work', async () => {
  await fixture().verifier.revokeAllSessions(claims.uid);
  await assert.rejects(fixture(claims, true).verifier.revokeAllSessions(claims.uid), { code: 'FIREBASE_REVOCATION_FAILED' });
  await assert.rejects(fixture().verifier.revokeAllSessions(''));
});

test('Firebase configuration never infers a project from credentials', () => {
  assert.throws(() => firebaseRuntimeConfig({}));
  assert.equal(firebaseRuntimeConfig({ FIREBASE_PROJECT_ID: 'sentinel-production' }).FIREBASE_PROJECT_ID, 'sentinel-production');
});

test('emulator requires explicit isolated local configuration', () => {
  const emulator = { FIREBASE_PROJECT_ID: project, FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIREBASE_ALLOW_AUTH_EMULATOR: 'true' };
  assert.equal(firebaseRuntimeConfig({ ...emulator, NODE_ENV: 'test' }).FIREBASE_PROJECT_ID, project);
  for (const change of [
    { NODE_ENV: 'production' }, { FIREBASE_ALLOW_AUTH_EMULATOR: 'false' }, { FIREBASE_PROJECT_ID: 'real-project' },
    { FIREBASE_AUTH_EMULATOR_HOST: 'attacker.example:9099' }, { FIREBASE_AUTH_EMULATOR_HOST: 'localhost:65536' },
    { FIREBASE_AUTH_EMULATOR_HOST: undefined },
  ]) assert.throws(() => firebaseRuntimeConfig({ ...emulator, ...change }));
  assert.throws(() => firebaseRuntimeConfig({ FIREBASE_PROJECT_ID: project, NODE_ENV: 'production' }));
});

test('real Firebase SDK rejects local JWTs without treating them as Firebase identities', async () => {
  const app = initializeApp({ projectId: project }, 'local-jwt-rejection-test');
  try {
    const verifier = new FirebaseIdentityVerifier(getAuth(app), project);
    const token = jwt.sign({ ...claims }, 'test-only-local-jwt-key', { algorithm: 'HS256' });
    await assert.rejects(verifier.verifyIdToken(token), { code: 'INVALID_FIREBASE_IDENTITY' });
    await assert.rejects(verifier.verifySessionCookie(token), { code: 'INVALID_FIREBASE_IDENTITY' });
  } finally {
    await deleteApp(app);
  }
});