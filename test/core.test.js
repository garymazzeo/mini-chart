import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, buildChart, buildFigure, clampPoint, nextPoint, pointDimensions } from '../core.js';

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

test('every default series color meets 3:1 on light and dark backgrounds', () => {
  assert.ok(PALETTE.length >= 3);
  for (const color of PALETTE) {
    assert.ok(contrast(color, '#FFFFFF') >= 3, `${color} on white`);
    assert.ok(contrast(color, '#14181B') >= 3, `${color} on dark`);
  }
});
