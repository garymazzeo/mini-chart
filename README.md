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

Each series may include an optional `name` and `values` array. `labels` and each series' `values` should have corresponding entries. An optional `color` on a series sets its color in bar and line charts. If labels or series are missing or empty, the chart displays “No data.” Pie charts use only the first series; its values should correspond to the labels.

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

Supported element attributes are `type`, `width`, `height`, `data`, `caption`, `description`, `table`, and `interactive`. The default type is `bar`; the default chart dimensions are 480 by 300. `interactive="false"` disables keyboard/tooltip interaction. The element renders inside a shadow root.

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

`Chart` accepts `type`, `data`, `width`, `height`, `colors`, `caption`, `description`, `table`, `interactive`, and optional `idPrefix` props. React's `useId()` is appended to `idPrefix` so IDs remain unique per instance. Defaults are `type="bar"`, `width={480}`, `height={300}`, `table="hidden"`, and `interactive`. `table` can be `hidden`, `visible`, or `none`; `none` requires a non-empty `description`. Keep the `data` object reference stable between renders (or memoize it) to benefit from the component's memoization.

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
npm run build
npm run build:demos
npm test
npm run typecheck
npm run test:pack
```

The automated suite includes Node unit tests, Playwright interaction checks, axe-core checks, and an install-from-tarball smoke test. Manual assistive-technology and browser-zoom checks are listed in [ACCESSIBILITY.md](ACCESSIBILITY.md).

## License

This project is released under the [Unlicense](LICENSE), placing the work in the public domain where permitted by law.
