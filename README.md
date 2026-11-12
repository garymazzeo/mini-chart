# mini-chart

A tiny JavaScript charting library for vertical and horizontal bar, line, and pie charts. It renders SVG and includes both a browser custom element and a React component, backed by a framework-agnostic chart builder.

## Features

- Bar, line, and pie charts rendered as SVG
- Multiple data series for bar and line charts
- Accessible SVG output with an image role and label
- Browser `<mini-chart>` custom element
- React `<Chart>` component
- No third-party runtime dependency for the custom element

## Install

Install the core and custom-element package:

```sh
npm install @garymazzeo/mini-chart
```

The package is ESM-only. The core and custom element have no runtime dependencies. React is an optional peer dependency; install React 18 or newer only if you use the React entry point:

```sh
npm install react
```

CommonJS `require()` is not a supported entry mode; use ESM `import` (or dynamic `import()` from a CommonJS application).

## Data format

Charts receive an object with `labels` and `series`:

```js
const data = {
  labels: ['Jan', 'Feb', 'Mar'],
  series: [
    { name: 'Sales', values: [3, 7, 5] },
    { name: 'Costs', values: [2, 4, 3] },
  ],
};
```

Each series may include an optional `name`, `values` array, and `color`. `labels` and each series' `values` should have corresponding entries. `series.color` sets that series' color in bar and line charts; pie slices use the `colors` option by slice index. If labels or series are missing or empty, the chart displays “No data.” Pie charts use only the first series; its values should correspond to the labels.

## How to use

### Browser custom element

Import the element entry once, add a `<mini-chart>`, then assign its `data` property:

```html
<mini-chart id="sales-chart" type="bar" width="480" height="300"></mini-chart>

<script type="module">
  import '@garymazzeo/mini-chart/element';

  const chart = document.querySelector('#sales-chart');
  chart.data = {
    labels: ['Jan', 'Feb', 'Mar'],
    series: [{ name: 'Sales', values: [3, 7, 5] }],
  };
</script>
```

The element also accepts JSON data through a `data` attribute. Its module is safe to import during server rendering: on the server it does not access the DOM or register the element; in a browser it registers `<mini-chart>` once.

```html
<mini-chart
  type="pie"
  data='{"labels":["Search","Direct"],"series":[{"values":[7,3]}]}'
></mini-chart>
```

Supported element attributes are `type`, `width`, `height`, `data`, `colors`, `grid-style`, `font-size`, `caption`, `description`, `table`, and `interactive`. `colors` is a JSON array; invalid JSON is ignored. The element also exposes `data`, `colors`, `gridStyle`, and `fontSize` properties. The default type is `bar`; the default chart dimensions are 480 by 300. `interactive="false"` disables keyboard/tooltip interaction. The element renders inside a shadow root.

### React

Import `Chart` from the compiled React entry point:

```jsx
import { Chart } from '@garymazzeo/mini-chart/react';

const data = {
  labels: ['Jan', 'Feb', 'Mar'],
  series: [{ name: 'Sales', values: [3, 7, 5] }],
};

export function SalesChart() {
  return <Chart
    type="line"
    data={data}
    caption="Monthly sales"
    description="Sales by month for the first quarter."
    table="hidden"
    interactive
  />;
}
```

`Chart` accepts `type`, `data`, `width`, `height`, `colors`, `gridStyle`, `fontSize`, `caption`, `description`, `table`, `interactive`, and optional `idPrefix` props. React's `useId()` is appended to `idPrefix` so IDs remain unique per instance. Defaults are `type="bar"`, `width={480}`, `height={300}`, `gridStyle="solid"`, `fontSize={12}`, `table="hidden"`, and `interactive`. `table` can be `hidden`, `visible`, or `none`; `none` requires a non-empty `description`. Keep the `data` object reference stable between renders (or memoize it) to benefit from the component's memoization.

In Next.js, import the React entry from a client component; the compiled wrapper preserves the `'use client'` directive. Importing the custom-element entry on the server is safe and does not attempt DOM registration until it runs in a browser.

### Accessibility options

Both wrappers render a `<figure>` with a visible caption when supplied, accessible SVG title/description, and a semantic data table. The default visually clipped table remains in the accessibility tree. In interactive mode, focus the chart SVG and use the arrow keys to explore data, Home/End to move to category boundaries, and Escape to dismiss the tooltip. The table remains available as a complete text alternative.

For the custom element, `caption`, `description`, `table`, and `interactive` are HTML attributes. The `caption` attribute takes precedence over host `aria-label`/`aria-labelledby`; without a caption those host names are forwarded to the figure.

### Chart types

- `bar` — grouped bars; supports multiple series
- `horizontal-bar` — grouped bars laid out horizontally; supports multiple series
- `line` — lines with point markers; supports multiple series
- `pie` — slices from the first series only

The framework-agnostic chart builder is exported from the package root:

```js
import { buildChart } from '@garymazzeo/mini-chart';

const svgTree = buildChart({ type: 'bar', data });
```

It returns a plain SVG element tree rather than a DOM node. Its full options and return types are exported from the same entry point.

## Styling

### Options

| Group | Option | Type | Default | Core option | React prop | Custom-element attribute/property |
| --- | --- | --- | --- | --- | --- | --- |
| Data and structure | `data` | `ChartData` | Empty labels and series | `data` | `data` | `.data` property or JSON `data` attribute |
| Data and structure | `type` | `ChartType` | `bar` | `type` | `type` | `type` attribute |
| Data and structure | `width` | `number` | `480` | `width` | `width` | `width` attribute; measured host width is used when available |
| Data and structure | `height` | `number` | `300` | `height` | `height` | `height` attribute |
| Look | `colors` | `string[]` | Built-in 8-color palette | `colors` | `colors` | `.colors` property or JSON `colors` attribute |
| Look | `series.color` | CSS color string | Unset; uses the `colors` palette | `data.series[].color` | `data.series[].color` | `.data.series[].color` |
| Look | `gridStyle` | `'solid' \| 'dashed'` | `solid` | `gridStyle` | `gridStyle` | `grid-style` attribute or `.gridStyle` property |
| Look | `fontSize` | `number` | `12` | `fontSize` | `fontSize` | `font-size` attribute or `.fontSize` property |
| Look | Font family | Inherited CSS `font-family` | `inherit` | No option | No prop | Inherits from the element host/page |
| Accessibility and behavior | `caption` | `string` | No visible caption | `caption` | `caption` | `caption` attribute |
| Accessibility and behavior | `description` | `string` | Generated from data | `description` | `description` | `description` attribute |
| Accessibility and behavior | `table` | `TableMode` | `hidden` | `table` | `table` | `table` attribute |
| Accessibility and behavior | `interactive` | `boolean` | `true` | `interactive` | `interactive` | `interactive` attribute; set to `false` to disable |
| Accessibility and behavior | `idPrefix` | `string` | Generated | `idPrefix` | `idPrefix` | Generated internally; no public element attribute |

Unknown `gridStyle` values fall back to `solid`. Dashed styling applies to gridlines only; the zero baseline stays solid. `fontSize` affects the chart's label layout, while font family is inherited without a chart option.

### Design tokens and color precedence

The first three colors in the default palette use these page-level CSS tokens; their values are also the fallbacks when a token is not set:

| Token | Fallback |
| --- | --- |
| `--m-color-primary` | `#0072b2` |
| `--m-color-secondary` | `#d55e00` |
| `--m-color-accent` | `#009e73` |

Set the tokens globally, on a wrapper, or on one custom element. No chart rerender is needed when a token changes:

```css
:root {
  --m-color-primary: #2563eb;
  --m-color-secondary: #ea580c;
  --m-color-accent: #16803c;
}

.brand-chart {
  --m-color-primary: #7c3aed;
  --m-color-secondary: #db2777;
  --m-color-accent: #059669;
}

@media (prefers-color-scheme: dark) {
  :root {
    --m-color-primary: #56b4e9;
    --m-color-secondary: #f0a202;
    --m-color-accent: #50e3a4;
  }
}
```

```html
<mini-chart style="--m-color-primary: #7c3aed"></mini-chart>
```

The default palette has eight colors. Color precedence for bar and line series is `series.color`, then `colors[index]` (the array cycles), then the default palette. Pie slices use `colors` by slice index; `series.color` does not color pie slices. Legend swatches and their labels use the same series/slice color. Colors accept any CSS color string, including `var()`; include a fallback in your own `var()` color, for example `var(--product-color, #2563eb)`. An unset or invalid color can leave the SVG mark with its browser-default paint. Contrast is the page author's responsibility: because legend text matches its swatch color, light colors can fail text contrast on light surfaces.

### Customizing the look in code

All chart paint and geometry defaults live in the exported, frozen `STYLE` constant at the top of `core.js`. Edit one entry there to change a default; the library intentionally has no separate public stylesheet. The table lists every `STYLE` entry (nested names are shown in dotted form):

| `STYLE` entry | Default | Controls |
| --- | --- | --- |
| `palette` | Eight entries: token fallbacks `#0072b2`, `#d55e00`, `#009e73`, then `#cc79a7`, `#a06100`, `#007f86`, `#8c6d31`, `#4c78a8` | Default series, slice, swatch, and legend colors |
| `markers` | `circle, square, triangle, diamond, cross, plus, hexagon` | Marker shapes for series differentiation |
| `lineDashes` | `none; 6 3; 2 2; 8 2 2 2; 1 3; 5 2 1 2; 3 2` | Non-color line-series cues |
| `hatches` | Five 8-unit hatch paths | Non-color bar-series cues after the first two series |
| `patternSize`, `patternLineWidth`, `patternUnits` | `8`, `2`, `userSpaceOnUse` | Bar hatch tile geometry |
| `width`, `height`, `minHeight` | `480`, `300`, `160` | Default SVG dimensions and minimum height |
| `fontSize`, `fontFamily` | `12`, `inherit` | Default type size and inherited family |
| `precision`, `tickCount`, `tickSteps.one/two/five/next` | `2`; `5`; `1.5/3/7/10` | Coordinate rounding and numeric-axis ticks |
| `axis.top/right/bottom/left` | `24/12/32/46` | Plot margins |
| `axis.tickLabelGap`, `categoryLabelGap`, `categoryLabelPadding` | `8/18/10` | Numeric and category label placement |
| `axis.horizontalLabelLimit`, `horizontalLabelMin`, `horizontalLabelPadding`, `horizontalLabelTargetHeight`, `glyphWidthEm` | `0.48/56/16/22/0.6` | Horizontal-bar label space and text-width estimates |
| `legend.horizontalPadding`, `cellWidth`, `rowHeight` | `20/132/18` | Legend columns and row spacing |
| `legend.startX`, `swatchX`, `swatchY`, `swatchSize`, `textX`, `bottomPadding` | `10/5/-4/4/13/4` | Legend swatch and text geometry |
| `bar.occupiedFraction`, `gap`, `minWidth`, `radius`, `patternStartIndex` | `0.8/1/1/0/2` | Bar grouping, corners, and hatch threshold |
| `line.width`, `line.join` | `2.5`, `round` | Line-series stroke |
| `point.radius`, `activeRadius`, `focusRadius`, `outline`, `outlineWidth` | `4/5/6/Canvas/1` | Point-marker size and outline |
| `grid.solidStyle`, `dashedStyle`, `color`, `opacity`, `width`, `dash`, `solidDash` | `solid/dashed/currentColor/0.22/1/6 3/none` | Grid appearance and `gridStyle` option values |
| `baseline.color`, `opacity`, `width`, `dash` | `currentColor/0.22/1/none` | Zero baseline (always solid) |
| `pie.surface`, `separatorWidth`, `minRadius`, `radiusInset`, `legendPadding`, `startAngle`, `largeArcThreshold`, `focusPadding` | `Canvas/2/20/12/12/-π÷2/π/3` | Pie separators, radius, slice geometry, and focus |
| `text.color`, `opacity`, `anchorEnd`, `anchorMiddle`, `dominantBaselineMiddle` | `currentColor/1/end/middle/middle` | Axis and default SVG text paint/alignment |
| `focus.outerColor`, `outerWidth`, `innerColor`, `innerWidth`, `padding`, `rootInset`, `hiddenOpacity`, `visibleOpacity` | `#fff/6/#000/2.5/3/3/0/1` | Two-layer focus indicator |
| `tooltip.minWidth`, `horizontalLimit`, `characterWidthEm`, `padding`, `labelInset`, `textBaselineOffset` | `110/8/0.6/18/9/4` | Tooltip text sizing and placement |
| `tooltip.height`, `yOffset`, `anchorOffset`, `minY`, `bottomInset`, `radius`, `borderWidth` | `24/20/14/22/8/4/1` | Tooltip box geometry |
| `tooltip.background`, `foreground`, `border` | `CanvasText/Canvas/Canvas` | Tooltip colors |
| `geometry.minimum`, `half`, `third`, `horizontalFocusHeightExtra` | `1/2/3/5` | Shared SVG geometry ratios and minimums |
| `layout.fraction`, `half`, `double` | `0.5/2/2` | Centering and paired-stroke geometry |
| `figure.style`, `svgStyle`, `svgWidth` | Block, responsive styles; `100%` SVG width | Figure and responsive SVG layout |
| `table.hiddenStyle`, `visibleStyle` | Clipped 1×1 accessible style; fixed-layout visible table | Data-table visibility/layout and visually hidden text |
| `element.hostDisplay`, `maxWidth`, `svgDisplay`, `svgHeight` | `block/100%/block/auto` | Custom-element shadow-root layout |
| `paint.none` | `none` | Unfilled SVG paths and focus outlines |
| `interaction.cursor`, `decorativePointerEvents`, `tooltipPointerEvents` | `pointer/none/auto` | Pointer behavior of marks and tooltips |
| `forcedColors.grid`, `gridOpacity`, `text`, `focusOuter`, `focusInner`, `surface`, `pattern`, `tooltipText`, `tooltipBackground` | `CanvasText/0.5/CanvasText/Canvas/Highlight/Canvas/CanvasText/CanvasText/Canvas` | System colors for the forced-colors accessibility override |
| `vectorEffect` | `non-scaling-stroke` | Stable grid and focus stroke widths during resizing |

To customize in code: edit the relevant `STYLE` entry, then run `npm run build:demos`, `npm test`, and `npm run typecheck`. To add another design token to the palette, edit one palette entry with `var(--your-token, #fallback)` and document the token where the demo applies it.

The SVG includes a minimal internal stylesheet only for the `:focus-visible` root outline and forced-colors overrides. Its values come from `STYLE`; no stylesheet import or per-component opt-out is needed. The accessible data table, focus ring, tooltip, and non-color series cues remain active independently of the color tokens.

## Run the demo

With Node.js and npm installed, run this from the repository root to start a temporary static server:

```sh
npx --yes http-server . -p 8000
```

Then visit <http://localhost:8000/demo.html>. The demo shows all four chart variants and table modes, a no-rerender token theme switcher, a solid/dashed grid selector, keyboard instructions, and a randomize button. `docs/index.html` is generated from the same sources for static hosting.

## Development

`core.js` contains the framework-agnostic chart builder; `core.d.ts` provides its TypeScript declarations; `mini-chart.js` defines the custom element; and `MiniChart.tsx` provides the React wrapper. The assembled `page.jsx`, `demo.html`, and `docs/index.html` are regenerated with:

```sh
npx playwright install chromium
npm run build
npm run build:demos
npm test
npm run typecheck
npm run test:pack
```

The automated suite includes Node unit tests, Playwright interaction checks, axe-core checks, and an install-from-tarball smoke test. Manual assistive-technology and browser-zoom checks are listed in [ACCESSIBILITY.md](ACCESSIBILITY.md).

## License

This project is released under the [Unlicense](LICENSE), placing the work in the public domain where permitted by law.
