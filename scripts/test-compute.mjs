import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

// Test outside the repository so missing dependencies cannot be satisfied by
// the developer's node_modules. No application records are created or changed.
if (process.argv[2] !== '--worker') {
  const temporary = mkdtempSync(join(tmpdir(), 'volunteerops-artifact-test-'));
  let status = 1;
  try {
    cpSync(resolve('.prisma/compute-artifact'), temporary, { recursive: true });
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--worker', temporary], {
      stdio: 'inherit', env: process.env,
    });
    if (child.error) throw child.error;
    status = child.status ?? 1;
  } finally {
    // Native libraries are unlocked only after the worker exits on Windows.
    rmSync(temporary, { recursive: true, force: true });
  }
  process.exit(status);
}
const temporary = process.argv[3];
let server;
let prisma;
try {
  const files = readdirSync(temporary, { recursive: true, withFileTypes: true })
    .filter(f => f.isFile()).map(f => join(f.parentPath, f.name));
  const secrets = ['PRISMA_SERVICE_TOKEN', 'DATABASE_URL', 'JWT_SECRET',
    'JWT_REFRESH_SECRET', 'S3_SECRET_ACCESS_KEY'].map(k => process.env[k]).filter(Boolean);
  for (const file of files) {
    assert(!/(^|[\\/])\.env($|\.)/.test(file), 'No dotenv files in artifact');
    const bytes = readFileSync(file);
    assert(!secrets.some(s => bytes.includes(Buffer.from(s))), 'No embedded secrets');
  }
  for (const platform of ['linux-x64', 'linux-arm64']) {
    assert(readdirSync(join(temporary, 'node_modules/argon2/prebuilds', platform))
      .some(f => f.endsWith('.glibc.node')));
  }
  const require = createRequire(join(temporary, 'package.json'));
  const argon = require('argon2');
  const hash = await argon.hash('artifact-smoke-password');
  assert(await argon.verify(hash, 'artifact-smoke-password'));
  assert(!(await argon.verify(hash, 'wrong-password')));
  const { app } = await import(pathToFileURL(join(temporary, 'app.js')).href);
  ({ prisma } = await import(pathToFileURL(join(temporary, 'core/prisma.js')).href));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  for (const [path, expected] of [['/api/health', 200], ['/api', 200], ['/api/auth/me', 401]]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    assert.equal(response.status, expected, path);
    await response.text();
  }
  console.log(`Isolated artifact passed: ${files.length} files; no secrets; native hashing; health; auth guard.`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (prisma) await prisma.$disconnect();
}
