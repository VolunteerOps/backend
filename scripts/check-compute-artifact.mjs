import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const repository = fileURLToPath(new URL('../', import.meta.url));
const artifact = resolve(repository, '.prisma/compute-artifact');
assert.ok(existsSync(join(artifact, 'index.js')), 'Run npm run compute:prepare first.');
const files = readdirSync(artifact, { recursive: true, withFileTypes: true });
assert.equal(files.some(file => file.isFile() && /^\.env(?:\.|$)/.test(file.name)), false,
  'Runtime artifacts must not include .env files.');
const temporary = mkdtempSync(join(tmpdir(), 'sentinel-compute-check-'));
const standalone = join(temporary, 'artifact'), unrelatedCwd = join(temporary, 'unrelated-cwd');
let child;
try {
  // Copy outside the repository so missing dependencies cannot resolve from its
  // ancestor node_modules, and use a different cwd to exercise asset resolution.
  cpSync(artifact, standalone, { recursive: true, dereference: true });
  mkdirSync(unrelatedCwd);
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const address = reservation.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  await new Promise((done, reject) => reservation.close(error => error ? reject(error) : done()));
  const env = {};
  // No inherited cloud credentials, NODE_OPTIONS or project dotenv contents.
  for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'PATHEXT', 'TEMP', 'TMP', 'HOME']) {
    if (process.env[key]) env[key] = process.env[key];
  }
  Object.assign(env, { NODE_ENV: 'test', PORT: String(port), CORS_ORIGIN: 'http://127.0.0.1:' + port,
    DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/compute_artifact_test?sslmode=disable',
    DATABASE_CONNECT_TIMEOUT_MS: '100', DATABASE_POOL_MAX: '1' });
  child = spawn(process.execPath, [join(standalone, 'index.js')], {
    cwd: unrelatedCwd, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', data => { output = (output + String(data)).slice(-10000); });
  child.stderr.on('data', data => { output = (output + String(data)).slice(-10000); });
  const exited = once(child, 'exit');
  child.once('error', error => { output = String(error); });
  const base = 'http://127.0.0.1:' + port;
  let healthy = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Standalone artifact exited before startup: ' + output);
    try {
      const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).ok === true) { healthy = true; break; }
    } catch { /* Wait for this child to bind its port. */ }
    await delay(200);
  }
  assert.ok(healthy, 'Standalone artifact did not become healthy: ' + output);
  const checked = [];
  for (const [urlPath, relativeFile, mime] of [
    ['/sentinel/', 'portal/index.html', /text\/html/],
    ['/sentinel/main.js', 'portal/main.js', /(?:application|text)\/javascript/],
    ['/sentinel/main.css', 'portal/main.css', /text\/css/],
  ]) {
    const response = await fetch(base + urlPath);
    assert.equal(response.status, 200, urlPath);
    assert.match(response.headers.get('content-type') ?? '', mime, urlPath);
    assert.equal(response.headers.get('cache-control'), 'no-store', urlPath);
    const actual = Buffer.from(await response.arrayBuffer());
    const expected = readFileSync(join(standalone, relativeFile));
    assert.equal(createHash('sha256').update(actual).digest('hex'), createHash('sha256').update(expected).digest('hex'),
      'HTTP bytes differ from the packaged asset: ' + urlPath);
    checked.push({ path: urlPath, status: response.status, bytes: actual.length });
  }
  const config = await (await fetch(base + '/sentinel/config')).json();
  assert.equal(config.firebase, null); assert.equal(config.mapbox_access_token, null);
  assert.equal((await fetch(base + '/sentinel/.env')).status, 404);
  assert.equal((await fetch(base + '/api/storage')).status, 503, 'Legacy storage gate remains closed.');
  assert.equal((await fetch(base + '/api/ready')).status, 503, 'Database readiness must still reject unavailable PostgreSQL.');
  child.kill('SIGTERM');
  await Promise.race([exited, delay(12000, undefined, { ref: false }).then(() => { throw new Error('Artifact child did not stop'); })]);
  console.log(JSON.stringify({ ok: true, isolated_cwd: true, isolated_dependencies: true,
    dotenv_files: 0, assets: checked, database_readiness_gate: 'preserved', legacy_storage_gate: 'preserved' }, null, 2));
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, 'exit');
    child.kill('SIGKILL');
    await Promise.race([stopped, delay(3000)]);
  }
  // Resolve and verify the exact generated directory before recursive cleanup.
  assert.equal(dirname(resolve(temporary)), resolve(tmpdir()));
  assert.ok(basename(temporary).startsWith('sentinel-compute-check-'));
  rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
