import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const tsc = resolve(root, 'node_modules/typescript/bin/tsc');

if (!existsSync(tsc)) throw new Error('TypeScript is missing; run npm install before npm run build.');
rmSync(dist, { recursive: true, force: true });

const result = spawnSync(process.execPath, [tsc, '--project', resolve(root, 'tsconfig.build.json')], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

for (const file of ['MiniChart.js', 'MiniChart.d.ts']) {
  const path = resolve(dist, file);
  if (!existsSync(path)) throw new Error(`TypeScript did not emit dist/${file}`);
  const output = readFileSync(path, 'utf8')
    .replaceAll("from './core.js'", "from '../core.js'")
    .replaceAll('from "./core.js"', 'from "../core.js"');
  writeFileSync(path, output);
}

const wrapper = readFileSync(resolve(dist, 'MiniChart.js'), 'utf8');
if (!/^['"]use client['"];?\s/.test(wrapper)) {
  throw new Error("The compiled React wrapper must preserve the top-level 'use client' directive.");
}
if (/from ['"]\.\/core\.js['"]/.test(wrapper)) {
  throw new Error('The compiled React wrapper contains a broken relative core.js import.');
}
