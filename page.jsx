'use client';
import {
  createElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from "react";
// core.js — framework-agnostic. No DOM, no React.
// buildChart() returns an SVG tree; buildFigure() wraps it with HTML alternatives.

// All chart paint and layout defaults live here; adapters only apply these values.
const STYLE = Object.freeze({
  // Default eight-color palette; the first three entries use page design tokens with fixed fallbacks.
  palette: Object.freeze(['var(--m-color-primary, #0072b2)', 'var(--m-color-secondary, #d55e00)', 'var(--m-color-accent, #009e73)', '#cc79a7', '#a06100', '#007f86', '#8c6d31', '#4c78a8']),
  // Contrast ratios versus white / #14181b, in palette order: 5.185/3.443, 3.867/4.617, 3.421/5.219, 3.061/5.833, 4.995/3.575, 4.795/3.724, 4.831/3.696, 4.606/3.876.
  // Marker shapes differentiate multiple series without relying on hue.
  markers: Object.freeze(['circle', 'square', 'triangle', 'diamond', 'cross', 'plus', 'hexagon']),
  // Line dash patterns differentiate multiple series without relying on hue.
  lineDashes: Object.freeze(['none', '6 3', '2 2', '8 2 2 2', '1 3', '5 2 1 2', '3 2']),
  // Bar hatch paths differentiate later series without relying on hue.
  hatches: Object.freeze(['M-2 8L8 -2M2 10L10 2', 'M-2 -2L8 8M2 -2L10 6', 'M2 0V8M6 0V8', 'M0 2H8M0 6H8', 'M0 0L8 8M0 8L8 0']),
  // Background swatch pattern tile size.
  patternSize: 8,
  // Background swatch hatch stroke width.
  patternLineWidth: 2,
  // SVG pattern tiling mode.
  patternUnits: 'userSpaceOnUse',
  // Default responsive chart width.
  width: 480,
  // Default chart height.
  height: 300,
  // Minimum chart height.
  minHeight: 160,
  // Default SVG font size; font size remains an option because it affects layout.
  fontSize: 12,
  // SVG text inherits the surrounding page's font family.
  fontFamily: 'inherit',
  // Decimal places retained in generated SVG coordinates.
  precision: 2,
  // Target numeric-axis tick count.
  tickCount: 5,
  // Numeric tick-step selection thresholds and final multiplier.
  tickSteps: Object.freeze({ one: 1.5, two: 3, five: 7, next: 10 }),
  // Axis plot margins and label spacing.
  axis: Object.freeze({
    // Top plot margin in SVG units.
    top: 24,
    // Right plot margin in SVG units.
    right: 12,
    // Base bottom plot margin in SVG units.
    bottom: 32,
    // Left plot margin in SVG units.
    left: 46,
    // Gap between numeric ticks and their labels.
    tickLabelGap: 8,
    // Gap between plot and category labels.
    categoryLabelGap: 18,
    // Horizontal category-label breathing room within a band.
    categoryLabelPadding: 10,
    // Maximum fraction of width reserved for horizontal-bar labels.
    horizontalLabelLimit: 0.48,
    // Minimum left margin for horizontal-bar labels.
    horizontalLabelMin: 56,
    // Padding after the widest horizontal-bar label.
    horizontalLabelPadding: 16,
    // Target spacing between visible horizontal-bar labels.
    horizontalLabelTargetHeight: 22,
    // Approximate character width as a fraction of font size for layout only.
    glyphWidthEm: 0.6,
  }),
  // Legend cell, marker, and label geometry.
  legend: Object.freeze({
    // Total horizontal inset used to calculate legend columns.
    horizontalPadding: 20,
    // Minimum width reserved for one legend entry.
    cellWidth: 132,
    // Vertical spacing between legend rows.
    rowHeight: 18,
    // Left inset for each legend entry.
    startX: 10,
    // Marker center X coordinate.
    swatchX: 5,
    // Marker center Y coordinate.
    swatchY: -4,
    // Marker radius or half-size.
    swatchSize: 4,
    // Legend label X coordinate.
    textX: 13,
    // Extra inset below the final legend row.
    bottomPadding: 4,
  }),
  // Bar grouping and corner geometry.
  bar: Object.freeze({
    // Fraction of each category band occupied by grouped bars.
    occupiedFraction: 0.8,
    // Gap removed from each grouped bar's width or height.
    gap: 1,
    // Minimum visible bar dimension.
    minWidth: 1,
    // Bar corner radius.
    radius: 0,
    // First zero-based series index rendered with a hatch pattern.
    patternStartIndex: 2,
  }),
  // Line-series paint and joins.
  line: Object.freeze({
    // Line stroke width.
    width: 2.5,
    // Line join shape.
    join: 'round',
  }),
  // Point-marker size and outline.
  point: Object.freeze({
    // Default marker radius or half-size.
    radius: 4,
    // Marker radius or half-size for the active point.
    activeRadius: 5,
    // Size used when positioning a point focus ring.
    focusRadius: 6,
    // Marker outline color.
    outline: 'Canvas',
    // Marker outline width.
    outlineWidth: 1,
  }),
  // Gridline paint and dashed-grid pattern.
  grid: Object.freeze({
    // Solid grid-style option value.
    solidStyle: 'solid',
    // Dashed grid-style option value.
    dashedStyle: 'dashed',
    // Gridline stroke color.
    color: 'currentColor',
    // Gridline opacity.
    opacity: 0.22,
    // Gridline stroke width.
    width: 1,
    // Dash pattern used by dashed grid style.
    dash: '6 3',
    // Explicit solid-line dash value.
    solidDash: 'none',
  }),
  // Zero baseline remains solid and matches the default gridline paint.
  baseline: Object.freeze({
    // Baseline stroke color.
    color: 'currentColor',
    // Baseline opacity.
    opacity: 0.22,
    // Baseline stroke width.
    width: 1,
    // Baseline is always solid.
    dash: 'none',
  }),
  // Pie separator paint and pie-chart geometry.
  pie: Object.freeze({
    // Separator color follows the current page surface.
    surface: 'Canvas',
    // Separator stroke width.
    separatorWidth: 2,
    // Minimum slice radius.
    minRadius: 20,
    // Inset from the available pie chart bounds.
    radiusInset: 12,
    // Space reserved above the pie legend.
    legendPadding: 12,
    // Starting angle for the first slice.
    startAngle: -Math.PI / 2,
    // Arc threshold for the SVG large-arc flag.
    largeArcThreshold: Math.PI,
    // Gap between an active pie slice and its focus outline.
    focusPadding: 3,
  }),
  // Base text color and opacity.
  text: Object.freeze({
    // Default chart text color follows the host text color.
    color: 'currentColor',
    // Default chart text opacity.
    opacity: 1,
    // Text anchor used for end-aligned numeric labels.
    anchorEnd: 'end',
    // Text anchor used for centered labels.
    anchorMiddle: 'middle',
    // Baseline alignment used for vertically centered labels.
    dominantBaselineMiddle: 'middle',
  }),
  // Two-layer focus indicator geometry and visibility.
  focus: Object.freeze({
    // Outer ring color for ordinary color schemes.
    outerColor: '#fff',
    // Outer ring stroke width.
    outerWidth: 6,
    // Inner ring color for ordinary color schemes.
    innerColor: '#000',
    // Inner ring stroke width.
    innerWidth: 2.5,
    // Padding around an active point ring.
    padding: 3,
    // Inset of the root-SVG focus outline.
    rootInset: 3,
    // Initial opacity of the root focus outline.
    hiddenOpacity: 0,
    // Opacity of the root focus outline under :focus-visible.
    visibleOpacity: 1,
  }),
  // Tooltip dimensions and system-color paint.
  tooltip: Object.freeze({
    // Minimum tooltip width.
    minWidth: 110,
    // Total horizontal limit inside the SVG bounds.
    horizontalLimit: 8,
    // Approximate text character width as a fraction of font size.
    characterWidthEm: 0.6,
    // Total width added for tooltip padding.
    padding: 18,
    // Tooltip text left inset.
    labelInset: 9,
    // Tooltip text baseline offset.
    textBaselineOffset: 4,
    // Tooltip box height.
    height: 24,
    // Vertical offset from point anchor to tooltip box.
    yOffset: 20,
    // Vertical offset between point and tooltip anchor.
    anchorOffset: 14,
    // Minimum tooltip anchor Y coordinate.
    minY: 22,
    // Bottom inset inside the SVG.
    bottomInset: 8,
    // Tooltip box corner radius.
    radius: 4,
    // Tooltip border width.
    borderWidth: 1,
    // Tooltip box fill color.
    background: 'CanvasText',
    // Tooltip text fill color.
    foreground: 'Canvas',
    // Tooltip border color.
    border: 'Canvas',
  }),
  // Shared coordinate ratios and minimum drawable dimensions.
  geometry: Object.freeze({
    // Minimum valid chart dimension or count.
    minimum: 1,
    // Factor used for half-width and half-height calculations.
    half: 2,
    // Factor used by marker-shape path geometry.
    third: 3,
    // Extra height added to a horizontal-bar focus outline.
    horizontalFocusHeightExtra: 5,
  }),
  // Reusable layout ratios for centers and doubled strokes.
  layout: Object.freeze({
    // Half the full unit interval.
    fraction: 0.5,
    // Denominator for half-size geometry.
    half: 2,
    // Multiplier for paired stroke padding.
    double: 2,
  }),
  // Figure and responsive SVG inline styles.
  figure: Object.freeze({
    // Figure wrapper dimensions and positioning.
    style: 'display:block;width:100%;max-width:100%;margin:0;box-sizing:border-box;position:relative',
    // SVG display and responsive sizing.
    svgStyle: 'display:block;max-width:100%;height:auto',
    // Responsive width attribute for the SVG root.
    svgWidth: '100%',
  }),
  // Table styles for visible and visually clipped modes.
  table: Object.freeze({
    // Visually clipped but accessible table style.
    hiddenStyle: 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0',
    // Visible table layout style.
    visibleStyle: 'width:100%;table-layout:fixed;border-collapse:collapse;overflow-wrap:anywhere',
  }),
  // The table's hiddenStyle is reused for screen-reader-only text.
  // Structural custom-element shadow-root styles.
  element: Object.freeze({
    // Custom element host display value.
    hostDisplay: 'block',
    // Maximum width for the host and figure.
    maxWidth: '100%',
    // SVG display value.
    svgDisplay: 'block',
    // SVG height sizing value.
    svgHeight: 'auto',
  }),
  // SVG paint values used by generated marks.
  paint: Object.freeze({
    // No-paint value for SVG fills and strokes.
    none: 'none',
  }),
  // SVG pointer and cursor values used by interactive marks.
  interaction: Object.freeze({
    // Cursor shown over data marks.
    cursor: 'pointer',
    // Prevents decorative focus rings from intercepting pointer input.
    decorativePointerEvents: 'none',
    // Keeps tooltips hoverable.
    tooltipPointerEvents: 'auto',
  }),
  // System colors used by the forced-colors accessibility override.
  forcedColors: Object.freeze({
    // Forced-colors gridline stroke.
    grid: 'CanvasText',
    // Forced-colors gridline opacity.
    gridOpacity: 0.5,
    // Forced-colors axis and legend text.
    text: 'CanvasText',
    // Forced-colors outer focus ring.
    focusOuter: 'Canvas',
    // Forced-colors inner focus ring.
    focusInner: 'Highlight',
    // Forced-colors pie and pattern surface.
    surface: 'Canvas',
    // Forced-colors pattern line and tooltip border.
    pattern: 'CanvasText',
    // Forced-colors tooltip text.
    tooltipText: 'CanvasText',
    // Forced-colors tooltip background.
    tooltipBackground: 'Canvas',
  }),
  // SVG strokes keep their width when chart geometry scales.
  vectorEffect: 'non-scaling-stroke',
});
// Compatibility copy for existing read-only palette imports; STYLE is the source of defaults.
const PALETTE = [...STYLE.palette];

let generatedId = 0;

const h = (tag, attrs = {}, ...children) => ({ tag, attrs, children: children.flat().filter((child) => child != null) });
const r = (number) => +number.toFixed(STYLE.precision);
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
    width: Number(options.width) > 0 ? Number(options.width) : STYLE.width,
    height: Math.max(STYLE.minHeight, Number(options.height) || STYLE.height),
    fontSize: Number(options.fontSize) > 0 ? Number(options.fontSize) : STYLE.fontSize,
    gridStyle: options.gridStyle === STYLE.grid.dashedStyle ? STYLE.grid.dashedStyle : STYLE.grid.solidStyle,
    colors: options.colors?.length ? options.colors : STYLE.palette,
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

function niceTicks(min, max, count = STYLE.tickCount) {
  if (min === max) max = min + 1;
  const raw = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const factor = raw / pow;
  const step = (factor < STYLE.tickSteps.one ? 1 : factor < STYLE.tickSteps.two ? 2 : factor < STYLE.tickSteps.five ? 5 : STYLE.tickSteps.next) * pow;
  const low = Math.floor(min / step) * step;
  const high = Math.ceil(max / step) * step;
  const ticks = [];
  for (let value = low; value <= high + step / 2; value += step) ticks.push(+value.toFixed(10));
  return ticks;
}

function markerShape(shape, x, y, size, fill, attrs = {}) {
  if (shape === 'square') return h('rect', { x: r(x - size), y: r(y - size), width: STYLE.geometry.half * size, height: STYLE.geometry.half * size, fill, ...attrs });
  if (shape === 'triangle') return h('path', { d: `M${r(x)} ${r(y - size)}L${r(x + size)} ${r(y + size)}L${r(x - size)} ${r(y + size)}Z`, fill, ...attrs });
  if (shape === 'diamond') return h('path', { d: `M${r(x)} ${r(y - size)}L${r(x + size)} ${r(y)}L${r(x)} ${r(y + size)}L${r(x - size)} ${r(y)}Z`, fill, ...attrs });
  if (shape === 'cross') return h('path', { d: `M${r(x - size)} ${r(y - size / STYLE.geometry.half)}H${r(x - size / STYLE.geometry.half)}V${r(y - size)}H${r(x + size / STYLE.geometry.half)}V${r(y - size / STYLE.geometry.half)}H${r(x + size)}V${r(y + size / STYLE.geometry.half)}H${r(x + size / STYLE.geometry.half)}V${r(y + size)}H${r(x - size / STYLE.geometry.half)}V${r(y + size / STYLE.geometry.half)}H${r(x - size)}Z`, fill, ...attrs });
  if (shape === 'plus') return h('path', { d: `M${r(x - size / STYLE.geometry.third)} ${r(y - size)}H${r(x + size / STYLE.geometry.third)}V${r(y - size / STYLE.geometry.third)}H${r(x + size)}V${r(y + size / STYLE.geometry.third)}H${r(x + size / STYLE.geometry.third)}V${r(y + size)}H${r(x - size / STYLE.geometry.third)}V${r(y + size / STYLE.geometry.third)}H${r(x - size)}V${r(y - size / STYLE.geometry.third)}H${r(x - size / STYLE.geometry.third)}Z`, fill, ...attrs });
  if (shape === 'hexagon') return h('path', { d: `M${r(x - size)} ${r(y)}L${r(x - size / STYLE.geometry.half)} ${r(y - size)}H${r(x + size / STYLE.geometry.half)}L${r(x + size)} ${r(y)}L${r(x + size / STYLE.geometry.half)} ${r(y + size)}H${r(x - size / STYLE.geometry.half)}Z`, fill, ...attrs });
  return h('circle', { cx: r(x), cy: r(y), r: size, fill, ...attrs });
}

function focusRing(x, y, size = STYLE.point.focusRadius) {
  const radius = size + STYLE.focus.padding - STYLE.geometry.minimum;
  return [
    h('circle', { cx: r(x), cy: r(y), r: radius, fill: STYLE.paint.none, stroke: STYLE.focus.outerColor, 'stroke-width': STYLE.focus.outerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-light', 'aria-hidden': 'true' }),
    h('circle', { cx: r(x), cy: r(y), r: radius, fill: STYLE.paint.none, stroke: STYLE.focus.innerColor, 'stroke-width': STYLE.focus.innerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-dark', 'aria-hidden': 'true' }),
  ];
}

function legend(entries, width, startY, fontSize = STYLE.fontSize) {
  if (!entries.length) return { nodes: [], rows: 0 };
  const columns = Math.max(STYLE.geometry.minimum, Math.floor((width - STYLE.legend.horizontalPadding) / STYLE.legend.cellWidth));
  const cellWidth = (width - STYLE.legend.horizontalPadding) / columns;
  const rows = Math.ceil(entries.length / columns);
  const nodes = entries.map((entry, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = STYLE.legend.startX + column * cellWidth;
    const y = startY + row * STYLE.legend.rowHeight;
    return h('g', { transform: `translate(${r(x)} ${r(y)})`, class: 'mc-legend-item' },
      markerShape(entry.marker ?? 'square', STYLE.legend.swatchX, STYLE.legend.swatchY, STYLE.legend.swatchSize, entry.color, { 'aria-hidden': 'true' }),
      h('text', { x: STYLE.legend.textX, y: 0, fill: entry.color, opacity: STYLE.text.opacity, 'font-size': fontSize, class: 'mc-legend-label' }, String(entry.name)));
  });
  return { nodes, rows };
}

function patternDefs(idPrefix, series, color) {
  const patterns = series.map((item, index) => {
    if (index < STYLE.bar.patternStartIndex) return null;
    const patternId = `${idPrefix}-pattern-${index}`;
    const hatch = STYLE.hatches[(index - STYLE.bar.patternStartIndex) % STYLE.hatches.length];
    return h('pattern', { id: patternId, width: STYLE.patternSize, height: STYLE.patternSize, patternUnits: STYLE.patternUnits },
      h('rect', { width: STYLE.patternSize, height: STYLE.patternSize, fill: color(index), class: 'mc-pattern-background' }),
      h('path', { d: hatch, stroke: STYLE.point.outline, 'stroke-width': STYLE.patternLineWidth, class: 'mc-pattern-line' }));
  });
  return h('defs', {}, patterns);
}

function axisChart(options, color, titleId, descId) {
  const { type, data, width, height, idPrefix, interactive, activePoint, fontSize, gridStyle } = options;
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  const hasLegend = series.length > 1;
  const columns = Math.max(STYLE.geometry.minimum, Math.floor((width - STYLE.legend.horizontalPadding) / STYLE.legend.cellWidth));
  const legendRows = hasLegend ? Math.ceil(series.length / columns) : 0;
  const margins = { top: STYLE.axis.top, right: STYLE.axis.right, bottom: STYLE.axis.bottom + legendRows * STYLE.legend.rowHeight, left: STYLE.axis.left };
  const innerWidth = Math.max(STYLE.geometry.minimum, width - margins.left - margins.right);
  const innerHeight = Math.max(STYLE.geometry.minimum, height - margins.top - margins.bottom);
  const allValues = series.flatMap((item) => item.values ?? []).filter(Number.isFinite);
  let low = allValues.length ? Math.min(...allValues) : 0;
  let high = allValues.length ? Math.max(...allValues) : 1;
  if (type === 'bar') { low = Math.min(low, 0); high = Math.max(high, 0); }
  const ticks = niceTicks(low, high);
  const y = linear(ticks[0], ticks[ticks.length - 1], margins.top + innerHeight, margins.top);
  const band = innerWidth / Math.max(STYLE.geometry.minimum, labels.length);
  const centerX = (index) => margins.left + band * (index + STYLE.layout.fraction);
  const colorAt = (index) => series[index]?.color ?? color(index);
  const out = [patternDefs(idPrefix, series, colorAt)];

  for (const tick of ticks) {
    const isBaseline = tick === 0;
    const paint = isBaseline ? STYLE.baseline : STYLE.grid;
    const dash = isBaseline ? STYLE.baseline.dash : gridStyle === STYLE.grid.dashedStyle ? STYLE.grid.dash : STYLE.grid.solidDash;
    out.push(
      h('line', { x1: margins.left, x2: margins.left + innerWidth, y1: r(y(tick)), y2: r(y(tick)), stroke: paint.color, 'stroke-opacity': paint.opacity, 'stroke-width': paint.width, 'stroke-dasharray': dash, 'vector-effect': STYLE.vectorEffect, class: isBaseline ? 'mc-gridline mc-baseline' : 'mc-gridline', 'aria-hidden': 'true' }),
      h('text', { x: margins.left - STYLE.axis.tickLabelGap, y: r(y(tick)), 'text-anchor': STYLE.text.anchorEnd, 'dominant-baseline': STYLE.text.dominantBaselineMiddle, fill: STYLE.text.color, opacity: STYLE.text.opacity, 'font-size': fontSize, class: 'mc-axis-label' }, String(tick)));
  }

  const widestLabel = labels.reduce((widest, label) => Math.max(widest, String(label).length * fontSize * STYLE.axis.glyphWidthEm), 0);
  const labelStep = Math.max(STYLE.geometry.minimum, Math.ceil(widestLabel / Math.max(STYLE.geometry.minimum, band - STYLE.axis.categoryLabelPadding)));
  labels.forEach((label, index) => {
    if (index % labelStep !== 0) return;
    out.push(h('text', { x: r(centerX(index)), y: margins.top + innerHeight + STYLE.axis.categoryLabelGap, 'text-anchor': STYLE.text.anchorMiddle, fill: STYLE.text.color, opacity: STYLE.text.opacity, 'font-size': fontSize, class: 'mc-axis-label' }, String(label)));
  });

  const pointPositions = new Map();
  series.forEach((item, seriesIndex) => {
    const seriesColor = colorAt(seriesIndex);
    if (type === 'bar') {
      const barWidth = (band * STYLE.bar.occupiedFraction) / Math.max(STYLE.geometry.minimum, series.length);
      (item.values ?? []).forEach((value, categoryIndex) => {
        if (!Number.isFinite(value) || categoryIndex >= labels.length) return;
        const x = centerX(categoryIndex) - band * (STYLE.bar.occupiedFraction / STYLE.layout.half) + seriesIndex * barWidth;
        const top = Math.min(y(value), y(0));
        const barHeight = Math.max(STYLE.geometry.minimum, Math.abs(y(value) - y(0)));
        const barPaintWidth = Math.max(barWidth - STYLE.bar.gap, STYLE.bar.minWidth);
        const px = x + barPaintWidth / STYLE.layout.half;
        const py = y(value);
        const active = activePoint?.series === seriesIndex && activePoint?.category === categoryIndex;
        pointPositions.set(`${seriesIndex}:${categoryIndex}`, { x: px, y: py, text: `${item.name || `Series ${seriesIndex + 1}`}, ${labels[categoryIndex]}: ${value}` });
        const bar = h('rect', { x: r(x), y: r(top), width: r(barPaintWidth), height: r(barHeight), rx: STYLE.bar.radius, fill: seriesIndex >= STYLE.bar.patternStartIndex ? `url(#${idPrefix}-pattern-${seriesIndex})` : seriesColor, class: 'mc-bar' });
        const ring = active ? [
          h('rect', { x: r(x - STYLE.focus.padding), y: r(top - STYLE.focus.padding), width: r(barPaintWidth + STYLE.focus.padding * STYLE.layout.double), height: r(barHeight + STYLE.focus.padding * STYLE.layout.double), fill: STYLE.paint.none, stroke: STYLE.focus.outerColor, 'stroke-width': STYLE.focus.outerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-light', 'aria-hidden': 'true' }),
          h('rect', { x: r(x - STYLE.focus.padding), y: r(top - STYLE.focus.padding), width: r(barPaintWidth + STYLE.focus.padding * STYLE.layout.double), height: r(barHeight + STYLE.focus.padding * STYLE.layout.double), fill: STYLE.paint.none, stroke: STYLE.focus.innerColor, 'stroke-width': STYLE.focus.innerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-dark', 'aria-hidden': 'true' }),
        ] : [];
        out.push(h('g', { 'data-point-category': categoryIndex, 'data-point-series': seriesIndex, cursor: STYLE.interaction.cursor, class: 'mc-point', 'aria-hidden': 'true' }, bar, ring));
      });
    } else {
      let path = '';
      let pen = false;
      (item.values ?? []).forEach((value, categoryIndex) => {
        if (!Number.isFinite(value) || categoryIndex >= labels.length) { pen = false; return; }
        path += `${pen ? 'L' : 'M'}${r(centerX(categoryIndex))} ${r(y(value))}`;
        pen = true;
      });
      out.push(h('path', { d: path, fill: STYLE.paint.none, stroke: seriesColor, 'stroke-width': STYLE.line.width, 'stroke-dasharray': STYLE.lineDashes[seriesIndex % STYLE.lineDashes.length], 'stroke-linejoin': STYLE.line.join, class: 'mc-line', 'aria-hidden': 'true' }));
      (item.values ?? []).forEach((value, categoryIndex) => {
        if (!Number.isFinite(value) || categoryIndex >= labels.length) return;
        const x = centerX(categoryIndex), py = y(value);
        const active = activePoint?.series === seriesIndex && activePoint?.category === categoryIndex;
        pointPositions.set(`${seriesIndex}:${categoryIndex}`, { x, y: py, text: `${item.name || `Series ${seriesIndex + 1}`}, ${labels[categoryIndex]}: ${value}` });
        const marker = markerShape(STYLE.markers[seriesIndex % STYLE.markers.length], x, py, active ? STYLE.point.activeRadius : STYLE.point.radius, seriesColor, { 'data-marker': STYLE.markers[seriesIndex % STYLE.markers.length], stroke: STYLE.point.outline, 'stroke-width': STYLE.point.outlineWidth, class: 'mc-marker' });
        out.push(h('g', { 'data-point-category': categoryIndex, 'data-point-series': seriesIndex, cursor: STYLE.interaction.cursor, class: 'mc-point', 'aria-hidden': 'true' }, marker, active ? focusRing(x, py, STYLE.point.focusRadius) : []));
      });
    }
  });

  if (hasLegend) {
    const entries = series.map((item, index) => ({ name: item.name ?? `Series ${index + 1}`, color: colorAt(index), marker: STYLE.markers[index % STYLE.markers.length] }));
    out.push(...legend(entries, width, height - legendRows * STYLE.legend.rowHeight + STYLE.legend.bottomPadding).nodes);
  }

  const active = activePoint && pointPositions.get(`${activePoint.series}:${activePoint.category}`);
  if (interactive && active) out.push(tooltip(active, width, height, fontSize));
  return out;
}

function horizontalBarChart(options, color) {
  const { data, width, height, idPrefix, activePoint, interactive, fontSize, gridStyle } = options;
  const labels = data.labels ?? [];
  const series = data.series ?? [];
  const hasLegend = series.length > 1;
  const columns = Math.max(STYLE.geometry.minimum, Math.floor((width - STYLE.legend.horizontalPadding) / STYLE.legend.cellWidth));
  const legendRows = hasLegend ? Math.ceil(series.length / columns) : 0;
  const longestLabel = labels.reduce((widest, label) => Math.max(widest, String(label).length * fontSize * STYLE.axis.glyphWidthEm), 0);
  const margins = { top: STYLE.axis.top, right: STYLE.axis.right, bottom: STYLE.axis.bottom + legendRows * STYLE.legend.rowHeight, left: Math.min(width * STYLE.axis.horizontalLabelLimit, Math.max(STYLE.axis.horizontalLabelMin, longestLabel + STYLE.axis.horizontalLabelPadding)) };
  const innerWidth = Math.max(STYLE.geometry.minimum, width - margins.left - margins.right);
  const innerHeight = Math.max(STYLE.geometry.minimum, height - margins.top - margins.bottom);
  const values = series.flatMap((item) => item.values ?? []).filter(Number.isFinite);
  const low = Math.min(0, ...(values.length ? values : [0]));
  const high = Math.max(0, ...(values.length ? values : [1]));
  const ticks = niceTicks(low, high);
  const x = linear(ticks[0], ticks[ticks.length - 1], margins.left, margins.left + innerWidth);
  const band = innerHeight / Math.max(STYLE.geometry.minimum, labels.length);
  const centerY = (index) => margins.top + band * (index + STYLE.layout.fraction);
  const colorAt = (index) => series[index]?.color ?? color(index);
  const out = [patternDefs(idPrefix, series, colorAt)];

  for (const tick of ticks) {
    const isBaseline = tick === 0;
    const paint = isBaseline ? STYLE.baseline : STYLE.grid;
    const dash = isBaseline ? STYLE.baseline.dash : gridStyle === STYLE.grid.dashedStyle ? STYLE.grid.dash : STYLE.grid.solidDash;
    out.push(
      h('line', { x1: r(x(tick)), x2: r(x(tick)), y1: margins.top, y2: margins.top + innerHeight, stroke: paint.color, 'stroke-opacity': paint.opacity, 'stroke-width': paint.width, 'stroke-dasharray': dash, 'vector-effect': STYLE.vectorEffect, class: isBaseline ? 'mc-gridline mc-baseline' : 'mc-gridline', 'aria-hidden': 'true' }),
      h('text', { x: r(x(tick)), y: margins.top + innerHeight + STYLE.axis.categoryLabelGap, 'text-anchor': STYLE.text.anchorMiddle, fill: STYLE.text.color, opacity: STYLE.text.opacity, 'font-size': fontSize, class: 'mc-axis-label' }, String(tick)));
  }

  const labelStep = Math.max(STYLE.geometry.minimum, Math.ceil(STYLE.axis.horizontalLabelTargetHeight / Math.max(STYLE.geometry.minimum, band)));
  labels.forEach((label, index) => {
    if (index % labelStep !== 0) return;
    out.push(h('text', { x: margins.left - STYLE.axis.tickLabelGap, y: r(centerY(index)), 'text-anchor': STYLE.text.anchorEnd, 'dominant-baseline': STYLE.text.dominantBaselineMiddle, fill: STYLE.text.color, opacity: STYLE.text.opacity, 'font-size': fontSize, class: 'mc-axis-label' }, String(label)));
  });

  const pointPositions = new Map();
  series.forEach((item, seriesIndex) => {
    const seriesColor = colorAt(seriesIndex);
    const barHeight = Math.max(STYLE.geometry.minimum, (band * STYLE.bar.occupiedFraction) / Math.max(STYLE.geometry.minimum, series.length));
    (item.values ?? []).forEach((value, categoryIndex) => {
      if (!Number.isFinite(value) || categoryIndex >= labels.length) return;
      const y = centerY(categoryIndex) - band * (STYLE.bar.occupiedFraction / STYLE.layout.half) + seriesIndex * barHeight;
      const zeroX = x(0);
      const valueX = x(value);
      const barX = Math.min(zeroX, valueX);
      const barWidth = Math.max(STYLE.bar.minWidth, Math.abs(valueX - zeroX));
      const barPaintHeight = Math.max(STYLE.bar.minWidth, barHeight - STYLE.bar.gap);
      const active = activePoint?.series === seriesIndex && activePoint?.category === categoryIndex;
      pointPositions.set(`${seriesIndex}:${categoryIndex}`, { x: valueX, y: y + barHeight / STYLE.layout.half, text: `${item.name || `Series ${seriesIndex + 1}`}, ${labels[categoryIndex]}: ${value}` });
      const bar = h('rect', { x: r(barX), y: r(y), width: r(barWidth), height: r(barPaintHeight), rx: STYLE.bar.radius, fill: seriesIndex >= STYLE.bar.patternStartIndex ? `url(#${idPrefix}-pattern-${seriesIndex})` : seriesColor, class: 'mc-bar' });
      const ring = active ? [
        h('rect', { x: r(barX - STYLE.focus.padding), y: r(y - STYLE.focus.padding), width: r(barWidth + STYLE.focus.padding * STYLE.layout.double), height: r(barHeight + STYLE.geometry.horizontalFocusHeightExtra), fill: STYLE.paint.none, stroke: STYLE.focus.outerColor, 'stroke-width': STYLE.focus.outerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-light', 'aria-hidden': 'true' }),
        h('rect', { x: r(barX - STYLE.focus.padding), y: r(y - STYLE.focus.padding), width: r(barWidth + STYLE.focus.padding * STYLE.layout.double), height: r(barHeight + STYLE.geometry.horizontalFocusHeightExtra), fill: STYLE.paint.none, stroke: STYLE.focus.innerColor, 'stroke-width': STYLE.focus.innerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-dark', 'aria-hidden': 'true' }),
      ] : [];
      out.push(h('g', { 'data-point-category': categoryIndex, 'data-point-series': seriesIndex, cursor: STYLE.interaction.cursor, class: 'mc-point', 'aria-hidden': 'true' }, bar, ring));
    });
  });

  if (hasLegend) {
    const entries = series.map((item, index) => ({ name: item.name ?? `Series ${index + 1}`, color: colorAt(index), marker: STYLE.markers[index % STYLE.markers.length] }));
    out.push(...legend(entries, width, height - legendRows * STYLE.legend.rowHeight + STYLE.legend.bottomPadding).nodes);
  }

  const active = activePoint && pointPositions.get(`${activePoint.series}:${activePoint.category}`);
  if (interactive && active) out.push(tooltip(active, width, height, fontSize));
  return out;
}

function pieChart(options, color) {
  const { data, width, height, idPrefix, activePoint, interactive, fontSize } = options;
  const labels = data.labels ?? [];
  const values = (data.series?.[0]?.values ?? []).map((value) => Number.isFinite(value) ? Math.max(0, value) : 0);
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!total) return null;
  const columns = Math.max(STYLE.geometry.minimum, Math.floor((width - STYLE.legend.horizontalPadding) / STYLE.legend.cellWidth));
  const legendRows = Math.ceil(labels.length / columns);
  const legendHeight = STYLE.pie.legendPadding + legendRows * STYLE.legend.rowHeight;
  const cx = width / STYLE.layout.half;
  const cy = (height - legendHeight) / STYLE.layout.half;
  const radius = Math.max(STYLE.pie.minRadius, Math.min(width, height - legendHeight) / STYLE.layout.half - STYLE.pie.radiusInset);
  const point = (angle) => [r(cx + radius * Math.cos(angle)), r(cy + radius * Math.sin(angle))];
  const out = [];
  const positions = new Map();
  let angle = STYLE.pie.startAngle;
  const totalNonzero = values.filter((value) => value > 0).length;

  values.forEach((value, index) => {
    if (!value) return;
    const sweep = (value / total) * STYLE.layout.double * Math.PI;
    const midpoint = angle + sweep / STYLE.layout.double;
    const [x, y] = point(midpoint);
    const [x0, y0] = point(angle);
    const [x1, y1] = point(angle + sweep);
    const active = activePoint?.category === index;
    const description = `${labels[index]}: ${format(value)}, ${Number((value / total * 100).toFixed(1))}%`;
    positions.set(`0:${index}`, { x, y, text: description });
    const slice = totalNonzero === STYLE.geometry.minimum
      ? h('circle', { cx, cy, r: radius, fill: color(index), stroke: STYLE.pie.surface, 'stroke-width': STYLE.pie.separatorWidth, class: 'mc-pie-slice' })
      : h('path', { d: `M${cx} ${cy}L${x0} ${y0}A${radius} ${radius} 0 ${sweep > STYLE.pie.largeArcThreshold ? 1 : 0} 1 ${x1} ${y1}Z`, fill: color(index), stroke: STYLE.pie.surface, 'stroke-width': STYLE.pie.separatorWidth, class: 'mc-pie-slice' });
    const ring = active ? (totalNonzero === STYLE.geometry.minimum
      ? [h('circle', { cx, cy, r: radius + STYLE.pie.focusPadding, fill: STYLE.paint.none, stroke: STYLE.focus.outerColor, 'stroke-width': STYLE.focus.outerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-light', 'aria-hidden': 'true' }), h('circle', { cx, cy, r: radius + STYLE.pie.focusPadding, fill: STYLE.paint.none, stroke: STYLE.focus.innerColor, 'stroke-width': STYLE.focus.innerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-dark', 'aria-hidden': 'true' })]
      : [h('path', { d: `M${cx} ${cy}L${x0} ${y0}A${radius} ${radius} 0 ${sweep > STYLE.pie.largeArcThreshold ? 1 : 0} 1 ${x1} ${y1}Z`, fill: STYLE.paint.none, stroke: STYLE.focus.outerColor, 'stroke-width': STYLE.focus.outerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-light', 'aria-hidden': 'true' }), h('path', { d: `M${cx} ${cy}L${x0} ${y0}A${radius} ${radius} 0 ${sweep > STYLE.pie.largeArcThreshold ? 1 : 0} 1 ${x1} ${y1}Z`, fill: STYLE.paint.none, stroke: STYLE.focus.innerColor, 'stroke-width': STYLE.focus.innerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-focus-dark', 'aria-hidden': 'true' })]) : [];
    out.push(h('g', { 'data-point-category': index, 'data-point-series': 0, cursor: STYLE.interaction.cursor, class: 'mc-point', 'aria-hidden': 'true' }, slice, ring));
    angle += sweep;
  });

  const entries = labels.map((name, index) => ({ name, color: color(index), marker: STYLE.markers[index % STYLE.markers.length] }));
  out.push(...legend(entries, width, height - legendRows * STYLE.legend.rowHeight + STYLE.legend.bottomPadding).nodes);
  const active = activePoint && positions.get(`0:${activePoint.category}`);
  if (interactive && active) out.push(tooltip(active, width, height, fontSize));
  return out;
}

function tooltip(active, width, height, fontSize = STYLE.fontSize) {
  const text = active.text;
  const tooltipWidth = Math.min(width - STYLE.tooltip.horizontalLimit, Math.max(STYLE.tooltip.minWidth, text.length * fontSize * STYLE.tooltip.characterWidthEm + STYLE.tooltip.padding));
  const sideInset = STYLE.tooltip.horizontalLimit / STYLE.layout.half;
  const x = Math.min(Math.max(sideInset, active.x - tooltipWidth / STYLE.layout.half), width - tooltipWidth - sideInset);
  const y = Math.min(Math.max(STYLE.tooltip.minY, active.y - STYLE.tooltip.anchorOffset), height - STYLE.tooltip.bottomInset);
  return h('g', { role: 'tooltip', class: 'mc-tooltip', 'pointer-events': STYLE.interaction.tooltipPointerEvents, 'aria-hidden': 'true' },
    h('rect', { x: r(x), y: r(y - STYLE.tooltip.yOffset), width: r(tooltipWidth), height: STYLE.tooltip.height, rx: STYLE.tooltip.radius, fill: STYLE.tooltip.background, stroke: STYLE.tooltip.border, 'stroke-width': STYLE.tooltip.borderWidth }),
    h('text', { x: r(x + STYLE.tooltip.labelInset), y: r(y - STYLE.tooltip.textBaselineOffset), fill: STYLE.tooltip.foreground, 'font-size': fontSize }, text));
}

function svgStyle() {
  const forced = STYLE.forcedColors;
  return h('style', {}, `.mc-svg-focus-light,.mc-svg-focus-dark{opacity:${STYLE.focus.hiddenOpacity};pointer-events:${STYLE.interaction.decorativePointerEvents};vector-effect:${STYLE.vectorEffect}}svg:focus-visible>.mc-svg-focus-light,svg:focus-visible>.mc-svg-focus-dark{opacity:${STYLE.focus.visibleOpacity}}@media(forced-colors:active){.mc-gridline{stroke:${forced.grid}!important;stroke-opacity:${forced.gridOpacity}!important}.mc-axis-label,.mc-legend-label{fill:${forced.text}!important;opacity:${STYLE.text.opacity}!important}.mc-focus-light,.mc-svg-focus-light{stroke:${forced.focusOuter}!important}.mc-focus-dark,.mc-svg-focus-dark{stroke:${forced.focusInner}!important}.mc-pie-slice{stroke:${forced.surface}!important}.mc-pattern-background{fill:${forced.surface}!important;stroke:${forced.pattern}!important}.mc-pattern-line{stroke:${forced.pattern}!important}.mc-tooltip rect{fill:${forced.tooltipBackground}!important;stroke:${forced.tooltipText}!important}.mc-tooltip text{fill:${forced.tooltipText}!important}}`);
}

function emptySvg(options, titleId, descId, description) {
  const { type, width, height, fontSize } = options;
  return h('svg', {
    viewBox: `0 0 ${width} ${height}`, width: STYLE.figure.svgWidth, height,
    role: 'img', 'aria-labelledby': titleId, 'aria-describedby': descId,
    'font-family': STYLE.fontFamily, 'font-size': fontSize, style: STYLE.figure.svgStyle,
    'data-chart-type': type, 'data-category-count': 0, 'data-series-count': 0,
    'data-interactive': 'false',
    tabindex: undefined,
  },
    svgStyle(),
    h('title', { id: titleId }, 'No data'),
    h('desc', { id: descId }, description),
    h('text', { x: width / STYLE.layout.half, y: height / STYLE.layout.half, 'text-anchor': STYLE.text.anchorMiddle, fill: STYLE.text.color, opacity: STYLE.text.opacity, 'font-size': fontSize, class: 'mc-axis-label', role: 'status' }, 'No data'));
}

function buildSvg(options) {
  const { type, data, width, height, colors, idPrefix, caption, interactive, activePoint, fontSize } = options;
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
    viewBox: `0 0 ${width} ${height}`, width: STYLE.figure.svgWidth, height,
    role: interactive ? 'group' : 'img',
    'aria-roledescription': interactive ? 'chart' : undefined,
    'aria-labelledby': titleId, 'aria-describedby': descId,
    'font-family': STYLE.fontFamily, 'font-size': fontSize, style: STYLE.figure.svgStyle,
    'data-chart-type': type, 'data-category-count': labels.length,
    'data-series-count': type === 'pie' ? STYLE.geometry.minimum : series.length,
    'data-interactive': interactive ? 'true' : 'false',
    tabindex: interactive ? 0 : undefined,
  },
    svgStyle(),
    h('title', { id: titleId }, title),
    h('desc', { id: descId }, description),
    kids,
    interactive ? [
      h('rect', { x: STYLE.focus.rootInset, y: STYLE.focus.rootInset, width: Math.max(STYLE.geometry.minimum, width - STYLE.focus.rootInset * STYLE.layout.double), height: Math.max(STYLE.geometry.minimum, height - STYLE.focus.rootInset * STYLE.layout.double), fill: STYLE.paint.none, stroke: STYLE.focus.outerColor, 'stroke-width': STYLE.focus.outerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-svg-focus-light', 'aria-hidden': 'true' }),
      h('rect', { x: STYLE.focus.rootInset, y: STYLE.focus.rootInset, width: Math.max(STYLE.geometry.minimum, width - STYLE.focus.rootInset * STYLE.layout.double), height: Math.max(STYLE.geometry.minimum, height - STYLE.focus.rootInset * STYLE.layout.double), fill: STYLE.paint.none, stroke: STYLE.focus.innerColor, 'stroke-width': STYLE.focus.innerWidth, 'vector-effect': STYLE.vectorEffect, 'pointer-events': STYLE.interaction.decorativePointerEvents, class: 'mc-svg-focus-dark', 'aria-hidden': 'true' }),
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
      const percentage = total && Number.isFinite(value) ? `${Number((numeric / total * 100).toFixed(1))}%` : '';
      return h('tr', {}, h('th', { scope: 'row' }, String(label)), h('td', {}, format(value)), h('td', {}, percentage));
    });
  } else {
    bodyRows = labels.map((label, categoryIndex) => h('tr', {},
      h('th', { scope: 'row' }, String(label)),
      ...series.map((item) => h('td', {}, format(item.values?.[categoryIndex])))));
  }
  const tableStyle = options.table === 'hidden' ? STYLE.table.hiddenStyle : STYLE.table.visibleStyle;
  return h('table', { id: `${idPrefix}-table`, class: `mc-data-table mc-table-${options.table}`, style: tableStyle },
    h('caption', {}, tableCaption), head, h('tbody', {}, bodyRows));
}

function buildChart(options = {}) {
  const normalized = normalizeOptions(options);
  return buildSvg(normalized);
}

function buildFigure(options = {}) {
  const normalized = normalizeOptions(options);
  const { caption, type, data, idPrefix, activePoint } = normalized;
  const svg = buildSvg(normalized);
  const title = caption || titleFor(type, data.series ?? []);
  const captionId = `${idPrefix}-caption`;
  const titleId = `${idPrefix}-title`;
  const figureAttrs = {
    id: `${idPrefix}-figure`,
    class: 'mc-figure',
    style: STYLE.figure.style,
    'aria-labelledby': caption ? captionId : titleId,
  };
  const figureChildren = [svg];
  if (caption) figureChildren.push(h('figcaption', { id: captionId }, caption));
  if (normalized.interactive) figureChildren.push(h('span', {
    id: `${idPrefix}-live`, class: 'mc-visually-hidden mc-live-region',
    'aria-live': 'polite', 'aria-atomic': 'true',
    style: STYLE.table.hiddenStyle,
  }, pointMessage(normalized, activePoint)));
  const table = tableTree(normalized, title);
  if (table) figureChildren.push(table);
  return h('figure', figureAttrs, figureChildren);
}

function available(point, dims) {
  return point.category >= 0 && point.category < dims.categories && point.series >= 0 && point.series < dims.series
    && (!dims.validPoints || dims.validPoints[point.series]?.[point.category] === true);
}

function pointDimensions(type, data = { labels: [], series: [] }) {
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

function clampPoint(point, dims) {
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

function nextPoint(state, key, dims) {
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
function camel(key) {
  if (/^(aria|data)-/.test(key)) return key;
  if (key === "class") return "className";
  if (key === "tabindex") return "tabIndex";
  return key.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
}
function parseStyle(value) {
  const style = {};
  for (const declaration of value.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) continue;
    const rawName = declaration.slice(0, separator).trim();
    const rawValue = declaration.slice(separator + 1).trim();
    if (!rawName || !rawValue) continue;
    const name = rawName.startsWith("--") ? rawName : rawName.replace(/-([a-z])/g, (_, character) => character.toUpperCase());
    style[name] = rawValue;
  }
  return style;
}
function pointFromEvent(target) {
  if (!(target instanceof Element)) return null;
  const point = target.closest("[data-point-category][data-point-series]");
  if (!point) return null;
  return {
    category: Number(point.getAttribute("data-point-category")),
    series: Number(point.getAttribute("data-point-series"))
  };
}
function clampActive(point, type, data) {
  if (!point) return null;
  const dims = pointDimensions(type, data);
  const clamped = clampPoint(point, dims);
  if (clamped) return clamped;
  return nextPoint(null, "ArrowRight", dims) ?? null;
}
function toReact(node, key, figureRef, handlers) {
  if (typeof node === "string") return node;
  const props = key === void 0 ? {} : { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    if (value === void 0 || value === null) continue;
    props[camel(name)] = name === "style" && typeof value === "string" ? parseStyle(value) : value;
  }
  if (node.tag === "figure") props.ref = figureRef;
  if (node.tag === "svg") {
    props.onKeyDown = handlers.onKeyDown;
    props.onPointerMove = handlers.onPointerMove;
    props.onPointerDown = handlers.onPointerDown;
  }
  return createElement(node.tag, props, ...node.children.map((child, index) => toReact(child, index, figureRef, handlers)));
}
function Chart({
  type = "bar",
  data = { labels: [], series: [] },
  width = 480,
  height = 300,
  colors,
  caption,
  description,
  table = "hidden",
  interactive = true,
  idPrefix: requestedIdPrefix,
  gridStyle,
  fontSize
}) {
  const reactId = useId();
  const uniqueId = reactId.replace(/[^A-Za-z0-9_-]/g, "");
  const idPrefix = requestedIdPrefix ? `${requestedIdPrefix}-${uniqueId}` : `mini-chart-${uniqueId}`;
  const figureRef = useRef(null);
  const [observedWidth, setObservedWidth] = useState(0);
  const [activePoint, setActivePoint] = useState(null);
  const actualWidth = observedWidth || width;
  const options = {
    type,
    data,
    width: actualWidth,
    height,
    colors,
    gridStyle,
    fontSize,
    caption,
    description,
    table,
    interactive,
    idPrefix,
    activePoint
  };
  const tree = useMemo(() => buildFigure(options), [type, data, actualWidth, height, colors, gridStyle, fontSize, caption, description, table, interactive, idPrefix, activePoint]);
  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || typeof ResizeObserver === "undefined") return void 0;
    const updateWidth = () => {
      const nextWidth = Math.round(figure.getBoundingClientRect().width);
      if (nextWidth > 0) setObservedWidth((previous) => previous === nextWidth ? previous : nextWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(figure);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setActivePoint((point) => clampActive(point, type, data));
  }, [type, data]);
  const handlers = {
    onKeyDown(event) {
      if (!interactive) return;
      const next = nextPoint(activePoint, event.key, pointDimensions(type, data));
      if (next === void 0) return;
      event.preventDefault();
      setActivePoint(next);
    },
    onPointerMove(event) {
      if (!interactive) return;
      const point = pointFromEvent(event.target);
      if (point) setActivePoint(point);
    },
    onPointerDown(event) {
      if (!interactive) return;
      const point = pointFromEvent(event.target);
      if (point) setActivePoint(point);
    }
  };
  return toReact(tree, void 0, figureRef, handlers);
}
{
  Chart
};


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
