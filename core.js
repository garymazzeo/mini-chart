// core.js — framework-agnostic. No DOM, no React.
// buildChart() returns an SVG tree; buildFigure() wraps it with HTML alternatives.

// Verified contrast against #fff / #14181b respectively: 5.185/3.443, 3.867/4.617,
// 3.421/5.219, 3.061/5.833, 4.995/3.575, 4.795/3.724, 4.831/3.696.
export const PALETTE = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#A06100', '#007F86', '#8C6D31'];

const MARKERS = ['circle', 'square', 'triangle', 'diamond', 'cross', 'plus', 'hexagon'];
const DASHES = ['', '6 3', '2 2', '8 2 2 2', '1 3', '5 2 1 2', '3 2'];
const HATCHES = ['M-2 8L8 -2M2 10L10 2', 'M-2 -2L8 8M2 -2L10 6', 'M2 0V8M6 0V8', 'M0 2H8M0 6H8', 'M0 0L8 8M0 8L8 0'];
const TABLE_HIDDEN_STYLE = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
let generatedId = 0;

const h = (tag, attrs = {}, ...children) => ({ tag, attrs, children: children.flat().filter((child) => child != null) });
const r = (number) => +number.toFixed(2);
const linear = (d0, d1, r0, r1) => (value) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0));
const safeId = (prefix) => String(prefix).replace(/[^A-Za-z0-9_.:-]/g, '-');
const format = (value) => Number.isFinite(value) ? String(value) : '';

function normalizeOptions(options = {}) {
  const type = options.type ?? 'bar';
  const table = options.table ?? 'hidden';
  if (!['bar', 'horizontal-bar', 'line', 'pie'].includes(type)) throw new TypeError(`Unknown chart type: ${type}`);
  if (!['hidden', 'visible', 'none'].includes(table)) throw new TypeError(`Unknown table mode: ${table}`);
  if (table === 'none' && !String(options.description ?? '').trim()) {
    throw new TypeError('A description is required when table is "none".');
  }
  return {
    ...options,
    type,
    table,
    data: options.data ?? { labels: [], series: [] },
    width: Number(options.width) > 0 ? Number(options.width) : 480,
    height: Math.max(160, Number(options.height) || 300),
    colors: options.colors?.length ? options.colors : PALETTE,
    interactive: options.interactive !== false,
    idPrefix: safeId(options.idPrefix || `mini-chart-${++generatedId}`),
  };
}

function titleFor(type, series) {
  const names = series.map((item, index) => item.name || `Series ${index + 1}`);
  const label = type === 'pie' ? 'Pie' : type === 'line' ? 'Line' : type === 'horizontal-bar' ? 'Horizontal bar' : 'Bar';
  return `${label} chart${names.length ? ` of ${names.join(', ')}` : ''}`;
}

function descriptionFor(type, data, explicit) {
  if (String(explicit ?? '').trim()) return String(explicit).trim();
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  if (!labels.length || !series.length) return 'No data is available for this chart.';
  const parts = [`${series.length} ${series.length === 1 ? 'series' : 'series'}`, `${labels.length} ${labels.length === 1 ? 'category' : 'categories'}`];
  const summaries = series.map((item, index) => {
    const values = (item.values ?? []).filter(Number.isFinite);
    if (!values.length) return '';
    const name = item.name || `Series ${index + 1}`;
    return `${name} ranges from ${Math.min(...values)} to ${Math.max(...values)}`;
  }).filter(Boolean);
  return `${parts.join(', ')}.${summaries.length ? ` ${summaries.join('. ')}.` : ''}`;
}

function niceTicks(min, max, count = 5) {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const factor = raw / pow;
  const step = (factor < 1.5 ? 1 : factor < 3 ? 2 : factor < 7 ? 5 : 10) * pow;
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = low; value <= high + step / 2; value += step) ticks.push(+value.toFixed(10));
  return ticks;
}

function markerShape(shape, x, y, size, fill, attrs = {}) {
  if (shape === 'square') return h('rect', { x: r(x - size), y: r(y - size), width: 2 * size, height: 2 * size, fill, ...attrs });
  if (shape === 'triangle') return h('path', { d: `M${r(x)} ${r(y - size)}L${r(x + size)} ${r(y + size)}L${r(x - size)} ${r(y + size)}Z`, fill, ...attrs });
  if (shape === 'diamond') return h('path', { d: `M${r(x)} ${r(y - size)}L${r(x + size)} ${r(y)}L${r(x)} ${r(y + size)}L${r(x - size)} ${r(y)}Z`, fill, ...attrs });
  if (shape === 'cross') return h('path', { d: `M${r(x - size)} ${r(y - size / 2)}H${r(x - size / 2)}V${r(y - size)}H${r(x + size / 2)}V${r(y - size / 2)}H${r(x + size)}V${r(y + size / 2)}H${r(x + size / 2)}V${r(y + size)}H${r(x - size / 2)}V${r(y + size / 2)}H${r(x - size)}Z`, fill, ...attrs });
  if (shape === 'plus') return h('path', { d: `M${r(x - size / 3)} ${r(y - size)}H${r(x + size / 3)}V${r(y - size / 3)}H${r(x + size)}V${r(y + size / 3)}H${r(x + size / 3)}V${r(y + size)}H${r(x - size / 3)}V${r(y + size / 3)}H${r(x - size)}V${r(y - size / 3)}H${r(x - size / 3)}Z`, fill, ...attrs });
  if (shape === 'hexagon') return h('path', { d: `M${r(x - size)} ${r(y)}L${r(x - size / 2)} ${r(y - size)}H${r(x + size / 2)}L${r(x + size)} ${r(y)}L${r(x + size / 2)} ${r(y + size)}H${r(x - size / 2)}Z`, fill, ...attrs });
  return h('circle', { cx: r(x), cy: r(y), r: size, fill, ...attrs });
}

function focusRing(x, y, size = 8) {
  return [
    h('circle', { cx: r(x), cy: r(y), r: size + 2, fill: 'none', stroke: '#fff', 'stroke-width': 6, class: 'mc-focus-light', 'aria-hidden': 'true' }),
    h('circle', { cx: r(x), cy: r(y), r: size + 2, fill: 'none', stroke: '#000', 'stroke-width': 2.5, class: 'mc-focus-dark', 'aria-hidden': 'true' }),
  ];
}

function legend(entries, width, startY) {
  if (!entries.length) return { nodes: [], rows: 0 };
  const columns = Math.max(1, Math.floor((width - 20) / 132));
  const cellWidth = (width - 20) / columns;
  const rows = Math.ceil(entries.length / columns);
  const nodes = entries.map((entry, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = 10 + column * cellWidth;
    const y = startY + row * 18;
    return h('g', { transform: `translate(${r(x)} ${r(y)})`, class: 'mc-legend-item' },
      markerShape(entry.marker ?? 'square', 5, -4, 4, entry.color, { 'aria-hidden': 'true' }),
      h('text', { x: 13, y: 0, fill: 'currentColor', class: 'mc-legend-label' }, String(entry.name)));
  });
  return { nodes, rows };
}

function patternDefs(idPrefix, series, color) {
  const patterns = series.map((item, index) => {
    if (index < 2) return null;
    const patternId = `${idPrefix}-pattern-${index}`;
    const hatch = HATCHES[(index - 2) % HATCHES.length];
    return h('pattern', { id: patternId, width: 8, height: 8, patternUnits: 'userSpaceOnUse' },
      h('rect', { width: 8, height: 8, fill: color(index), class: 'mc-pattern-background' }),
      h('path', { d: hatch, stroke: 'Canvas', 'stroke-width': 2, class: 'mc-pattern-line' }));
  });
  return h('defs', {}, patterns);
}

function axisChart(options, color, titleId, descId) {
  const { type, data, width, height, idPrefix, interactive, activePoint } = options;
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  const hasLegend = series.length > 1;
  const columns = Math.max(1, Math.floor((width - 20) / 132));
  const legendRows = hasLegend ? Math.ceil(series.length / columns) : 0;
  const margins = { top: 24, right: 12, bottom: 32 + legendRows * 18, left: 46 };
  const innerWidth = Math.max(1, width - margins.left - margins.right);
  const innerHeight = Math.max(1, height - margins.top - margins.bottom);
  const allValues = series.flatMap((item) => item.values ?? []).filter(Number.isFinite);
  let low = allValues.length ? Math.min(...allValues) : 0;
  let high = allValues.length ? Math.max(...allValues) : 1;
  if (type === 'bar') { low = Math.min(low, 0); high = Math.max(high, 0); }
  const ticks = niceTicks(low, high);
  const y = linear(ticks[0], ticks[ticks.length - 1], margins.top + innerHeight, margins.top);
  const band = innerWidth / Math.max(1, labels.length);
  const centerX = (index) => margins.left + band * (index + 0.5);
  const colorAt = (index) => series[index]?.color ?? color(index);
  const out = [patternDefs(idPrefix, series, colorAt)];

  for (const tick of ticks) {
    out.push(
      h('line', { x1: margins.left, x2: margins.left + innerWidth, y1: r(y(tick)), y2: r(y(tick)), stroke: 'currentColor', 'stroke-opacity': 0.22, class: 'mc-gridline', 'aria-hidden': 'true' }),
      h('text', { x: margins.left - 8, y: r(y(tick)), 'text-anchor': 'end', 'dominant-baseline': 'middle', fill: 'currentColor', class: 'mc-axis-label' }, String(tick)));
  }

  const widestLabel = labels.reduce((widest, label) => Math.max(widest, String(label).length * 7.2), 0);
  const labelStep = Math.max(1, Math.ceil(widestLabel / Math.max(1, band - 10)));
  labels.forEach((label, index) => {
    if (index % labelStep !== 0) return;
    out.push(h('text', { x: r(centerX(index)), y: margins.top + innerHeight + 18, 'text-anchor': 'middle', fill: 'currentColor', class: 'mc-axis-label' }, String(label)));
  });

  const pointPositions = new Map();
  series.forEach((item, seriesIndex) => {
    const seriesColor = colorAt(seriesIndex);
    if (type === 'bar') {
      const barWidth = (band * 0.8) / Math.max(1, series.length);
      (item.values ?? []).forEach((value, categoryIndex) => {
        if (!Number.isFinite(value) || categoryIndex >= labels.length) return;
        const x = centerX(categoryIndex) - band * 0.4 + seriesIndex * barWidth;
        const top = Math.min(y(value), y(0));
        const barHeight = Math.max(1, Math.abs(y(value) - y(0)));
        const px = x + Math.max(barWidth - 1, 1) / 2;
        const py = y(value);
        const active = activePoint?.series === seriesIndex && activePoint?.category === categoryIndex;
        pointPositions.set(`${seriesIndex}:${categoryIndex}`, { x: px, y: py, size: 8, text: `${item.name || `Series ${seriesIndex + 1}`}, ${labels[categoryIndex]}: ${value}` });
        const bar = h('rect', { x: r(x), y: r(top), width: r(Math.max(barWidth - 1, 1)), height: r(barHeight), fill: seriesIndex > 1 ? `url(#${idPrefix}-pattern-${seriesIndex})` : seriesColor, class: 'mc-bar' });
        const ring = active ? [
          h('rect', { x: r(x - 3), y: r(top - 3), width: r(Math.max(barWidth - 1, 1) + 6), height: r(barHeight + 6), fill: 'none', stroke: '#fff', 'stroke-width': 6, class: 'mc-focus-light', 'aria-hidden': 'true' }),
          h('rect', { x: r(x - 3), y: r(top - 3), width: r(Math.max(barWidth - 1, 1) + 6), height: r(barHeight + 6), fill: 'none', stroke: '#000', 'stroke-width': 2.5, class: 'mc-focus-dark', 'aria-hidden': 'true' }),
        ] : [];
        out.push(h('g', { 'data-point-category': categoryIndex, 'data-point-series': seriesIndex, class: 'mc-point', 'aria-hidden': 'true' }, bar, ring));
      });
    } else {
      let path = '';
      let pen = false;
      (item.values ?? []).forEach((value, categoryIndex) => {
        if (!Number.isFinite(value) || categoryIndex >= labels.length) { pen = false; return; }
        path += `${pen ? 'L' : 'M'}${r(centerX(categoryIndex))} ${r(y(value))}`;
        pen = true;
      });
      out.push(h('path', { d: path, fill: 'none', stroke: seriesColor, 'stroke-width': 2.5, 'stroke-dasharray': DASHES[seriesIndex % DASHES.length], 'stroke-linejoin': 'round', class: 'mc-line', 'aria-hidden': 'true' }));
      (item.values ?? []).forEach((value, categoryIndex) => {
        if (!Number.isFinite(value) || categoryIndex >= labels.length) return;
        const x = centerX(categoryIndex), py = y(value);
        const active = activePoint?.series === seriesIndex && activePoint?.category === categoryIndex;
        pointPositions.set(`${seriesIndex}:${categoryIndex}`, { x, y: py, size: 8, text: `${item.name || `Series ${seriesIndex + 1}`}, ${labels[categoryIndex]}: ${value}` });
        const marker = markerShape(MARKERS[seriesIndex % MARKERS.length], x, py, active ? 5 : 4, seriesColor, { 'data-marker': MARKERS[seriesIndex % MARKERS.length], stroke: 'Canvas', 'stroke-width': 1, class: 'mc-marker' });
        out.push(h('g', { 'data-point-category': categoryIndex, 'data-point-series': seriesIndex, class: 'mc-point', 'aria-hidden': 'true' }, marker, active ? focusRing(x, py, 6) : []));
      });
    }
  });

  if (hasLegend) {
    const entries = series.map((item, index) => ({ name: item.name ?? `Series ${index + 1}`, color: colorAt(index), marker: MARKERS[index % MARKERS.length] }));
    out.push(...legend(entries, width, height - legendRows * 18 + 4).nodes);
  }

  const active = activePoint && pointPositions.get(`${activePoint.series}:${activePoint.category}`);
  if (interactive && active) out.push(tooltip(active, width, height));
  return out;
}

function horizontalBarChart(options, color) {
  const { data, width, height, idPrefix, activePoint, interactive } = options;
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  const hasLegend = series.length > 1;
  const columns = Math.max(1, Math.floor((width - 20) / 132));
  const legendRows = hasLegend ? Math.ceil(series.length / columns) : 0;
  const longestLabel = labels.reduce((widest, label) => Math.max(widest, String(label).length * 7.2), 0);
  const margins = {
    top: 24,
    right: 12,
    bottom: 32 + legendRows * 18,
    left: Math.min(width * 0.48, Math.max(56, longestLabel + 16)),
  };
  const innerWidth = Math.max(1, width - margins.left - margins.right);
  const innerHeight = Math.max(1, height - margins.top - margins.bottom);
  const values = series.flatMap((item) => item.values ?? []).filter(Number.isFinite);
  const low = Math.min(0, ...(values.length ? values : [0]));
  const high = Math.max(0, ...(values.length ? values : [1]));
  const ticks = niceTicks(low, high);
  const x = linear(ticks[0], ticks[ticks.length - 1], margins.left, margins.left + innerWidth);
  const band = innerHeight / Math.max(1, labels.length);
  const centerY = (index) => margins.top + band * (index + 0.5);
  const colorAt = (index) => series[index]?.color ?? color(index);
  const out = [patternDefs(idPrefix, series, colorAt)];

  for (const tick of ticks) {
    out.push(
      h('line', { x1: r(x(tick)), x2: r(x(tick)), y1: margins.top, y2: margins.top + innerHeight, stroke: 'currentColor', 'stroke-opacity': 0.22, class: 'mc-gridline', 'aria-hidden': 'true' }),
      h('text', { x: r(x(tick)), y: margins.top + innerHeight + 18, 'text-anchor': 'middle', fill: 'currentColor', class: 'mc-axis-label' }, String(tick)));
  }

  const labelStep = Math.max(1, Math.ceil(22 / Math.max(1, band)));
  labels.forEach((label, index) => {
    if (index % labelStep !== 0) return;
    out.push(h('text', { x: margins.left - 8, y: r(centerY(index)), 'text-anchor': 'end', 'dominant-baseline': 'middle', fill: 'currentColor', class: 'mc-axis-label' }, String(label)));
  });

  const pointPositions = new Map();
  series.forEach((item, seriesIndex) => {
    const seriesColor = colorAt(seriesIndex);
    const barHeight = Math.max(1, (band * 0.8) / Math.max(1, series.length));
    (item.values ?? []).forEach((value, categoryIndex) => {
      if (!Number.isFinite(value) || categoryIndex >= labels.length) return;
      const y = centerY(categoryIndex) - band * 0.4 + seriesIndex * barHeight;
      const zeroX = x(0);
      const valueX = x(value);
      const barX = Math.min(zeroX, valueX);
      const barWidth = Math.max(1, Math.abs(valueX - zeroX));
      const active = activePoint?.series === seriesIndex && activePoint?.category === categoryIndex;
      pointPositions.set(`${seriesIndex}:${categoryIndex}`, {
        x: valueX,
        y: y + barHeight / 2,
        size: 8,
        text: `${item.name || `Series ${seriesIndex + 1}`}, ${labels[categoryIndex]}: ${value}`,
      });
      const bar = h('rect', {
        x: r(barX), y: r(y), width: r(barWidth), height: r(Math.max(barHeight - 1, 1)),
        fill: seriesIndex > 1 ? `url(#${idPrefix}-pattern-${seriesIndex})` : seriesColor,
        class: 'mc-bar',
      });
      const ring = active ? [
        h('rect', { x: r(barX - 3), y: r(y - 3), width: r(barWidth + 6), height: r(barHeight + 5), fill: 'none', stroke: '#fff', 'stroke-width': 6, class: 'mc-focus-light', 'aria-hidden': 'true' }),
        h('rect', { x: r(barX - 3), y: r(y - 3), width: r(barWidth + 6), height: r(barHeight + 5), fill: 'none', stroke: '#000', 'stroke-width': 2.5, class: 'mc-focus-dark', 'aria-hidden': 'true' }),
      ] : [];
      out.push(h('g', { 'data-point-category': categoryIndex, 'data-point-series': seriesIndex, class: 'mc-point', 'aria-hidden': 'true' }, bar, ring));
    });
  });

  if (hasLegend) {
    const entries = series.map((item, index) => ({ name: item.name ?? `Series ${index + 1}`, color: colorAt(index), marker: MARKERS[index % MARKERS.length] }));
    out.push(...legend(entries, width, height - legendRows * 18 + 4).nodes);
  }

  const active = activePoint && pointPositions.get(`${activePoint.series}:${activePoint.category}`);
  if (interactive && active) out.push(tooltip(active, width, height));
  return out;
}

function pieChart(options, color) {
  const { data, width, height, idPrefix, activePoint, interactive } = options;
  const labels = data.labels ?? [];
  const values = (data.series?.[0]?.values ?? []).map((value) => Number.isFinite(value) ? Math.max(0, value) : 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return null;
  const columns = Math.max(1, Math.floor((width - 20) / 132));
  const legendRows = Math.ceil(labels.length / columns);
  const legendHeight = 12 + legendRows * 18;
  const cx = width / 2;
  const cy = (height - legendHeight) / 2;
  const radius = Math.max(20, Math.min(width, height - legendHeight) / 2 - 12);
  const point = (angle) => [r(cx + radius * Math.cos(angle)), r(cy + radius * Math.sin(angle))];
  const out = [];
  const positions = new Map();
  let angle = -Math.PI / 2;
  const totalNonzero = values.filter((value) => value > 0).length;

  values.forEach((value, index) => {
    if (!value) return;
    const sweep = (value / total) * Math.PI * 2;
    const midpoint = angle + sweep / 2;
    const [x, y] = point(midpoint);
    const [x0, y0] = point(angle);
    const [x1, y1] = point(angle + sweep);
    const active = activePoint?.category === index;
    const title = labels[index];
    const percentage = `${(value / total * 100).toFixed(1).replace(/\.0$/, '')}%`;
    const description = `${title}: ${format(value)}, ${percentage}`;
    positions.set(`0:${index}`, { x, y, size: 8, text: description });
    const slice = totalNonzero === 1
      ? h('circle', { cx, cy, r: radius, fill: color(index), stroke: 'Canvas', 'stroke-width': 2, class: 'mc-pie-slice' })
      : h('path', { d: `M${cx} ${cy}L${x0} ${y0}A${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z`, fill: color(index), stroke: 'Canvas', 'stroke-width': 2, class: 'mc-pie-slice' });
    const ring = active ? (totalNonzero === 1
      ? [h('circle', { cx, cy, r: radius + 3, fill: 'none', stroke: '#fff', 'stroke-width': 6, class: 'mc-focus-light', 'aria-hidden': 'true' }), h('circle', { cx, cy, r: radius + 3, fill: 'none', stroke: '#000', 'stroke-width': 2.5, class: 'mc-focus-dark', 'aria-hidden': 'true' })]
      : [h('path', { d: `M${cx} ${cy}L${x0} ${y0}A${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z`, fill: 'none', stroke: '#fff', 'stroke-width': 6, class: 'mc-focus-light', 'aria-hidden': 'true' }), h('path', { d: `M${cx} ${cy}L${x0} ${y0}A${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x1} ${y1}Z`, fill: 'none', stroke: '#000', 'stroke-width': 2.5, class: 'mc-focus-dark', 'aria-hidden': 'true' })]) : [];
    out.push(h('g', { 'data-point-category': index, 'data-point-series': 0, class: 'mc-point', 'aria-hidden': 'true' }, slice, ring));
    angle += sweep;
  });

  const entries = labels.map((name, index) => ({ name, color: color(index), marker: MARKERS[index % MARKERS.length] }));
  out.push(...legend(entries, width, height - legendRows * 18 + 4).nodes);
  const active = activePoint && positions.get(`0:${activePoint.category}`);
  if (interactive && active) out.push(tooltip(active, width, height));
  return out;
}

function tooltip(active, width, height) {
  const text = active.text;
  const tooltipWidth = Math.min(width - 8, Math.max(110, text.length * 7.1 + 18));
  const x = Math.min(Math.max(4, active.x - tooltipWidth / 2), width - tooltipWidth - 4);
  const y = Math.min(Math.max(22, active.y - 14), height - 8);
  return h('g', { role: 'tooltip', class: 'mc-tooltip', 'aria-hidden': 'true' },
    h('rect', { x: r(x), y: r(y - 20), width: r(tooltipWidth), height: 24, rx: 4, fill: 'CanvasText', stroke: 'Canvas', 'stroke-width': 1 }),
    h('text', { x: r(x + 9), y: r(y - 4), fill: 'Canvas', 'font-size': 12 }, text));
}

function svgStyle() {
  return h('style', {}, '.mc-gridline{vector-effect:non-scaling-stroke}.mc-focus-light,.mc-focus-dark,.mc-svg-focus-light,.mc-svg-focus-dark{vector-effect:non-scaling-stroke;pointer-events:none}.mc-svg-focus-light,.mc-svg-focus-dark{opacity:0}svg:focus-visible>.mc-svg-focus-light,svg:focus-visible>.mc-svg-focus-dark{opacity:1}.mc-point{cursor:pointer}.mc-tooltip{pointer-events:auto}.mc-axis-label,.mc-legend-label{font-size:12px}@media(forced-colors:active){.mc-gridline{stroke:CanvasText!important;stroke-opacity:.5!important}.mc-axis-label,.mc-legend-label{fill:CanvasText!important;opacity:1!important}.mc-focus-light,.mc-svg-focus-light{stroke:Canvas!important}.mc-focus-dark,.mc-svg-focus-dark{stroke:Highlight!important}.mc-pie-slice{stroke:Canvas!important}.mc-pattern-background{fill:Canvas!important;stroke:CanvasText!important}.mc-pattern-line{stroke:CanvasText!important}.mc-tooltip rect{fill:Canvas!important;stroke:CanvasText!important}.mc-tooltip text{fill:CanvasText!important}}');
}

function emptySvg(options, titleId, descId, description) {
  const { type, width, height } = options;
  return h('svg', {
    viewBox: `0 0 ${width} ${height}`, width: '100%', height,
    role: 'img', 'aria-labelledby': titleId, 'aria-describedby': descId,
    'font-family': 'system-ui, sans-serif', 'font-size': 12,
    'data-chart-type': type, 'data-category-count': 0, 'data-series-count': 0,
    'data-interactive': 'false',
    tabindex: undefined,
  },
    svgStyle(),
    h('title', { id: titleId }, 'No data'),
    h('desc', { id: descId }, description),
    h('text', { x: width / 2, y: height / 2, 'text-anchor': 'middle', fill: 'currentColor', class: 'mc-axis-label', role: 'status' }, 'No data'));
}

function buildSvg(options) {
  const { type, data, width, height, colors, idPrefix, caption, interactive, activePoint } = options;
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  const titleId = `${idPrefix}-title`;
  const descId = `${idPrefix}-description`;
  const title = caption || titleFor(type, series);
  const description = descriptionFor(type, data, options.description);
  const color = (index) => colors[index % colors.length];
  const hasData = labels.length > 0 && series.length > 0;
  const pieTotal = (series[0]?.values ?? []).reduce((sum, value) => sum + (Number.isFinite(value) ? Math.max(0, value) : 0), 0);
  if (!hasData || (type === 'pie' && !pieTotal)) return emptySvg(options, titleId, descId, description);
  const kids = type === 'pie'
    ? pieChart(options, color)
    : type === 'horizontal-bar'
      ? horizontalBarChart(options, color)
      : axisChart(options, color, titleId, descId);
  return h('svg', {
    viewBox: `0 0 ${width} ${height}`, width: '100%', height,
    role: interactive ? 'group' : 'img',
    'aria-roledescription': interactive ? 'chart' : undefined,
    'aria-labelledby': titleId, 'aria-describedby': descId,
    'font-family': 'system-ui, sans-serif', 'font-size': 12,
    'data-chart-type': type, 'data-category-count': labels.length,
    'data-series-count': type === 'pie' ? 1 : series.length,
    'data-interactive': interactive ? 'true' : 'false',
    tabindex: interactive ? 0 : undefined,
  },
    svgStyle(),
    h('title', { id: titleId }, title),
    h('desc', { id: descId }, description),
    kids,
    interactive ? [
      h('rect', { x: 3, y: 3, width: Math.max(1, width - 6), height: Math.max(1, height - 6), fill: 'none', stroke: '#fff', 'stroke-width': 6, class: 'mc-svg-focus-light', 'aria-hidden': 'true' }),
      h('rect', { x: 3, y: 3, width: Math.max(1, width - 6), height: Math.max(1, height - 6), fill: 'none', stroke: '#000', 'stroke-width': 2.5, class: 'mc-svg-focus-dark', 'aria-hidden': 'true' }),
    ] : []);
}

function pointMessage(options, activePoint) {
  if (!activePoint || !options.interactive || options.type === undefined) return '';
  const { data, type } = options;
  if (type === 'pie') {
    const label = data.labels?.[activePoint.category];
    const value = data.series?.[0]?.values?.[activePoint.category];
    const values = (data.series?.[0]?.values ?? []).map((n) => Number.isFinite(n) ? Math.max(0, n) : 0);
    const total = values.reduce((sum, n) => sum + n, 0);
    if (label == null || !Number.isFinite(value) || !total || value <= 0) return '';
    return `${label}: ${format(value)}, ${(value / total * 100).toFixed(1).replace(/\.0$/, '')}%`;
  }
  const item = data.series?.[activePoint.series];
  const label = data.labels?.[activePoint.category];
  const value = item?.values?.[activePoint.category];
  if (!item || label == null || !Number.isFinite(value)) return '';
  return `${item.name || `Series ${activePoint.series + 1}`}, ${label}: ${format(value)}`;
}

function tableTree(options, title) {
  if (options.table === 'none') return null;
  const { type, data, idPrefix, caption } = options;
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  const pie = type === 'pie';
  const tableCaption = caption ? `${caption} data` : `Data for ${title}`;
  const headers = pie
    ? ['Label', 'Value', 'Percentage']
    : ['Category', ...series.map((item, index) => item.name ?? `Series ${index + 1}`)];
  const head = h('thead', {}, h('tr', {}, headers.map((label) => h('th', { scope: 'col' }, label))));
  let bodyRows;
  if (pie) {
    const values = series[0]?.values ?? [];
    const total = values.reduce((sum, value) => sum + (Number.isFinite(value) ? Math.max(0, value) : 0), 0);
    bodyRows = labels.map((label, index) => {
      const value = values[index];
      const numeric = Number.isFinite(value) ? Math.max(0, value) : 0;
      const percentage = total && Number.isFinite(value) ? `${(numeric / total * 100).toFixed(1).replace(/\.0$/, '')}%` : '';
      return h('tr', {},
        h('th', { scope: 'row' }, String(label)),
        h('td', {}, format(value)),
        h('td', {}, percentage));
    });
  } else {
    bodyRows = labels.map((label, categoryIndex) => h('tr', {},
      h('th', { scope: 'row' }, String(label)),
      ...series.map((item) => h('td', {}, format(item.values?.[categoryIndex])))));
  }
  const tableStyle = options.table === 'hidden'
    ? TABLE_HIDDEN_STYLE
    : 'width:100%;table-layout:fixed;border-collapse:collapse;overflow-wrap:anywhere';
  return h('table', { id: `${idPrefix}-table`, class: `mc-data-table mc-table-${options.table}`, style: tableStyle },
    h('caption', {}, tableCaption), head, h('tbody', {}, bodyRows));
}

export function buildChart(options = {}) {
  const normalized = normalizeOptions(options);
  return buildSvg(normalized);
}

export function buildFigure(options = {}) {
  const normalized = normalizeOptions(options);
  const { caption, type, data, idPrefix, activePoint } = normalized;
  const svg = buildSvg(normalized);
  const title = caption || titleFor(type, data.series ?? []);
  const captionId = `${idPrefix}-caption`;
  const titleId = `${idPrefix}-title`;
  const figureAttrs = {
    id: `${idPrefix}-figure`,
    class: 'mc-figure',
    style: 'display:block;width:100%;max-width:100%;margin:0;box-sizing:border-box;position:relative',
    'aria-labelledby': caption ? captionId : titleId,
  };
  const figureChildren = [svg];
  if (caption) figureChildren.push(h('figcaption', { id: captionId }, caption));
  if (normalized.interactive) figureChildren.push(h('span', {
    id: `${idPrefix}-live`, class: 'mc-visually-hidden mc-live-region',
    'aria-live': 'polite', 'aria-atomic': 'true',
    style: 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0',
  }, pointMessage(normalized, activePoint)));
  const table = tableTree(normalized, title);
  if (table) figureChildren.push(table);
  return h('figure', figureAttrs, figureChildren);
}

function available(point, dims) {
  return point.category >= 0 && point.category < dims.categories && point.series >= 0 && point.series < dims.series
    && (!dims.validPoints || dims.validPoints[point.series]?.[point.category] === true);
}

export function pointDimensions(type, data = { labels: [], series: [] }) {
  const labels = data.labels ?? [];
  const seriesData = data.series ?? [];
  return {
    categories: labels.length,
    series: type === 'pie' ? Math.min(1, seriesData.length) : seriesData.length,
    pie: type === 'pie',
    validPoints: seriesData.map((item) => labels.map((_, index) => {
      const value = item.values?.[index];
      return typeof value === 'number' && Number.isFinite(value) && (type !== 'pie' || value > 0);
    })),
  };
}

export function clampPoint(point, dims) {
  if (!point || dims.categories <= 0 || dims.series <= 0) return null;
  const clamped = {
    category: Math.max(0, Math.min(dims.categories - 1, point.category)),
    series: dims.pie ? 0 : Math.max(0, Math.min(dims.series - 1, point.series)),
  };
  if (available(clamped, dims)) return clamped;
  for (let offset = 1; offset < dims.categories * dims.series; offset++) {
    for (const candidate of [
      { category: clamped.category, series: clamped.series + offset },
      { category: clamped.category, series: clamped.series - offset },
      { category: clamped.category + offset, series: clamped.series },
      { category: clamped.category - offset, series: clamped.series },
    ]) {
      if (dims.pie) candidate.series = 0;
      if (available(candidate, dims)) return candidate;
    }
  }
  return null;
}

export function nextPoint(state, key, dims) {
  const { categories, series, pie = false } = dims;
  if (key === 'Escape') return null;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return undefined;
  if (categories <= 0 || series <= 0) return null;
  const current = clampPoint(state, dims);
  if (!current) {
    const initial = key === 'ArrowLeft' || key === 'End'
      ? { category: categories - 1, series: 0 }
      : { category: 0, series: 0 };
    return clampPoint(initial, dims);
  }
  const direction = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
  if (pie) {
    if (key === 'Home') return clampPoint({ category: 0, series: 0 }, dims);
    if (key === 'End') return clampPoint({ category: categories - 1, series: 0 }, dims);
    const step = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
    for (let offset = 1; offset <= categories; offset++) {
      const candidate = { category: (current.category + step * offset + categories) % categories, series: 0 };
      if (available(candidate, dims)) return candidate;
    }
    return current;
  }
  if (key === 'Home' || key === 'End') {
    const start = key === 'Home' ? 0 : categories - 1;
    const step = key === 'Home' ? 1 : -1;
    for (let category = start; category >= 0 && category < categories; category += step) {
      const candidate = { category, series: current.series };
      if (available(candidate, dims)) return candidate;
    }
    return current;
  }
  const changingCategory = key === 'ArrowLeft' || key === 'ArrowRight';
  const length = changingCategory ? categories : series;
  const base = changingCategory ? current.category : current.series;
  for (let index = base + direction; index >= 0 && index < length; index += direction) {
    const candidate = changingCategory
      ? { category: index, series: current.series }
      : { category: current.category, series: index };
    if (available(candidate, dims)) return candidate;
  }
  return current;
}
