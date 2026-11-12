import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = async (path) => readFile(resolve(root, path), 'utf8');
const write = async (path, content) => writeFile(resolve(root, path), content);

const core = (await source('core.js')).replace(/^export\s+/gm, '');
const element = (await source('mini-chart.js')).replace(/^import\s+\{[^}]+\}\s+from\s+['"]\.\/core\.js['"];\s*/m, '');
const scriptEnd = '<' + '/script>';
const webDemoScript = `
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const random = (min, max) => Math.round(min + Math.random() * (max - min));
const bar = document.querySelector('#revenue');
const horizontal = document.querySelector('#regions');
const line = document.querySelector('#visitors');
const pie = document.querySelector('#sources');
function updateData() {
  bar.data = { labels: months, series: [{ name: 'Revenue', values: months.map(() => random(20, 90)) }] };
  horizontal.data = {
    labels: ['North', 'South', 'East', 'West'],
    series: [
      { name: 'Revenue', values: ['North', 'South', 'East', 'West'].map(() => random(30, 95)) },
      { name: 'Costs', values: ['North', 'South', 'East', 'West'].map(() => random(10, 45)) },
    ],
  };
  line.data = { labels: months, series: [
    { name: 'Visitors', values: months.map(() => random(40, 100)) },
    { name: 'Signups', values: months.map(() => random(5, 45)), color: '#b44b91' },
  ] };
}
updateData();
bar.colors = ['var(--m-color-primary, #0072b2)'];
pie.data = { labels: ['Search', 'Direct', 'Social', 'Email'], series: [{ values: [46, 28, 16, 10] }] };
const themeScope = document.querySelector('#theme-scope');
document.querySelector('#color-theme').addEventListener('change', (event) => {
  if (event.target.value === 'default') themeScope.removeAttribute('data-theme');
  else themeScope.setAttribute('data-theme', event.target.value);
});
document.querySelector('#grid-style').addEventListener('change', (event) => {
  const style = event.target.value === 'dashed' ? 'dashed' : 'solid';
  themeScope.querySelectorAll('mini-chart').forEach((chart) => chart.setAttribute('grid-style', style));
});
document.querySelector('#randomize').addEventListener('click', updateData);
`;

const webHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mini-chart accessible demo</title>
  <style>
    :root { color-scheme: light dark; font: 16px/1.5 system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px 16px; color: CanvasText; background: Canvas; }
    main { width: 100%; max-width: 960px; margin: 0 auto; }
    h1 { font-size: 1.6rem; margin: 0 0 8px; }
    .instructions { max-width: 72ch; margin: 0 0 20px; }
    .controls { display: flex; flex-wrap: wrap; gap: 12px 20px; margin: 16px 0; }
    .controls label { display: flex; align-items: center; gap: 8px; }
    select { font: inherit; padding: 6px 8px; }
    .theme-scope[data-theme="brand"] { --m-color-primary: #1d4ed8; --m-color-secondary: #ea580c; --m-color-accent: #16803c; }
    .theme-scope[data-theme="high-contrast"] { --m-color-primary: #004c6d; --m-color-secondary: #8c2d00; --m-color-accent: #005c43; }
    @media (prefers-color-scheme: dark) { .theme-scope:not([data-theme]) { --m-color-primary: #56b4e9; --m-color-secondary: #f0a202; --m-color-accent: #50e3a4; } }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 16px; }
    section { min-width: 0; padding: 12px; border: 1px solid currentColor; border-radius: 8px; }
    h2 { font-size: 1rem; margin: 0 0 8px; }
    button { font: inherit; padding: 8px 14px; margin: 16px 0; }
  </style>
</head>
<body>
  <main>
    <h1>mini-chart</h1>
    <p class="instructions">Focus an interactive chart and use Left/Right to move through categories, Up/Down to change series, Home/End to jump to a boundary, and Escape to dismiss the tooltip. You can also hover or tap a data point. The revenue examples include vertical and horizontal bars. The charts demonstrate visible, screen-reader-only, and omitted data tables.</p>
    <div class="controls">
      <label>Color theme <select id="color-theme"><option value="default">Default</option><option value="brand">Brand</option><option value="high-contrast">High contrast</option></select></label>
      <label>Grid lines <select id="grid-style"><option value="solid">Solid</option><option value="dashed">Dashed</option></select></label>
    </div>
    <div id="theme-scope" class="theme-scope">
      <div class="grid">
        <section><h2>Revenue (visible table)</h2><mini-chart id="revenue" type="bar" caption="Monthly revenue" table="visible"></mini-chart></section>
        <section><h2>Revenue by region (horizontal bars)</h2><mini-chart id="regions" type="horizontal-bar" caption="Revenue by region" description="Revenue and costs for each region." table="hidden"></mini-chart></section>
        <section><h2>Visitors (hidden table)</h2><mini-chart id="visitors" type="line" caption="Visitors and signups" description="Monthly visitor and signup counts for six months." table="hidden"></mini-chart></section>
        <section><h2>Traffic (description instead of table)</h2><mini-chart id="sources" type="pie" caption="Traffic sources" description="Share of visits from search, direct, social, and email sources." table="none"></mini-chart></section>
      </div>
    </div>
    <button id="randomize" type="button">Randomize data</button>
  </main>
  <script type="module">
${core}
${element}
${webDemoScript}
  ${scriptEnd}
</body>
</html>
`;
await write('demo.html', webHtml);
await write('docs/index.html', webHtml);

const reactSource = await source('MiniChart.tsx');
const reactOutput = await transform(reactSource, { loader: 'tsx', format: 'esm', target: 'es2022', jsx: 'automatic' });
const reactImports = reactOutput.code.match(/^import\b[\s\S]*?from\s+["']react["'];/m)?.[0] ?? '';
const wrapper = reactOutput.code
  .replace(/^['"]use client['"];\s*/m, '')
  .replace(/^import\b[\s\S]*?;[ \t]*\n?/gm, '')
  .replace(/^export\s+/gm, '');
const reactPage = `'use client';
${reactImports}
${core}
${wrapper}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const random = (min, max) => Math.round(min + Math.random() * (max - min));
const initialData = {
  labels: MONTHS,
  series: [
    { name: 'Revenue', values: [62, 70, 55, 84, 91, 78] },
    { name: 'Costs', values: [12, 18, 14, 30, 35, 27], color: '#b44b91' },
  ],
};
const randomData = () => ({
  labels: MONTHS,
  series: [
    { name: 'Revenue', values: MONTHS.map(() => random(40, 100)) },
    { name: 'Costs', values: MONTHS.map(() => random(5, 45)), color: '#b44b91' },
  ],
});

export default function Page() {
  const [type, setType] = useState('bar');
  const [data, setData] = useState(initialData);
  const [table, setTable] = useState('hidden');
  const [gridStyle, setGridStyle] = useState('solid');
  const themeScope = useRef(null);
  const description = 'Monthly revenue and costs across the selected period.';
  const updateTheme = (event) => {
    const scope = themeScope.current;
    if (!scope) return;
    if (event.target.value === 'default') scope.removeAttribute('data-theme');
    else scope.setAttribute('data-theme', event.target.value);
  };

  return (
    <main style={{ maxWidth: 720, width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <style>{'.theme-scope[data-theme="brand"]{--m-color-primary:#1d4ed8;--m-color-secondary:#ea580c;--m-color-accent:#16803c}.theme-scope[data-theme="high-contrast"]{--m-color-primary:#004c6d;--m-color-secondary:#8c2d00;--m-color-accent:#005c43}@media(prefers-color-scheme:dark){.theme-scope:not([data-theme]){--m-color-primary:#56b4e9;--m-color-secondary:#f0a202;--m-color-accent:#50e3a4}}'}</style>
      <h1>mini-chart in React</h1>
      <p>Focus the chart and use arrow keys, Home, End, or Escape. The tooltip is also available by hover or touch.</p>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        {['bar', 'horizontal-bar', 'line', 'pie'].map((chartType) => (
          <button key={chartType} aria-pressed={type === chartType} onClick={() => setType(chartType)}>{chartType}</button>
        ))}
        <button onClick={() => setTable((mode) => mode === 'hidden' ? 'visible' : mode === 'visible' ? 'none' : 'hidden')}>Table mode: {table}</button>
        <button onClick={() => setData(randomData())}>Randomize</button>
        <label>Color theme <select defaultValue="default" onChange={updateTheme}><option value="default">Default</option><option value="brand">Brand</option><option value="high-contrast">High contrast</option></select></label>
        <label>Grid lines <select value={gridStyle} onChange={(event) => setGridStyle(event.target.value)}><option value="solid">Solid</option><option value="dashed">Dashed</option></select></label>
      </div>
      <div ref={themeScope} className="theme-scope">
        <Chart type={type} data={data} colors={['var(--m-color-accent, #009e73)', '#d55e00', '#cc79a7', '#a06100', '#007f86', '#8c6d31', '#4c78a8']} gridStyle={gridStyle} caption={type === 'pie' ? 'Revenue and costs' : type === 'horizontal-bar' ? 'Revenue by month' : 'Monthly revenue and costs'} description={description} table={table} interactive />
      </div>
    </main>
  );
}
`;
await transform(reactPage, { loader: 'jsx', format: 'esm', target: 'es2022' });
await write('page.jsx', reactPage);
console.log('Assembled demo.html, docs/index.html, and page.jsx from core.js and the current wrappers.');
