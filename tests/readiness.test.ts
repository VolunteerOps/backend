import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createDatabaseReadinessHandler } from '../src/middleware/readiness.middleware.js';
import type { DatabaseFacts } from '../src/core/database-readiness.js';

const facts: DatabaseFacts = {
  server_version_num: 180000, postgis_version: '3.6.0', unsafe_role: false, owns_application_tables: false, tls: true,
};

test('HTTP readiness is uncached, bounded to database prerequisites, and fails closed', async () => {
  let current: DatabaseFacts | Error = facts;
  const app = express();
  app.get('/api/ready', createDatabaseReadinessHandler(async () => {
    if (current instanceof Error) throw current;
    return current;
  }, true));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/ready`;
  try {
    const ready = await fetch(url);
    assert.equal(ready.status, 200);
    assert.equal(ready.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await ready.json(), { ok: true, scope: 'database_prerequisites', blockers: [] });

    current = { ...facts, unsafe_role: true };
    const unsafe = await fetch(url);
    assert.equal(unsafe.status, 503);
    assert.deepEqual((await unsafe.json() as { blockers: string[] }).blockers, ['NON_PRIVILEGED_RUNTIME_ROLE_REQUIRED']);

    current = new Error('postgresql://secret-user:secret-password@private-host');
    const unavailable = await fetch(url);
    assert.equal(unavailable.status, 503);
    assert.deepEqual(await unavailable.json(), { ok: false, scope: 'database_prerequisites', blockers: ['DATABASE_UNAVAILABLE'] });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});