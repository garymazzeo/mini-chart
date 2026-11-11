import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const packageName = packageJson.name;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const chromePath = process.env.CHROME_BIN
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const requiredFiles = [
  'LICENSE',
  'README.md',
  'core.d.ts',
  'core.js',
  'dist/MiniChart.d.ts',
  'dist/MiniChart.js',
  'mini-chart.d.ts',
  'mini-chart.js',
  'package.json',
].sort();
const tempBase = process.env.MINICHART_TEST_TMPDIR ?? tmpdir();
mkdirSync(tempBase, { recursive: true });
const tempRoot = mkdtempSync(join(tempBase, 'mini-chart-pack-'));
const packDirectory = join(tempRoot, 'packs');
const projectDirectory = join(tempRoot, 'consumer');
mkdirSync(packDirectory);
mkdirSync(projectDirectory);

function run(command, args, cwd, { capture = true, env = process.env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    stdio: capture ? 'pipe' : 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status ?? result.signal}).\n${result.stdout ?? ''}${result.stderr ?? ''}`);
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function parseNpmPackJson(output, label) {
  const start = output.search(/^\s*[\[{]/m);
  if (start < 0) throw new Error(`${label} did not return npm pack JSON:\n${output}`);
  const parsed = JSON.parse(output.slice(start));
  if (Array.isArray(parsed)) {
    if (parsed.length !== 1) throw new Error(`${label} returned an unexpected result.`);
    return parsed[0];
  }
  if (Array.isArray(parsed.files)) return parsed;
  const packages = Object.values(parsed).filter((value) => value && Array.isArray(value.files));
  if (packages.length !== 1) throw new Error(`${label} returned an unexpected result.`);
  return packages[0];
}

function checkPackedFiles(files, label) {
  const actual = files.map((file) => file.path).sort();
  assert.deepEqual(actual, requiredFiles, `${label} file list must match the publish allowlist exactly`);
}

function writeTypeScriptConsumer() {
  writeFileSync(join(projectDirectory, 'consumer.tsx'), `
import { createElement } from 'react';
import {
  buildChart,
  clampPoint,
  nextPoint,
  niceTicks,
  pointDimensions,
  type BuildChartOptions,
  type ChartData,
  type DataPoint,
  type PointDimensions,
  type SvgNode,
} from ${JSON.stringify(packageName)};
import ${JSON.stringify(`${packageName}/element`)};
import { Chart, type ChartProps } from ${JSON.stringify(`${packageName}/react`)};

const data: ChartData = {
  labels: ['Jan'],
  series: [{ name: 'Sales', values: [3], color: 'var(--mc-color-1)' }],
};
const options: BuildChartOptions = {
  type: 'line', data, width: 320, height: 220, colors: ['#0072b2'],
  caption: 'Typed chart', description: 'Sales in January.', table: 'visible',
  interactive: true, idPrefix: 'typed-chart',
};
const tree: SvgNode = buildChart(options);
const dimensions: PointDimensions = pointDimensions('line', data);
const point: DataPoint = { category: 0, series: 0 };
const ticks: number[] = niceTicks(0, 3);
const clamped: DataPoint | null = clampPoint(point, dimensions);
const next: DataPoint | null | undefined = nextPoint(point, 'ArrowRight', dimensions);
const props: ChartProps = { ...options };
const reactElement = createElement(Chart, props);
const customElement = document.createElement('mini-chart');
customElement.data = data;
void [tree, ticks, clamped, next, reactElement, customElement];
`);
}

function writeNodeSmoke() {
  writeFileSync(join(projectDirectory, 'node-smoke.mjs'), `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const packageName = ${JSON.stringify(packageName)};
assert.equal(typeof globalThis.document, 'undefined');
assert.equal(typeof globalThis.HTMLElement, 'undefined');
assert.equal(typeof globalThis.customElements, 'undefined');
const core = await import(packageName);
const elementEntry = await import(packageName + '/element');
const reactEntry = await import(packageName + '/react');
const require = createRequire(import.meta.url);
const packageMetadata = require(packageName + '/package.json');
assert.equal(packageMetadata.name, packageName);
assert.equal(typeof elementEntry, 'object');
assert.equal(typeof reactEntry.Chart, 'function');
const data = { labels: ['Jan'], series: [{ name: 'Sales', values: [3] }] };
const tree = core.buildChart({ type: 'bar', data, colors: ['#0072b2'], width: 320, height: 220 });
assert.equal(tree.tag, 'svg');
const React = await import('react');
const { renderToString } = await import('react-dom/server');
const markup = renderToString(React.createElement(reactEntry.Chart, {
  type: 'bar', data, caption: 'Server-rendered chart', description: 'Sales in January.',
}));
assert.match(markup, /<svg[ >]/);
assert.match(markup, /<figure[ >]/);
console.log('Node ESM entrypoints, core tree, package.json, and React SSR passed.');
`);
}

function writeBrowserConsumer() {
  writeFileSync(join(projectDirectory, 'browser-consumer.jsx'), `
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { Chart } from ${JSON.stringify(`${packageName}/react`)};
import ${JSON.stringify(`${packageName}/element`)};

const data = {
  labels: ['Jan', 'Feb'],
  series: [{ name: 'Sales', values: [3, 7] }],
};
createRoot(document.querySelector('#react-root')).render(createElement(Chart, {
  type: 'bar', data, caption: 'Packed React chart', description: 'Sales by month.',
}));
const customChart = document.querySelector('#element-root mini-chart');
customChart.data = data;
`);
  writeFileSync(join(projectDirectory, 'element-register.js'), `import ${JSON.stringify(`${packageName}/element`)};\n`);
}

async function buildBrowserBundle(entry) {
  const result = await build({
    absWorkingDir: projectDirectory,
    entryPoints: [entry],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: ['chrome120'],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  return result.outputFiles[0].text;
}

async function launchChromium() {
  const options = {
    headless: true,
    ...(existsSync(chromePath) ? { executablePath: chromePath } : {}),
  };
  try {
    return await chromium.launch(options);
  } catch {
    console.log('Chromium is not installed for Playwright; installing it for the pack smoke test.');
    run(npmCommand, ['exec', '--', 'playwright', 'install', 'chromium'], root, { capture: false });
    return chromium.launch(options);
  }
}

async function main() {
  if (!process.argv.includes('--skip-build')) {
    run(npmCommand, ['run', 'build'], root, { capture: false });
  }
  const dryRunResult = run(npmCommand, ['pack', '--dry-run', '--json', '--ignore-scripts'], root);
  const dryRun = parseNpmPackJson(dryRunResult.stdout, 'npm pack --dry-run --json');
  checkPackedFiles(dryRun.files, 'npm pack dry run');

  const packResult = run(npmCommand, ['pack', '--json', '--pack-destination', packDirectory, '--ignore-scripts'], root);
  const packed = parseNpmPackJson(packResult.stdout, 'npm pack');
  checkPackedFiles(packed.files, 'npm pack');
  const tarball = join(packDirectory, packed.filename);
  const tarballSize = statSync(tarball).size;
  console.log(`Packed file list (${packed.files.length} files):\n${requiredFiles.map((file) => `  ${file}`).join('\n')}`);
  console.log(`Tarball: ${packed.filename} (${tarballSize} bytes)`);

  run(npmCommand, ['exec', '--', 'publint', 'run', tarball], root, { capture: false });
  run(npmCommand, ['exec', '--', 'attw', '--profile', 'esm-only', '--pack', root], root, {
    capture: false,
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  });
  run(npmCommand, ['exec', '--', 'attw', '--profile', 'esm-only', tarball], root, { capture: false });

  writeFileSync(join(projectDirectory, 'package.json'), JSON.stringify({ private: true, type: 'module' }, null, 2));
  run(npmCommand, [
    'install', '--no-audit', '--no-fund', tarball,
    'react', 'react-dom', 'typescript', '@types/react', '@types/react-dom',
  ], projectDirectory, { capture: false });
  writeNodeSmoke();
  writeTypeScriptConsumer();
  writeBrowserConsumer();

  run(process.execPath, [join(projectDirectory, 'node-smoke.mjs')], projectDirectory, { capture: false });

  const tsc = join(projectDirectory, 'node_modules/typescript/bin/tsc');
  for (const resolution of ['bundler', 'nodenext']) {
    const nodeNext = resolution === 'nodenext';
    const configPath = join(projectDirectory, `tsconfig.${resolution}.json`);
    writeFileSync(configPath, JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: nodeNext ? 'NodeNext' : 'ESNext',
        moduleResolution: nodeNext ? 'NodeNext' : 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ['consumer.tsx'],
    }, null, 2));
    run(process.execPath, [tsc, '--project', configPath], projectDirectory, { capture: false });
    console.log(`TypeScript moduleResolution ${resolution}: passed.`);
  }

  const compiledReact = readFileSync(join(root, 'dist/MiniChart.js'), 'utf8');
  assert.match(compiledReact, /^['"]use client['"];?/);

  const browser = await launchChromium();
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.setContent(`<!doctype html><html lang="en"><head><title>Packed consumer</title></head><body>
      <div id="react-root"></div>
      <section id="element-root"><mini-chart type="line" caption="Packed custom element" description="Sales by month."></mini-chart></section>
    </body></html>`);
    await page.addScriptTag({ content: await buildBrowserBundle('browser-consumer.jsx') });
    await page.waitForFunction(() => document.querySelector('#react-root figure svg')
      && document.querySelector('#element-root mini-chart')?.shadowRoot?.querySelector('figure svg'));
    const registerBundle = await buildBrowserBundle('element-register.js');
    await page.addScriptTag({ content: registerBundle });
    await page.addScriptTag({ content: registerBundle });
    const rendered = await page.evaluate(() => ({
      reactSvg: document.querySelector('#react-root figure svg')?.getAttribute('data-chart-type'),
      elementSvg: document.querySelector('#element-root mini-chart').shadowRoot.querySelector('svg')?.getAttribute('data-chart-type'),
      registered: customElements.get('mini-chart') !== undefined,
    }));
    assert.deepEqual(rendered, { reactSvg: 'bar', elementSvg: 'line', registered: true });
    assert.deepEqual(pageErrors, []);
    console.log('Bundled React and custom-element entries rendered in Chromium; duplicate registration was safe.');
    await page.close();
  } finally {
    await browser.close();
  }
}

try {
  await main();
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
