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
const regions = ['North', 'South', 'East', 'West'];
const random = (min, max) => Math.round(min + Math.random() * (max - min));
const bar = document.querySelector('#revenue');
const horizontal = document.querySelector('#regions');
const line = document.querySelector('#visitors');
const pie = document.querySelector('#sources');
const themeSets = {
  default: { '--mc-color-1': '#0072b2' },
  brand: { '--mc-color-1': '#009e73', '--mc-color-2': '#d55e00', '--mc-color-3': '#0072b2', '--mc-color-4': '#cc79a7' },
  'high-contrast': { '--mc-color-1': '#0072b2', '--mc-color-2': '#d55e00', '--mc-color-3': '#009e73', '--mc-color-4': '#cc79a7', '--mc-color-5': '#a06100', '--mc-color-6': '#007f86', '--mc-color-7': '#8c6d31', '--mc-color-8': '#4c78a8', '--mc-text-color': 'CanvasText', '--mc-axis-text-color': 'CanvasText', '--mc-grid-color': 'CanvasText', '--mc-grid-opacity': '0.5', '--mc-grid-width': '1.5', '--mc-baseline-width': '2', '--mc-focus-color': 'Highlight', '--mc-focus-width': '3px' },
};
const themeProperties = new Set(Object.values(themeSets).flatMap((theme) => Object.keys(theme)));
function applyTheme(name) {
  const rootStyle = document.documentElement.style;
  for (const property of themeProperties) rootStyle.removeProperty(property);
  for (const [property, value] of Object.entries(themeSets[name] ?? themeSets.default)) rootStyle.setProperty(property, value);
}
const gridDashes = { solid: 'none', dashed: '4 4', dotted: '1 3' };
document.querySelector('#theme').addEventListener('change', (event) => applyTheme(event.target.value));
document.querySelector('#grid-style').addEventListener('change', (event) => document.documentElement.style.setProperty('--mc-grid-dash', gridDashes[event.target.value]));
applyTheme('default');
function updateData() {
  bar.data = { labels: months, series: [{ name: 'Revenue', values: months.map(() => random(20, 90)) }] };
  horizontal.data = {
    labels: regions,
    series: [
      { name: 'Revenue', values: regions.map(() => random(30, 95)), color: 'var(--mc-color-1)' },
      { name: 'Costs', values: regions.map(() => random(10, 45)) },
    ],
  };
  line.data = { labels: months, series: [
    { name: 'Visitors', values: months.map(() => random(40, 100)) },
    { name: 'Signups', values: months.map(() => random(5, 45)) },
  ] };
}
updateData();
pie.data = { labels: ['Search', 'Direct', 'Social', 'Email'], series: [{ values: [46, 28, 16, 10] }] };
document.querySelector('#randomize').addEventListener('click', updateData);
`;

const webHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mini-chart accessible demo</title>
  <style>
    :root { color-scheme: light dark; font: 16px/1.5 system-ui, sans-serif; --mc-color-1: #0072b2; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px 16px; color: CanvasText; background: Canvas; }
    main { width: 100%; max-width: 960px; margin: 0 auto; }
    h1 { font-size: 1.6rem; margin: 0 0 8px; }
    .instructions { max-width: 72ch; margin: 0 0 20px; }
    .controls { display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }
    .controls label { display: grid; gap: 4px; }
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
      <label for="theme">Theme
        <select id="theme"><option value="default">Default</option><option value="brand">Brand</option><option value="high-contrast">High contrast</option></select>
      </label>
      <label for="grid-style">Grid
        <select id="grid-style"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select>
      </label>
    </div>
    <div class="grid">
      <section><h2>Revenue (visible table)</h2><mini-chart id="revenue" type="bar" caption="Monthly revenue" table="visible"></mini-chart></section>
      <section><h2>Revenue by region (horizontal bars)</h2><mini-chart id="regions" type="horizontal-bar" caption="Revenue by region" description="Revenue and costs for each region." table="hidden"></mini-chart></section>
      <section><h2>Visitors (hidden table)</h2><mini-chart id="visitors" type="line" caption="Visitors and signups" description="Monthly visitor and signup counts for six months." table="hidden"></mini-chart></section>
      <section><h2>Traffic (description instead of table)</h2><mini-chart id="sources" type="pie" caption="Traffic sources" description="Share of visits from search, direct, social, and email sources." table="none"></mini-chart></section>
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
    { name: 'Revenue', values: [62, 70, 55, 84, 91, 78], color: 'var(--mc-color-1)' },
    { name: 'Costs', values: [12, 18, 14, 30, 35, 27] },
  ],
};
const randomData = () => ({
  labels: MONTHS,
  series: [
    { name: 'Revenue', values: MONTHS.map(() => random(40, 100)), color: 'var(--mc-color-1)' },
    { name: 'Costs', values: MONTHS.map(() => random(5, 45)) },
  ],
});

const STYLE_THEMES = {
  default: { '--mc-color-1': '#0072b2' },
  brand: { '--mc-color-1': '#009e73', '--mc-color-2': '#d55e00', '--mc-color-3': '#0072b2', '--mc-color-4': '#cc79a7' },
  'high-contrast': { '--mc-color-1': '#0072b2', '--mc-color-2': '#d55e00', '--mc-color-3': '#009e73', '--mc-color-4': '#cc79a7', '--mc-color-5': '#a06100', '--mc-color-6': '#007f86', '--mc-color-7': '#8c6d31', '--mc-color-8': '#4c78a8', '--mc-text-color': 'CanvasText', '--mc-axis-text-color': 'CanvasText', '--mc-grid-color': 'CanvasText', '--mc-grid-opacity': '0.5', '--mc-grid-width': '1.5', '--mc-baseline-width': '2', '--mc-focus-color': 'Highlight', '--mc-focus-width': '3px' },
};
const STYLE_THEME_PROPERTIES = [...new Set(Object.values(STYLE_THEMES).flatMap((theme) => Object.keys(theme)))];
const STYLE_GRID_DASHES = { solid: 'none', dashed: '4 4', dotted: '1 3' };

function applyStyleTheme(name, originalValues) {
  const style = document.documentElement.style;
  for (const property of STYLE_THEME_PROPERTIES) {
    const originalValue = originalValues.get(property);
    if (originalValue) style.setProperty(property, originalValue);
    else style.removeProperty(property);
  }
  for (const [property, value] of Object.entries(STYLE_THEMES[name] ?? STYLE_THEMES.default)) style.setProperty(property, value);
}

export default function Page() {
  const [type, setType] = useState('bar');
  const [data, setData] = useState(initialData);
  const [table, setTable] = useState('hidden');
  const themeRef = useRef(null);
  const gridRef = useRef(null);
  const description = 'Monthly revenue and costs across the selected period.';

  useEffect(() => {
    const themeSelect = themeRef.current;
    const gridSelect = gridRef.current;
    if (!themeSelect || !gridSelect) return undefined;
    const rootStyle = document.documentElement.style;
    const originalThemeValues = new Map(STYLE_THEME_PROPERTIES.map((property) => [property, rootStyle.getPropertyValue(property)]));
    const controlledProperties = [...STYLE_THEME_PROPERTIES, '--mc-grid-dash'];
    const originalValues = new Map(controlledProperties.map((property) => [property, rootStyle.getPropertyValue(property)]));
    const changeTheme = () => applyStyleTheme(themeSelect.value, originalThemeValues);
    const changeGrid = () => rootStyle.setProperty('--mc-grid-dash', STYLE_GRID_DASHES[gridSelect.value]);
    themeSelect.addEventListener('change', changeTheme);
    gridSelect.addEventListener('change', changeGrid);
    changeTheme();
    changeGrid();
    return () => {
      themeSelect.removeEventListener('change', changeTheme);
      gridSelect.removeEventListener('change', changeGrid);
      for (const [property, value] of originalValues) {
        if (value) rootStyle.setProperty(property, value);
        else rootStyle.removeProperty(property);
      }
    };
  }, []);

  return (
    <main style={{ maxWidth: 720, width: '100%', boxSizing: 'border-box', margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <style>{':root { --mc-color-1: #0072b2; }'}</style>
      <h1>mini-chart in React</h1>
      <p>Focus the chart and use arrow keys, Home, End, or Escape. The tooltip is also available by hover or touch.</p>
      <div style={{ display: 'flex', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
        <label htmlFor="theme">Theme <select id="theme" ref={themeRef} defaultValue="default"><option value="default">Default</option><option value="brand">Brand</option><option value="high-contrast">High contrast</option></select></label>
        <label htmlFor="grid-style">Grid <select id="grid-style" ref={gridRef} defaultValue="solid"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option></select></label>
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        {['bar', 'horizontal-bar', 'line', 'pie'].map((chartType) => (
          <button key={chartType} aria-pressed={type === chartType} onClick={() => setType(chartType)}>{chartType}</button>
        ))}
        <button onClick={() => setTable((mode) => mode === 'hidden' ? 'visible' : mode === 'visible' ? 'none' : 'hidden')}>Table mode: {table}</button>
        <button onClick={() => setData(randomData())}>Randomize</button>
      </div>
      <Chart type={type} data={data} caption={type === 'pie' ? 'Revenue and costs' : type === 'horizontal-bar' ? 'Revenue by month' : 'Monthly revenue and costs'} description={description} table={table} interactive />
    </main>
  );
}
`;
await transform(reactPage, { loader: 'jsx', format: 'esm', target: 'es2022' });
await write('page.jsx', reactPage);
console.log('Assembled demo.html, docs/index.html, and page.jsx from core.js and the current wrappers.');
