import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STYLE, buildChart, buildFigure, clampPoint, nextPoint, pointDimensions } from '../core.js';

const data = {
  labels: ['Jan', 'Feb', 'Mar'],
  series: [
    { name: 'Revenue', values: [20, undefined, 90] },
    { name: 'Costs', values: [6, 4] },
  ],
};

function walk(node) {
  if (!node || typeof node === 'string') return [];
  return [node, ...node.children.flatMap(walk)];
}
function nodes(node, tag) { return walk(node).filter((entry) => entry.tag === tag); }
function text(node) {
  return typeof node === 'string' ? node : node.children.map(text).join('');
}
function cellText(row) { return row.children.map(text); }
function attr(node, name) { return node.attrs[name]; }

function luminance(color) {
  const channels = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}
function fallbackColor(entry) { return entry.startsWith('var(') ? entry.match(/^var\([^,]+,\s*(#[\da-f]{6})\)$/i)?.[1] : entry; }

test('buildFigure exposes every series value in semantic table cells', () => {
  const figure = buildFigure({ data, caption: 'Monthly results' });
  const table = nodes(figure, 'table')[0];
  const rows = nodes(table, 'tr');
  assert.equal(text(nodes(table, 'caption')[0]), 'Monthly results data');
  assert.deepEqual(cellText(rows[0]), ['Category', 'Revenue', 'Costs']);
  assert.deepEqual(cellText(rows[1]), ['Jan', '20', '6']);
  assert.deepEqual(cellText(rows[2]), ['Feb', '', '4']);
  assert.deepEqual(cellText(rows[3]), ['Mar', '90', '']);
  assert.match(attr(table, 'style'), /clip/);
});

test('pie table includes value and exact percentage for each label', () => {
  const figure = buildFigure({ type: 'pie', data: { labels: ['Search', 'Direct'], series: [{ values: [46, 54] }] } });
  const rows = nodes(nodes(figure, 'table')[0], 'tr');
  assert.deepEqual(cellText(rows[0]), ['Label', 'Value', 'Percentage']);
  assert.deepEqual(cellText(rows[1]), ['Search', '46', '46%']);
  assert.deepEqual(cellText(rows[2]), ['Direct', '54', '54%']);
});

test('ids are unique and static/interactive SVG references agree', () => {
  const first = buildChart({ data, caption: 'Results', description: 'A test description', interactive: false });
  const second = buildChart({ data, interactive: true });
  assert.notEqual(attr(first, 'aria-labelledby'), attr(second, 'aria-labelledby'));
  for (const svg of [first, second]) {
    const ids = new Set(nodes(svg, 'title').concat(nodes(svg, 'desc')).map((node) => attr(node, 'id')));
    assert.ok(ids.has(attr(svg, 'aria-labelledby')));
    assert.ok(ids.has(attr(svg, 'aria-describedby')));
  }
  assert.equal(attr(first, 'role'), 'img');
  assert.equal(attr(second, 'role'), 'group');
  assert.equal(attr(second, 'aria-roledescription'), 'chart');
  assert.equal(attr(second, 'tabindex'), 0);
  assert.equal(attr(first, 'tabindex'), undefined);
});

test('table none requires a description and empty charts are announced', () => {
  assert.throws(() => buildFigure({ data, table: 'none' }), /description/i);
  const empty = buildChart({ data: { labels: [], series: [] } });
  assert.equal(attr(empty, 'role'), 'img');
  assert.equal(text(nodes(empty, 'title')[0]), 'No data');
  const captionedEmpty = buildChart({ data: { labels: [], series: [] }, caption: 'Monthly revenue' });
  assert.equal(text(nodes(captionedEmpty, 'title')[0]), 'No data');
  assert.equal(attr(captionedEmpty, 'aria-labelledby'), attr(nodes(captionedEmpty, 'title')[0], 'id'));
  assert.equal(attr(captionedEmpty, 'aria-label'), undefined);
  assert.equal(text(nodes(empty, 'text').find((node) => attr(node, 'role') === 'status')), 'No data');
});

test('point dimensions and clamping are shared pure helpers for both wrappers', () => {
  const dims = pointDimensions('bar', {
    labels: ['Jan', 'Feb'],
    series: [{ values: [3] }, { values: [null, 5] }],
  });
  assert.deepEqual(dims, {
    categories: 2,
    series: 2,
    pie: false,
    validPoints: [[true, false], [false, true]],
  });
  assert.deepEqual(clampPoint({ category: 1, series: 0 }, dims), { category: 1, series: 1 });
  assert.equal(clampPoint({ category: 0, series: 0 }, pointDimensions('bar', { labels: [], series: [] })), null);
});

test('nextPoint supports keyboard navigation, boundaries, escape, and pie cycling', () => {
  const dims = { categories: 3, series: 2 };
  assert.deepEqual(nextPoint(null, 'ArrowRight', dims), { category: 0, series: 0 });
  assert.deepEqual(nextPoint({ category: 0, series: 0 }, 'ArrowRight', dims), { category: 1, series: 0 });
  assert.deepEqual(nextPoint({ category: 1, series: 0 }, 'ArrowDown', dims), { category: 1, series: 1 });
  assert.deepEqual(nextPoint({ category: 1, series: 1 }, 'ArrowLeft', dims), { category: 0, series: 1 });
  assert.deepEqual(nextPoint({ category: 1, series: 1 }, 'ArrowUp', dims), { category: 1, series: 0 });
  assert.deepEqual(nextPoint({ category: 1, series: 1 }, 'Home', dims), { category: 0, series: 1 });
  assert.deepEqual(nextPoint({ category: 0, series: 1 }, 'End', dims), { category: 2, series: 1 });
  assert.deepEqual(nextPoint({ category: 2, series: 1 }, 'ArrowRight', dims), { category: 2, series: 1 });
  assert.equal(nextPoint({ category: 1, series: 1 }, 'Escape', dims), null);
  assert.deepEqual(nextPoint({ category: 0, series: 0 }, 'ArrowUp', { categories: 4, series: 1, pie: true }), { category: 3, series: 0 });
  assert.deepEqual(nextPoint({ category: 3, series: 0 }, 'ArrowDown', { categories: 4, series: 1, pie: true }), { category: 0, series: 0 });
  assert.deepEqual(nextPoint({ category: 0, series: 0 }, 'ArrowLeft', { categories: 4, series: 1, pie: true }), { category: 3, series: 0 });
  assert.deepEqual(nextPoint({ category: 3, series: 0 }, 'ArrowRight', { categories: 4, series: 1, pie: true }), { category: 0, series: 0 });
  assert.deepEqual(nextPoint({ category: 0, series: 0 }, 'ArrowRight', { categories: 3, series: 1, pie: true, validPoints: [[true, false, true]] }), { category: 2, series: 0 });
  assert.equal(nextPoint({ category: 0, series: 0 }, 'Tab', dims), undefined);
});

test('series use non-hue cues and pie slices have theme-aware separators', () => {
  const manySeries = {
    labels: ['A', 'B'],
    series: Array.from({ length: 7 }, (_, index) => ({ name: `S${index + 1}`, values: [index + 1, index + 2] })),
  };
  const line = buildChart({ type: 'line', data: manySeries });
  const linePaths = nodes(line, 'path').filter((node) => attr(node, 'class') === 'mc-line');
  assert.equal(new Set(linePaths.map((node) => attr(node, 'stroke-dasharray'))).size, 7);
  const markers = nodes(line, 'g').filter((node) => attr(node, 'class') === 'mc-point' && attr(node, 'data-point-category') === 0).map((node) => node.children[0]);
  assert.equal(new Set(markers.map((node) => attr(node, 'data-marker'))).size, 7);

  const bars = buildChart({ type: 'bar', data: manySeries });
  const patterns = nodes(bars, 'pattern');
  assert.equal(patterns.length, 5);
  assert.equal(new Set(patterns.map((pattern) => attr(nodes(pattern, 'path')[0], 'd'))).size, 5);

  const pie = buildChart({ type: 'pie', data: { labels: ['A', 'B'], series: [{ values: [1, 2] }] } });
  assert.ok(nodes(pie, 'path').filter((node) => attr(node, 'class') === 'mc-pie-slice').every((node) => attr(node, 'stroke') === 'Canvas' && attr(node, 'stroke-width') === 2));
});

test('horizontal-bar draws grouped bars across values and categories down the axis', () => {
  const chart = buildChart({
    type: 'horizontal-bar',
    data: {
      labels: ['North', 'South'],
      series: [{ name: 'Revenue', values: [40, 80] }, { name: 'Costs', values: [20, 30] }],
    },
  });
  const bars = nodes(chart, 'rect').filter((node) => attr(node, 'class') === 'mc-bar');
  const north = nodes(chart, 'text').find((node) => text(node) === 'North');
  const south = nodes(chart, 'text').find((node) => text(node) === 'South');
  assert.equal(attr(chart, 'data-chart-type'), 'horizontal-bar');
  assert.equal(attr(chart, 'role'), 'group');
  assert.equal(bars.length, 4);
  assert.ok(Number(attr(bars[0], 'width')) > Number(attr(bars[0], 'height')));
  assert.ok(Number(attr(north, 'y')) < Number(attr(south, 'y')));
  assert.equal(attr(north, 'text-anchor'), 'end');
});

test('STYLE palette has three token fallbacks followed by five fixed colors', () => {
  assert.ok(Object.isFrozen(STYLE));
  assert.ok(Object.isFrozen(STYLE.palette));
  assert.equal(STYLE.palette.length, 8);
  assert.deepEqual(STYLE.palette.slice(0, 3).map(fallbackColor), ['#0072b2', '#d55e00', '#009e73']);
  assert.deepEqual(STYLE.palette.slice(3), ['#cc79a7', '#a06100', '#007f86', '#8c6d31', '#4c78a8']);
  const tokenNames = STYLE.palette.slice(0, 3).map((entry) => entry.match(/^var\((--[^,]+),/)?.[1]);
  assert.equal(new Set(tokenNames).size, 3);
  assert.deepEqual(tokenNames.map((name) => name?.split('-').at(-1)), ['primary', 'secondary', 'accent']);
});

test('series color overrides colors, colors cycle, and pie colors follow slice index', () => {
  const chart = buildChart({
    data: {
      labels: ['A'],
      series: [
        { name: 'Explicit', values: [1], color: 'var(--series-color, #123456)' },
        { name: 'First option', values: [2] },
        { name: 'Second option', values: [3] },
        { name: 'Cycles', values: [4] },
      ],
    },
    colors: ['#135724', '#246813'],
    type: 'line',
  });
  const lines = nodes(chart, 'path').filter((node) => attr(node, 'class') === 'mc-line');
  assert.deepEqual(lines.map((line) => attr(line, 'stroke')), ['var(--series-color, #123456)', '#246813', '#135724', '#246813']);

  const pie = buildChart({
    type: 'pie',
    data: { labels: ['A', 'B'], series: [{ values: [1, 2], color: '#abcdef' }] },
    colors: ['#135724', '#246813'],
  });
  assert.deepEqual(nodes(pie, 'path').filter((node) => attr(node, 'class') === 'mc-pie-slice').map((slice) => attr(slice, 'fill')), ['#135724', '#246813']);
});

test('legend label colors match their swatches for series and pie slices', () => {
  const chart = buildChart({ data: { labels: ['A'], series: [{ name: 'One', values: [1] }, { name: 'Two', values: [2] }] }, colors: ['#123456', '#654321'] });
  const seriesLegend = nodes(chart, 'g').filter((node) => attr(node, 'class') === 'mc-legend-item');
  assert.deepEqual(seriesLegend.map((item) => [attr(item.children[0], 'fill'), attr(item.children[1], 'fill')]), [['#123456', '#123456'], ['#654321', '#654321']]);

  const pie = buildChart({ type: 'pie', data: { labels: ['A', 'B'], series: [{ values: [1, 2] }] }, colors: ['#abcdef', '#fedcba'] });
  const pieLegend = nodes(pie, 'g').filter((node) => attr(node, 'class') === 'mc-legend-item');
  assert.deepEqual(pieLegend.map((item) => [attr(item.children[0], 'fill'), attr(item.children[1], 'fill')]), [['#abcdef', '#abcdef'], ['#fedcba', '#fedcba']]);
});

test('gridStyle controls non-baseline gridlines and leaves the zero baseline solid', () => {
  const data = { labels: ['A', 'B'], series: [{ values: [0, 10] }] };
  for (const [gridStyle, expected] of [['solid', 'none'], ['dashed', STYLE.grid.dash], ['unknown', 'none']]) {
    const chart = buildChart({ type: 'line', data, gridStyle });
    const lines = nodes(chart, 'line').filter((node) => String(attr(node, 'class')).includes('mc-gridline'));
    const baseline = lines.find((line) => String(attr(line, 'class')).includes('mc-baseline'));
    assert.ok(baseline, 'zero tick has a baseline marker');
    assert.equal(attr(baseline, 'stroke-dasharray'), 'none');
    assert.ok(lines.filter((line) => line !== baseline).every((line) => attr(line, 'stroke-dasharray') === expected));
  }
});

test('STYLE values drive SVG paint and fontSize remains an option', () => {
  const chart = buildChart({ type: 'line', data, fontSize: 17 });
  const line = nodes(chart, 'path').find((node) => attr(node, 'class') === 'mc-line');
  const marker = nodes(chart, 'circle').find((node) => attr(node, 'class') === 'mc-marker');
  assert.equal(attr(chart, 'font-family'), STYLE.fontFamily);
  assert.equal(attr(chart, 'font-size'), 17);
  assert.equal(attr(line, 'stroke-width'), STYLE.line.width);
  assert.equal(attr(marker, 'r'), STYLE.point.radius);
  assert.equal(attr(nodes(buildChart({ data }), 'rect').find((node) => attr(node, 'class') === 'mc-bar'), 'rx'), STYLE.bar.radius);
});

test('removed styling system is absent and token names are centralized', () => {
  const files = [
    'core.js', 'core.d.ts', 'MiniChart.tsx', 'mini-chart.js', 'mini-chart.d.ts',
    'scripts/assemble-demos.mjs', 'scripts/test-pack.mjs', 'test/core.test.js',
    'test/browser.test.js', 'test/types.test.tsx', 'README.md', 'ACCESSIBILITY.md',
    'demo.html', 'docs/index.html', 'page.jsx',
  ];
  const forbidden = ['--' + 'mc-', '--_' + 'mc-', 'chart' + 'Css', 'inject' + 'Styles'];
  const contents = new Map(files.map((file) => [file, readFileSync(resolve(import.meta.dirname, '..', file), 'utf8')]));
  for (const token of forbidden) {
    assert.ok([...contents.values()].every((content) => !content.includes(token)), `${token} must be absent`);
  }
  const marker = '--' + 'm-';
  const core = contents.get('core.js');
  const styleStart = core.indexOf('export const STYLE');
  const styleEnd = core.indexOf('\n});', styleStart);
  for (let index = core.indexOf(marker); index >= 0; index = core.indexOf(marker, index + marker.length)) {
    assert.ok(index >= styleStart && index < styleEnd, 'design tokens are defined only inside STYLE');
  }
  const onlyStyleOrDocs = new Set(['core.js', 'scripts/assemble-demos.mjs', 'README.md', 'demo.html', 'docs/index.html', 'page.jsx']);
  for (const [file, content] of contents) {
    if (!onlyStyleOrDocs.has(file)) assert.ok(!content.includes(marker), `${file} must not define design tokens`);
  }
});

test('every default series color meets 3:1 on light and dark backgrounds', () => {
  const fallbackColors = STYLE.palette.map(fallbackColor).filter(Boolean);
  assert.equal(fallbackColors.length, STYLE.palette.length);
  for (const color of fallbackColors) {
    assert.ok(contrast(color, '#FFFFFF') >= 3, `${color} on white`);
    assert.ok(contrast(color, '#14181B') >= 3, `${color} on dark`);
  }
});
