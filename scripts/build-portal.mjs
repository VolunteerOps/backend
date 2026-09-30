import { build } from 'esbuild';
import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist/portal', { recursive: true });
await build({ entryPoints: ['portal/main.ts'], bundle: true, outdir: 'dist/portal',
  platform: 'browser', target: ['es2022'], format: 'esm', minify: true, sourcemap: false,
  legalComments: 'linked', loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file' } });
await copyFile('portal/index.html', 'dist/portal/index.html');

await cp('portal/fonts', 'dist/portal/fonts', {recursive:true});
