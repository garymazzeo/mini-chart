# mini-chart

A tiny JavaScript charting library for bar, line, and pie charts. It renders SVG and includes both a browser custom element and a React component, backed by a framework-agnostic chart builder.

## Features

- Bar, line, and pie charts rendered as SVG
- Multiple data series for bar and line charts
- Accessible SVG output with an image role and label
- Browser `<mini-chart>` custom element
- React `<Chart>` component
- No third-party runtime dependency for the custom element

## Install

This repository does not include a package manifest, so use the source files directly instead of installing it through npm:

1. Clone or download this repository.
2. Serve the files from a local web server or include them in your application.
3. For the React component, use an existing React project with `react` and its TypeScript declarations installed, plus a bundler configured for TSX.

The custom element uses native JavaScript modules and does not require React.

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

Supported element attributes are `type`, `width`, `height`, and `data`. The default type is `bar`; the default chart dimensions are 480 by 300. The element renders inside a shadow root.

### React

Import `Chart` from `MiniChart.tsx` in a React application with TSX support:

```jsx
import { Chart } from './MiniChart';

const data = {
  labels: ['Jan', 'Feb', 'Mar'],
  series: [{ name: 'Sales', values: [3, 7, 5] }],
};

export function SalesChart() {
  return <Chart type="line" data={data} width={480} height={300} />;
}
```

`Chart` accepts `type`, `data`, `width`, `height`, and `colors` props. Its defaults are `type="bar"`, `width={480}`, and `height={300}`. Keep the `data` object reference stable between renders (or memoize it) to benefit from the component's memoization.

### Chart types

- `bar` — grouped bars; supports multiple series
- `line` — lines with point markers; supports multiple series
- `pie` — slices from the first series only

The chart builder is exported from `core.js` as `buildChart` and can be used directly by JavaScript integrations. It returns a plain SVG element tree rather than a DOM node.

## Run the demo

With Node.js and npm installed, run this from the repository root to start a temporary static server:

```sh
npx --yes http-server . -p 8000
```

Then visit <http://localhost:8000/mini-chart%20demo.html>. The demo shows bar, line, and pie charts with a button to randomize the data. A local server is recommended because the custom element loads JavaScript modules.

## Development

There is no configured package manager, build command, or automated test suite in the repository yet. `core.js` contains the chart builder, `core.d.ts` provides its TypeScript declarations, `mini-chart.js` defines the custom element, and `MiniChart.tsx` provides the React wrapper. `page.jsx` is a standalone React demo page.

## License

This project is released under the [Unlicense](LICENSE), placing the work in the public domain where permitted by law.
