import { createRoot } from 'react-dom/client';
import { Chart } from '../../MiniChart.tsx';

createRoot(document.getElementById('app')).render(
  <Chart
    type="line"
    data={{ labels: ['Jan', 'Feb'], series: [{ name: 'Revenue', values: [3, 7] }] }}
    caption="No-injection chart"
    injectStyles={false}
  />
);
