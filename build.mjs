// dist/: weave-avatar.js (one ES module, three.js inside), its files in avatar/ next to it, and README.md.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { build } from 'esbuild';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
await build({ entryPoints: ['src/index.js'], outfile: 'dist/weave-avatar.js', bundle: true, format: 'esm', platform: 'browser', target: 'chrome120', minify: true, legalComments: 'eof' });
cpSync('src/avatar', 'dist/avatar', { recursive: true });
cpSync('README.md', 'dist/README.md');
console.log('built dist/weave-avatar.js');
