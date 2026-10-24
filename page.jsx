'use client';
import { createElement, useMemo, useState } from 'react';

// core.js — framework-agnostic. No DOM, no React.
// buildChart() returns a plain tree: { tag, attrs, children }. Children may be strings (text).

const PALETTE = ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1'];

const h = (tag, attrs = {}, ...children) => ({ tag, attrs, children: children.flat().filter((c) => c != null) });
const r = (n) => +n.toFixed(2);
const linear = (d0, d1, r0, r1) => (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

// Pick "nice" axis ticks: step is 1, 2, or 5 times a power of ten.
function niceTicks(min, max, count = 5) {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}

function legend(entries, width, height) {
  const w = 100;
  const x0 = Math.max(8, (width - entries.length * w) / 2);
  return entries.map((e, i) =>
    h('g', { transform: `translate(${r(x0 + i * w)} ${height - 14})` },
      h('rect', { width: 10, height: 10, y: -9, rx: 2, fill: e.color }),
      h('text', { x: 15, fill: 'currentColor' }, String(e.name))));
}

function axisChart(type, { labels, series, width, height, color }) {
  const showLegend = series.length > 1;
  const m = { top: 16, right: 16, bottom: showLegend ? 56 : 34, left: 48 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;

  const all = series.flatMap((s) => s.values).filter(Number.isFinite);
  let lo = all.length ? Math.min(...all) : 0;
  let hi = all.length ? Math.max(...all) : 1;
  if (type === 'bar') { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  const ticks = niceTicks(lo, hi);
  const y = linear(ticks[0], ticks[ticks.length - 1], m.top + ih, m.top);
  const band = iw / labels.length;
  const cx = (i) => m.left + band * (i + 0.5);

  const out = [];
  for (const t of ticks) {
    out.push(
      h('line', { x1: m.left, x2: m.left + iw, y1: r(y(t)), y2: r(y(t)), stroke: 'currentColor', 'stroke-opacity': 0.15 }),
      h('text', { x: m.left - 8, y: r(y(t)), 'text-anchor': 'end', 'dominant-baseline': 'middle', fill: 'currentColor', 'fill-opacity': 0.7 }, String(t)));
  }
  labels.forEach((l, i) =>
    out.push(h('text', { x: r(cx(i)), y: m.top + ih + 18, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.7 }, String(l))));

  series.forEach((s, si) => {
    const c = color(si);
    if (type === 'bar') {
      const bw = (band * 0.8) / series.length;
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        const x = cx(i) - band * 0.4 + si * bw;
        const top = Math.min(y(v), y(0));
        out.push(h('rect', { x: r(x), y: r(top), width: r(Math.max(bw - 1, 1)), height: r(Math.abs(y(v) - y(0))), fill: c },
          h('title', {}, `${s.name ?? ''} ${labels[i]}: ${v}`.trim())));
      });
    } else {
      let d = '', pen = false;
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${r(cx(i))} ${r(y(v))}`;
        pen = true;
      });
      out.push(h('path', { d, fill: 'none', stroke: c, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
      s.values.forEach((v, i) => {
        if (!Number.isFinite(v)) return;
        out.push(h('circle', { cx: r(cx(i)), cy: r(y(v)), r: 3.5, fill: c },
          h('title', {}, `${s.name ?? ''} ${labels[i]}: ${v}`.trim())));
      });
    }
  });

  if (showLegend) out.push(...legend(series.map((s, i) => ({ name: s.name ?? `Series ${i + 1}`, color: color(i) })), width, height));
  return out;
}

function pieChart({ labels, series, width, height, color }) {
  const vals = series[0].values.map((v) => Math.max(0, Number(v) || 0));
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const legendH = 28;
  const cx = width / 2, cy = (height - legendH) / 2;
  const rad = Math.min(width, height - legendH) / 2 - 8;
  const pt = (a) => [r(cx + rad * Math.cos(a)), r(cy + rad * Math.sin(a))];

  let a = -Math.PI / 2;
  const out = vals.map((v, i) => {
    if (!v) return null;
    const tip = h('title', {}, `${labels[i]}: ${v} (${((v / total) * 100).toFixed(1)}%)`);
    if (v === total) return h('circle', { cx, cy, r: rad, fill: color(i) }, tip);
    const sweep = (v / total) * 2 * Math.PI;
    const [x0, y0] = pt(a), [x1, y1] = pt(a + sweep);
    a += sweep;
    const d = `M${cx} ${cy}L${x0} ${y0}A${rad} ${rad} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z`;
    return h('path', { d, fill: color(i) }, tip);
  });
  out.push(...legend(labels.map((l, i) => ({ name: l, color: color(i) })), width, height));
  return out;
}

/**
 * @param {{ type?: 'bar'|'line'|'pie', data: { labels: string[], series: {name?: string, values: number[], color?: string}[] },
 *           width?: number, height?: number, colors?: string[] }} opts
 */
function buildChart({ type = 'bar', data, width = 480, height = 300, colors = PALETTE } = {}) {
  const labels = data?.labels ?? [];
  const series = data?.series ?? [];
  const svg = (kids, label = `${type} chart`) =>
    h('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', role: 'img', 'aria-label': label,
      'font-family': 'system-ui, sans-serif', 'font-size': 12 }, kids);

  const empty = () => svg(h('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': 0.6 }, 'No data'));
  if (!labels.length || !series.length) return empty();

  const color = type === 'pie'
    ? (i) => colors[i % colors.length]
    : (i) => series[i].color ?? colors[i % colors.length];
  const ctx = { labels, series, width, height, color };

  const kids = type === 'pie' ? pieChart(ctx) : axisChart(type, ctx);
  return kids ? svg(kids) : empty();
}
// Chart.jsx — React wrapper. Converts the core's tree into React elements.

// 'stroke-width' -> 'strokeWidth' (aria-* and data-* stay as they are)
const camel = (k) => (/^(aria|data)-/.test(k) ? k : k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()));

function toReact(node, key) {
  if (typeof node === 'string') return node;
  const props = key === undefined ? {} : { key };
  for (const [k, v] of Object.entries(node.attrs)) props[camel(k)] = v;
  return createElement(node.tag, props, node.children.map((c, i) => toReact(c, i)));
}

function Chart({ type, data, width, height, colors }) {
  // Rebuild only when inputs change. Pass a stable `data` reference (or memoize it) to benefit.
  const tree = useMemo(
    () => buildChart({ type, data, width, height, colors }),
    [type, data, width, height, colors]
  );
  return toReact(tree);
}

// Usage:
// <Chart type="line" data={{ labels: ['Jan','Feb','Mar'], series: [{ name: 'Sales', values: [3, 7, 5] }] }} />

// ---- demo page ----
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const rnd = (lo, hi) => Math.round(lo + Math.random() * (hi - lo));
const initial = {
  labels: months,
  series: [
    { name: 'Visitors', values: [62, 70, 55, 84, 91, 78] },
    { name: 'Signups', values: [12, 18, 14, 30, 35, 27] },
  ],
};
const randomData = () => ({
  labels: months,
  series: [
    { name: 'Visitors', values: months.map(() => rnd(40, 100)) },
    { name: 'Signups', values: months.map(() => rnd(5, 45)) },
  ],
});

export default function Page() {
  const [type, setType] = useState('bar');
  const [data, setData] = useState(initial); // fixed start value avoids a hydration mismatch

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>mini-chart in React</h1>
      <div style={{ display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }}>
        {['bar', 'line', 'pie'].map((t) => (
          <button key={t} aria-pressed={type === t} onClick={() => setType(t)}
            style={{ padding: '6px 14px', fontWeight: type === t ? 700 : 400 }}>{t}</button>
        ))}
        <button onClick={() => setData(randomData())} style={{ padding: '6px 14px' }}>Randomize</button>
      </div>
      <Chart type={type} data={data} />
      {type === 'pie' && <p style={{ opacity: 0.7 }}>Pie charts use the first series only.</p>}
    </main>
  );
}
