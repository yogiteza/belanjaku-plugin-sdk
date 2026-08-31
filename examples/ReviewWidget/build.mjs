import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');

mkdirSync(distDir, { recursive: true });

// swift-page loads plugins via a classic <script async> tag, not an ES
// module — the bundle MUST be an IIFE. See ../../docs/plugin-contract.md.
await esbuild.build({
  entryPoints: [join(__dirname, 'src/index.js')],
  outfile: join(distDir, 'index.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2017'],
  minify: true,
  legalComments: 'none',
});

copyFileSync(join(__dirname, 'manifest.json'), join(distDir, 'manifest.json'));

// Sanity check: the bundle must actually register itself.
const bundle = readFileSync(join(distDir, 'index.js'), 'utf8');
if (!bundle.includes('SwiftpageComponents')) {
  throw new Error('Build output does not register SwiftpageComponents — check createPlugin()');
}

console.log('Built dist/index.js + dist/manifest.json — zip dist/ and upload to plugin-service.');
