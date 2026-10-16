import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const styles = await readFile(resolve(root, 'packages/insulin-planner/src/styles.css'), 'utf8');
await writeFile(
  resolve(root, 'packages/insulin-planner/src/styles.js'),
  '// Generated from styles.css by npm run build.\nexport const STYLES = ' +
    JSON.stringify(styles) +
    ';\n',
);
await mkdir(resolve(root, 'dist'), { recursive: true });
const result = await build({
  absWorkingDir: root,
  entryPoints: ['packages/insulin-planner/src/standalone.js'],
  bundle: true,
  write: false,
  format: 'iife',
  target: ['chrome120', 'firefox128', 'safari17'],
  legalComments: 'none',
});
const bundle = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html =
  '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Esquema de Insulinoterapia · Hospital Hanga Roa</title><style>body{margin:0}</style></head><body><main class="hhr-insulin"></main><script data-hhr-bundle>' +
  bundle +
  '</script></body></html>\n';
await writeFile(resolve(root, 'dist/insulinoterapia.html'), html);
await build({
  absWorkingDir: root,
  entryPoints: ['packages/insulin-planner/src/index.js'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/insulin-planner.js',
  target: ['chrome120', 'firefox128', 'safari17'],
  legalComments: 'none',
});
await build({
  absWorkingDir: root,
  entryPoints: ['packages/insulin-core/src/index.js'],
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  outfile: 'dist/insulin-core.js',
  target: 'es2022',
  legalComments: 'none',
});
console.log('Built autonomous HTML, browser planner, and reusable core in dist/.');
