import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signupSchema } from '../src/modules/auth/auth.schema.js';

const signup = {
  email: 'responder@example.org',
  password: 'test-password-only',
  full_name: 'Test Responder',
};

test('public signup defaults to a volunteer', () => {
  assert.equal(signupSchema.parse(signup).role, 'VOLUNTEER');
});

for (const role of ['SUPER_ADMIN', 'COORDINATOR', 'TEAM_LEAD', 'admin', 'TECH_ADMIN', 'ORG_ADMIN']) {
  test(`public signup rejects ${role}`, () => {
    assert.equal(signupSchema.safeParse({ ...signup, role }).success, false);
  });
}

test('public signup rejects client-supplied grants', () => {
  assert.equal(signupSchema.safeParse({ ...signup, platform_grants: ['TECH_ADMIN'] }).success, false);
});