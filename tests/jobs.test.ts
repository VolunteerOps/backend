import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeJob, PermanentJobError, retryDelayMs, type ClaimedJob, type JobStore, type JobHandler } from '../src/core/jobs.js';

const job: ClaimedJob = { id: 'test-job', kind: 'TEST', payload: { safe: true }, attempts: 1, fence: 3, lease_owner: 'worker-a', deadline: null };
function recorder() {
  const events: unknown[] = [];
  const store: JobStore = {
    claim: async () => job,
    complete: async value => { events.push(['complete', value.fence]); return true; },
    fail: async (value, code, permanent) => { events.push(['fail', value.fence, code, permanent]); return true; },
  };
  return { store, events };
}

test('successful handler completes only after external work', async () => {
  const { store, events } = recorder();
  await executeJob(store, job, new Map<string, JobHandler>([['TEST', async (payload, signal) => {
    assert.deepEqual(payload, { safe: true }); assert.equal(signal.aborted, false); events.push('work');
  }]]));
  assert.deepEqual(events, ['work', ['complete', 3]]);
});

test('unknown job types are dead-lettered without execution', async () => {
  const { store, events } = recorder();
  await executeJob(store, job, new Map());
  assert.deepEqual(events, [['fail', 3, 'UNSUPPORTED_JOB_KIND', true]]);
});

test('transient external failures are retryable and never persist provider error messages', async () => {
  const { store, events } = recorder();
  await executeJob(store, job, new Map([['TEST', async () => { throw new Error('secret-token'); }]]));
  assert.deepEqual(events, [['fail', 3, 'JOB_FAILED', false]]);
});

test('invalid payload is terminal', async () => {
  const { store, events } = recorder();
  await executeJob(store, job, new Map([['TEST', async () => { throw new PermanentJobError(); }]]));
  assert.deepEqual(events, [['fail', 3, 'INVALID_JOB_PAYLOAD', true]]);
});

test('expired work never reaches the external handler', async () => {
  const { store, events } = recorder();
  await executeJob(store, { ...job, deadline: new Date(0) }, new Map([['TEST', async () => { assert.fail('expired job executed'); }]]));
  assert.deepEqual(events, [['fail', 3, 'DEADLINE_EXCEEDED', true]]);
});

test('retry backoff is bounded', () => {
  assert.equal(retryDelayMs(1), 1000);
  assert.equal(retryDelayMs(2), 2000);
  assert.equal(retryDelayMs(20), 300_000);
});

test('lease loss at completion does not report another workers failure', async () => {
  const { store, events } = recorder();
  store.complete = async () => false;
  await executeJob(store, job, new Map([['TEST', async () => {}]]));
  assert.deepEqual(events, []);
});
