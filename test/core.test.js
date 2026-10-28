import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, buildChart, buildFigure, chartCss, clampPoint, nextPoint, pointDimensions } from '../core.js';

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

test('buildFigure exposes every series value in semantic table cells', () => {
  const figure = buildFigure({ data, caption: 'Monthly results' });
  const table = nodes(figure, 'table')[0];
  const rows = nodes(table, 'tr');
  assert.equal(text(nodes(table, 'caption')[0]), 'Monthly results data');
  assert.deepEqual(cellText(rows[0]), ['Category', 'Revenue', 'Costs']);
  assert.deepEqual(cellText(rows[1]), ['Jan', '20', '6']);
  assert.deepEqual(cellText(rows[2]), ['Feb', '', '4']);
  assert.deepEqual(cellText(rows[3]), ['Mar', '90', '']);
  assert.match(attr(table, 'class'), /mc-table-hidden/);
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
  const lineGroups = nodes(line, 'g').filter((node) => attr(node, 'class')?.startsWith('mc-series mc-s'));
  assert.equal(new Set(lineGroups.map((node) => attr(node, 'style')?.['--_mc-series-dash'])).size, 7);
  const markers = nodes(line, 'g').filter((node) => attr(node, 'class') === 'mc-point' && attr(node, 'data-point-category') === 0).map((node) => node.children[0]);
  assert.equal(new Set(markers.map((node) => attr(node, 'data-marker'))).size, 7);

  const bars = buildChart({ type: 'bar', data: manySeries });
  const patterns = nodes(bars, 'pattern');
  assert.equal(patterns.length, 5);
  assert.equal(new Set(patterns.map((pattern) => attr(nodes(pattern, 'path')[0], 'd'))).size, 5);

  const pie = buildChart({ type: 'pie', data: { labels: ['A', 'B'], series: [{ values: [1, 2] }] } });
  assert.equal(nodes(pie, 'path').filter((node) => attr(node, 'class')?.split(' ').includes('mc-slice')).length, 2);
  assert.match(chartCss, /--_mc-surface: var\(--mc-surface, Canvas\)/);
  assert.match(chartCss, /--_mc-slice-gap: var\(--mc-slice-gap, 1\.5px\)/);
});

test('bar series retain generated hatch patterns through CSS custom properties', () => {
  const seriesData = {
    labels: ['A'],
    series: Array.from({ length: 4 }, (_, index) => ({ name: `S${index + 1}`, values: [index + 1] })),
  };
  for (const type of ['bar', 'horizontal-bar']) {
    const chart = buildChart({ type, data: seriesData, idPrefix: 'pattern-regression' });
    const groups = nodes(chart, 'g').filter((node) => attr(node, 'class')?.startsWith('mc-series mc-s'));
    const seriesWithPattern = groups[2];
    assert.equal(attr(seriesWithPattern, 'style')?.['--_mc-series-fill'], 'url(#pattern-regression-pattern-2)');
    assert.equal(attr(groups[3], 'style')?.['--_mc-series-fill'], 'url(#pattern-regression-pattern-3)');
    assert.ok(nodes(chart, 'pattern').some((pattern) => attr(pattern, 'id') === 'pattern-regression-pattern-2'));
  }
  assert.match(chartCss, /\.mc-bar \{ fill: var\(--_mc-series-fill, var\(--_mc-c\)\);/);
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

test('series classes wrap at eight and data colors are emitted as safe style objects', () => {
  const series = Array.from({ length: 10 }, (_, index) => ({
    name: `Series ${index + 1}`,
    values: [index + 1],
    ...(index === 0 ? { color: 'var(--brand)' } : {}),
  }));
  const chart = buildChart({
    data: { labels: ['A'], series },
    colors: ['var(--option-one)', 'var(--option-two)'],
    idPrefix: 'colors',
  });
  const groups = nodes(chart, 'g').filter((node) => attr(node, 'class')?.startsWith('mc-series '));
  assert.equal(groups.length, 10);
  assert.deepEqual(groups.slice(0, 10).map((node) => attr(node, 'class').split(' ')[1]), [
    'mc-s0', 'mc-s1', 'mc-s2', 'mc-s3', 'mc-s4', 'mc-s5', 'mc-s6', 'mc-s7', 'mc-s0', 'mc-s1',
  ]);
  assert.deepEqual(attr(groups[0], 'style'), { '--_mc-data-color': 'var(--brand)' });
  assert.deepEqual(attr(groups[1], 'style'), { '--_mc-data-color': 'var(--option-two)' });
  assert.equal(attr(groups[2], 'style')['--_mc-data-color'], 'var(--option-one)');
  assert.equal(attr(groups[2], 'style')['--_mc-series-fill'], 'url(#colors-pattern-2)');
  for (const node of walk(chart)) {
    for (const key of ['fill', 'stroke', 'color']) assert.ok(attr(node, key) === undefined || attr(node, key) === 'none');
    assert.ok(attr(node, 'style') === undefined || typeof attr(node, 'style') === 'object');
  }
});

test('chartCss is the sole default source for all public style properties', () => {
  const properties = [
    ...Array.from({ length: 8 }, (_, index) => `--mc-color-${index + 1}`),
    '--mc-text-color', '--mc-axis-text-color', '--mc-font-family', '--mc-grid-color', '--mc-grid-opacity',
    '--mc-grid-width', '--mc-grid-dash', '--mc-baseline-color', '--mc-baseline-width', '--mc-baseline-dash',
    '--mc-line-width', '--mc-point-radius', '--mc-bar-radius', '--mc-surface', '--mc-slice-gap',
    '--mc-focus-color', '--mc-focus-width', '--mc-tooltip-bg', '--mc-tooltip-color', '--mc-tooltip-border',
    '--mc-inactive-opacity',
  ];
  for (const property of properties) {
    assert.equal(chartCss.match(new RegExp(`var\\(${property},`, 'g'))?.length ?? 0, 1, `${property} has one CSS fallback`);
  }
  assert.equal(PALETTE.length, 8);
  assert.deepEqual(PALETTE.slice(0, 7), ['#0072b2', '#d55e00', '#009e73', '#cc79a7', '#a06100', '#007f86', '#8c6d31']);
  assert.ok(chartCss.includes('.mc-chart .mc-grid'));
  const chart = buildChart({ data, colors: ['var(--theme-a)'] });
  for (const node of walk(chart)) {
    for (const key of ['fill', 'stroke', 'color']) assert.ok(attr(node, key) === undefined || attr(node, key) === 'none');
    assert.ok(attr(node, 'style') === undefined || typeof attr(node, 'style') === 'object');
  }
});

test('fontSize is an explicit JS layout option', () => {
  const chart = buildChart({ data, fontSize: 18 });
  assert.equal(attr(chart, 'font-size'), 18);
});

test('every default series color meets 3:1 on light and dark backgrounds', () => {
  assert.ok(PALETTE.length >= 3);
  for (const color of PALETTE) {
    assert.ok(contrast(color, '#FFFFFF') >= 3, `${color} on white`);
    assert.ok(contrast(color, '#14181B') >= 3, `${color} on dark`);
  }
});
