import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VerifiedFirebaseIdentity } from '../src/core/firebase.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/unused?sslmode=disable';

const { AuthService } = await import('../src/modules/auth/auth.service.js');
const identity: VerifiedFirebaseIdentity = {
  projectId: 'demo-sentinel', uid: 'new-uid', email: 'Responder@Example.org',
  authTime: 100, expiresAt: 500, signInProvider: 'google.com', secondFactor: null,
};

test('bootstrap never attaches an email-matched legacy account', async t => {
  const transaction = {
    $queryRaw: async () => [],
    firebaseIdentity: { findUnique: async () => null },
    user: { findFirst: async () => ({ id: 42 }), create: async () => { assert.fail('email-only attachment'); } },
  };
  const database = { $transaction: async (fn: (tx: unknown) => unknown) => fn(transaction) } as unknown as NonNullable<Parameters<typeof AuthService.bootstrap>[2]>;
  await assert.rejects(AuthService.bootstrap(identity, 'Responder', database), { code: 'IDENTITY_MIGRATION_REQUIRED' });
});

test('verified email changes require recent authentication without remapping the user', async t => {
  const user = { id: 42, email: 'original@example.org', isActive: true };
  const transaction = {
    $queryRaw: async () => [],
    firebaseIdentity: { findUnique: async () => ({ userId: 42, user, revokedBefore: null }) },
    user: { findUniqueOrThrow: async ({ where }: { where: { id: number } }) => {
      assert.equal(where.id, 42); return user;
    } },
  };
  const database = { $transaction: async (fn: (tx: unknown) => unknown) => fn(transaction) } as unknown as NonNullable<Parameters<typeof AuthService.bootstrap>[2]>;
  await assert.rejects(AuthService.bootstrap(identity, 'Different Name', database),{code:'RECENT_AUTH_REQUIRED'});
});

test('bootstrap creates only an unassigned volunteer and writes the audit in the transaction', async t => {
  const operations: string[] = [];
  const transaction = {
    $queryRaw: async () => { operations.push('lock'); return []; },
    firebaseIdentity: { findUnique: async () => null },
    user: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        assert.equal(data.role, 'VOLUNTEER'); assert.equal(data.passwordHash, null);
        assert.equal(data.email, 'responder@example.org');
        assert.deepEqual(data.firebaseIdentity, { create: { projectId: identity.projectId, uid: identity.uid } });
        assert.equal('memberships' in data, false);
        operations.push('create'); return { id: 77 };
      },
    },
    auditLog: { create: async ({ data }: { data: { userId: number } }) => {
      assert.equal(data.userId, 77); operations.push('audit');
    } },
  };
  const database = { $transaction: async (fn: (tx: unknown) => unknown) => fn(transaction) } as unknown as NonNullable<Parameters<typeof AuthService.bootstrap>[2]>;
  await AuthService.bootstrap(identity, 'Responder', database);
  assert.deepEqual(operations, ['lock', 'create', 'audit']);
});

test('disabled account cannot use bootstrap to reactivate itself', async t => {
  const transaction = {
    $queryRaw: async () => [],
    firebaseIdentity: { findUnique: async () => ({ userId: 42, user: { isActive: false }, revokedBefore: null }) },
  };
  const database = { $transaction: async (fn: (tx: unknown) => unknown) => fn(transaction) } as unknown as NonNullable<Parameters<typeof AuthService.bootstrap>[2]>;
  await assert.rejects(AuthService.bootstrap(identity, 'Responder', database), { code: 'SESSION_REVOKED' });
});
