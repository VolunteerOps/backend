import { spawn } from 'node:child_process';
import { mkdir, chown, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGateway, readConfig, credentialDocument, seaweedArguments } from './gateway.mjs';

const config = readConfig(process.env);
const dataDir = '/data';
await mkdir(dataDir, { recursive: true });
if (process.getuid?.() === 0) {
  await chown(dataDir, 1000, 1000);
  process.setgid(1000);
  process.setuid(1000);
}
process.umask(0o077);
const secretDir = await mkdtemp(join(tmpdir(), 'resq-storage-'));
const secretFile = join(secretDir, 's3.json');
await writeFile(secretFile, JSON.stringify(credentialDocument(config)), { mode: 0o600 });
const childEnv = { ...process.env };
for (const key of Object.keys(childEnv)) {
  if (/^(?:S3_(?:ROOT_)?(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)|AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN))$/.test(key)) delete childEnv[key];
}
const child = spawn('/usr/local/bin/weed', seaweedArguments(config, dataDir, secretFile), { stdio: ['ignore', 'inherit', 'inherit'], env: childEnv });
const gateway = createGateway(config);
let stopping = false;
async function stop(code) {
  if (stopping) return;
  stopping = true;
  gateway.close();
  child.kill('SIGTERM');
  const timer = setTimeout(() => { child.kill('SIGKILL'); process.exit(code); }, 20000);
  timer.unref();
  if (child.pid && child.exitCode === null && child.signalCode === null) await new Promise((resolve) => child.once('exit', resolve));
  await rm(secretDir, { recursive: true, force: true });
  process.exit(code);
}
child.on('error', () => { console.error('Object storage process failed to start'); void stop(1); });
child.on('exit', (code) => { if (!stopping) { console.error('Object storage process exited'); void stop(code || 1); } });
gateway.on('error', () => { console.error('Object storage gateway failed'); void stop(1); });
process.on('SIGTERM', () => void stop(0));
process.on('SIGINT', () => void stop(0));
gateway.listen(config.port, '0.0.0.0', () => console.log('Object storage gateway started; waiting for bucket readiness'));
