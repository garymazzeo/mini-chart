import { createRoot } from 'react-dom/client';
import { Chart } from '../../MiniChart.tsx';

const data = {
  labels: ['Jan', 'Feb'],
  series: [
    { name: 'Primary', values: [20, 40] },
    { name: 'Secondary', values: [8, 16] },
  ],
};

createRoot(document.querySelector('#react-styling-fixture')).render(
  <Chart
    type="line"
    data={data}
    colors={['var(--consumer-color, #135724)']}
    gridStyle="dashed"
    fontSize={17}
    interactive={false}
  />,
);
