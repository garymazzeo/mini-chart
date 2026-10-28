# mini-chart

A tiny JavaScript charting library for bar, line, and pie charts. It renders SVG and includes both a browser custom element and a React component, backed by a framework-agnostic chart builder.

## Features

- Vertical bar, horizontal bar, line, and pie charts rendered as SVG
- Multiple data series for bar, horizontal-bar, and line charts
- Accessible SVG output with an image role and label
- Browser `<mini-chart>` custom element
- React `<Chart>` component
- No third-party runtime dependency for the custom element

## Install

Use the source files directly; the core and custom element have no runtime dependencies. Install the development dependencies to run the checks:

```sh
npm install
```

The custom element uses native JavaScript modules and does not require React. The React wrapper requires React, TypeScript declarations, and a bundler configured for TSX in the consuming application.

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

Each series may include an optional `name`, `values` array, and `color`. `labels` and each series' `values` should have corresponding entries. An optional `color` on a series sets its color in bar, horizontal-bar, and line charts. Pie charts use only the first series; its values should correspond to the labels and slice colors are selected per category.

## How to use

### Browser custom element

Load `mini-chart.js` as a module, add a `<mini-chart>` element, then assign its `data` property:

```html
<script type="module" src="./mini-chart.js"></script>

<mini-chart id="sales-chart" type="bar" width="480" height="300"></mini-chart>

<script type="module">
  const chart = document.querySelector('#sales-chart');
  chart.data = {
    labels: ['Jan', 'Feb', 'Mar'],
    series: [{ name: 'Sales', values: [3, 7, 5] }],
  };
</script>
```

The element also accepts JSON data through a `data` attribute:

```html
<mini-chart
  type="pie"
  data='{"labels":["Search","Direct"],"series":[{"values":[7,3]}]}'
></mini-chart>
```

Supported element attributes are `type`, `width`, `height`, `font-size`, `data`, `caption`, `description`, `table`, and `interactive`. The default type is `bar`; the default chart dimensions are 480 by 300 and the default text size is 12px. `interactive="false"` disables keyboard/tooltip interaction. The element renders inside a shadow root.

### React

Import `Chart` from `MiniChart.tsx` in a React application with TSX support:

```jsx
import { Chart } from './MiniChart';

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

`Chart` accepts `type`, `data`, `width`, `height`, `fontSize`, `colors`, `caption`, `description`, `table`, `interactive`, optional `idPrefix`, and `injectStyles` props. React's `useId()` is appended to `idPrefix` so IDs remain unique per instance. Defaults are `type="bar"`, `width={480}`, `height={300}`, `fontSize={12}`, `table="hidden"`, `interactive`, and `injectStyles`. `table` can be `hidden`, `visible`, or `none`; `none` requires a non-empty `description`. Keep the `data` object reference stable between renders (or memoize it) to benefit from the component's memoization.

For a single stylesheet per page, import `chartCss` from `core.js`, render it once, then opt out of per-chart injection:

```jsx
import { chartCss } from './core.js';

function App() {
  return <>
    <style>{chartCss}</style>
    <Chart data={data} injectStyles={false} />
  </>;
}
```

### Accessibility options

Both wrappers render a `<figure>` with a visible caption when supplied, accessible SVG title/description, and a semantic data table. The default visually clipped table remains in the accessibility tree. In interactive mode, focus the chart SVG and use the arrow keys to explore data, Home/End to move to category boundaries, and Escape to dismiss the tooltip. The table remains available as a complete text alternative.

For the custom element, `caption`, `description`, `table`, and `interactive` are HTML attributes. The `caption` attribute takes precedence over host `aria-label`/`aria-labelledby`; without a caption those host names are forwarded to the figure.

## Styling

The wrappers inject `chartCss` from `core.js` by default. All selectors are scoped under `.mc-chart`; custom properties inherit through the custom element's shadow root. Paint is CSS-driven, while chart geometry and `fontSize` remain JavaScript options.

| Custom property | Default | Applies to |
| --- | --- | --- |
| `--mc-color-1` … `--mc-color-8` | `#0072b2`, `#d55e00`, `#009e73`, `#cc79a7`, `#a06100`, `#007f86`, `#8c6d31`, `#4c78a8` | Series fills/strokes, pie slices, legend swatches. Series N cycles through `((N - 1) % 8) + 1`. |
| `--mc-text-color` | `currentColor` | Chart text |
| `--mc-axis-text-color` | `var(--mc-text-color)` | Tick labels |
| `--mc-font-family` | `system-ui, sans-serif` | Chart text |
| `--mc-grid-color` | `currentColor` | Gridlines |
| `--mc-grid-opacity` | `0.15` | Gridlines |
| `--mc-grid-width` | `1` | Gridlines |
| `--mc-grid-dash` | `none` | Gridlines; e.g. `4 4` |
| `--mc-baseline-color` | `var(--mc-grid-color)` | Zero line |
| `--mc-baseline-width` | `var(--mc-grid-width)` | Zero line |
| `--mc-baseline-dash` | `var(--mc-grid-dash)` | Zero line |
| `--mc-line-width` | `2` | Line series |
| `--mc-point-radius` | `3.5px` | Circular line markers |
| `--mc-bar-radius` | `0px` | Bar corners |
| `--mc-surface` | `Canvas` | Pie separators and marker outlines |
| `--mc-slice-gap` | `1.5px` | Pie separators |
| `--mc-focus-color` | `currentColor` | Inner focus ring |
| `--mc-focus-width` | `2px` | Focus ring |
| `--mc-tooltip-bg` | `Canvas` | Tooltip background |
| `--mc-tooltip-color` | `CanvasText` | Tooltip text |
| `--mc-tooltip-border` | `currentColor` | Tooltip border |
| `--mc-inactive-opacity` | `0.35` | Inactive series while exploring a point |

### Examples

Set a page-wide palette and text colors from `:root`:

```css
:root {
  --mc-color-1: #005bbb;
  --mc-color-2: #d55e00;
  --mc-grid-color: #667788;
  --mc-text-color: #17212b;
}
```

Switch properties for dark mode without re-rendering charts:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --mc-color-1: #56b4e9;
    --mc-color-2: #e69f00;
    --mc-text-color: CanvasText;
    --mc-surface: Canvas;
  }
}
```

Use a dashed grid:

```css
:root { --mc-grid-dash: 4 4; }
```

Override one custom element only:

```html
<mini-chart type="bar" style="--mc-color-1: #0072b2"></mini-chart>
```

Series colors are resolved in this order: `series.color`, then `colors[index]` (the colors array repeats as needed), then `--mc-color-N`, then the built-in palette fallback. For pie charts, `colors[index]` selects each slice; `series.color` does not color individual pie slices. A `var()` used as a data color remains an explicit data color, but can refer to a public palette property such as `var(--mc-color-1)`:

```js
const data = {
  labels: ['Jan', 'Feb'],
  series: [
    { name: 'Revenue', values: [8, 12], color: 'var(--mc-color-1)' },
    { name: 'Costs', values: [4, 6] },
  ],
};
```

Set the referenced `--mc-color-N` on `:root` or a chart ancestor before using it as a data color; the built-in fallback is applied to chart palette selection, not to an unset variable inside `series.color`.

The `--_mc-*` properties are internal implementation details; set the public `--mc-*` properties instead.

**Invalid values:** avoid values such as `--mc-color-1: banana`. The built-in fallback nested in `var(--mc-color-1, #0072b2)` does not apply when the property is defined but invalid for `fill`; the resulting declaration becomes invalid at computed-value time and the mark falls back to `fill`'s initial value, not the declared fallback. CSS `@property` registration could validate it, but registration is ignored inside shadow roots, so mini-chart does not depend on it.

If you serialize SVG outside the React/custom-element wrappers, include the exported `chartCss` stylesheet yourself. Contrast is the page author's responsibility when overriding defaults. In React, use `<Chart injectStyles={false} />` when the page has already loaded `chartCss` once.

### Chart types

- `bar` — grouped bars; supports multiple series
- `horizontal-bar` — grouped bars laid out horizontally; supports multiple series
- `line` — lines with point markers; supports multiple series
- `pie` — slices from the first series only

The chart builder is exported from `core.js` as `buildChart` and can be used directly by JavaScript integrations. It returns a plain SVG element tree rather than a DOM node.

## Run the demo

With Node.js and npm installed, run this from the repository root to start a temporary static server:

```sh
npx --yes http-server . -p 8000
```

Then visit <http://localhost:8000/demo.html>. The demo shows all four chart variants and table modes, plus keyboard instructions and a randomize button. `docs/index.html` is generated from the same sources for static hosting.

## Development

`core.js` contains the framework-agnostic chart builder; `core.d.ts` provides its TypeScript declarations; `mini-chart.js` defines the custom element; and `MiniChart.tsx` provides the React wrapper. The assembled `page.jsx`, `demo.html`, and `docs/index.html` are regenerated with:

```sh
npx playwright install chromium
npm run build:demos
npm test
npm run typecheck
```

The automated suite includes Node unit tests, Playwright interaction checks, and axe-core checks. Manual assistive-technology and browser-zoom checks are listed in [ACCESSIBILITY.md](ACCESSIBILITY.md).

## License

This project is released under the [Unlicense](LICENSE), placing the work in the public domain where permitted by law.
