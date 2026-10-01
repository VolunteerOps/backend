import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
let directory;
try {
  const env = { ...process.env };
  if (env.GOOGLE_SERVICE_ACCOUNT_B64) {
    const credential = JSON.parse(Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
    if (credential.type !== 'service_account' || typeof credential.private_key !== 'string' ||
        !credential.private_key.includes('BEGIN PRIVATE KEY') || typeof credential.client_email !== 'string' || !credential.project_id) throw new Error('INVALID_GOOGLE_CREDENTIALS');
    directory = mkdtempSync(join(tmpdir(), 'resq-credentials-'));
    const path = join(directory, 'google.json');
    writeFileSync(path, JSON.stringify(credential), { mode: 0o600 });
    env.GOOGLE_APPLICATION_CREDENTIALS = path;
  }
  if (env.GOOGLE_CREDENTIALS_REQUIRED === 'true' && !env.GOOGLE_APPLICATION_CREDENTIALS) throw new Error('GOOGLE_CREDENTIALS_REQUIRED');
  delete env.GOOGLE_SERVICE_ACCOUNT_B64;
  const args = process.argv.slice(2);
  if (!args.length) throw new Error('ENTRYPOINT_REQUIRED');
  const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
  let timer;
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
    child.kill(signal);
    timer = setTimeout(() => child.kill('SIGKILL'), 28000); timer.unref();
  });
  const cleanup = () => { if (timer) clearTimeout(timer); if (directory) rmSync(directory, { recursive: true, force: true }); };
  child.once('error', () => { cleanup(); console.error('PROCESS_START_FAILED'); process.exitCode = 1; });
  child.once('exit', (code, signal) => { cleanup(); process.exitCode = code ?? (signal ? 1 : 0); });
} catch {
  if (directory) rmSync(directory, { recursive: true, force: true });
  console.error('CREDENTIAL_BOOTSTRAP_FAILED'); process.exitCode = 1;
}
