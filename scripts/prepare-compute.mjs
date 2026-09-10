import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { nodeFileTrace } from '@vercel/nft';

const root = process.cwd();
const entry = resolve('dist/index.js');
const artifact = resolve('.prisma/compute-artifact');
if (!existsSync(entry)) throw new Error('Run npm run build first.');
// Only this generated artifact is replaced; never touch source or credentials.
if (relative(root, artifact) !== join('.prisma', 'compute-artifact')) {
  throw new Error('Invalid artifact directory.');
}
rmSync(artifact, { recursive: true, force: true });
mkdirSync(artifact, { recursive: true });
cpSync(resolve('dist'), artifact, {
  recursive: true,
  dereference: true,
  filter: path => !relative(resolve('dist'), path).split(/[\\/]/).includes('node_modules'),
});
// The custom Compute adapter stages files as-is, unlike the NestJS adapter.
// Trace and relocate runtime dependencies explicitly, using both Bun and Node
// export conditions. This keeps build tools and local credentials out.
const { fileList } = await nodeFileTrace([entry], {
  base: root,
  processCwd: root,
  conditions: ['node', 'bun', 'import', 'require', 'default'],
});
for (const file of fileList) {
  const normalized = file.replaceAll('\\', '/');
  if (!normalized.startsWith('node_modules/')) continue;
  const target = join(artifact, file);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(root, file), target, { dereference: true });
}
writeFileSync(join(artifact, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
// A Windows trace cannot discover the Linux native password-hashing binaries.
const require = createRequire(import.meta.url);
const argon = dirname(require.resolve('argon2/package.json'));
for (const platform of ['linux-x64', 'linux-arm64']) {
  if (!readdirSync(join(argon, 'prebuilds', platform)).some(f => f.endsWith('.glibc.node'))) {
    throw new Error(`Missing Argon2 ${platform} binary.`);
  }
}
cpSync(argon, join(artifact, 'node_modules/argon2'), { recursive: true, dereference: true });
console.log(`Prepared standalone Compute artifact (${fileList.size} traced files plus Argon2 prebuilds).`);
