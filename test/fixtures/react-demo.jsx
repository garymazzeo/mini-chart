import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Chart } from '../../MiniChart.tsx';

const initialData = {
  labels: ['Jan', 'Feb', 'Mar'],
  series: [
    { name: 'Revenue', values: [20, 40, 90] },
    { name: 'Costs', values: [6, 4, 12] },
  ],
};
const pieData = { labels: ['Search', 'Direct', 'Social'], series: [{ values: [46, 34, 20] }] };

function Fixture() {
  const [data, setData] = useState(initialData);
  window.__updateReactData = () => setData({
    labels: ['Apr'],
    series: [{ name: 'Revenue', values: [35] }, { name: 'Costs', values: [9] }],
  });
  return <>
    <Chart idPrefix="shared-requested-prefix" type="bar" data={data} caption="Monthly revenue" table="visible" interactive />
    <Chart idPrefix="shared-requested-prefix" type="line" data={initialData} caption="React visitors" description="Two named series across three months." table="hidden" interactive={false} />
    <Chart type="pie" data={pieData} caption="React sources" description="Traffic source proportions." table="none" interactive={false} />
  </>;
}

createRoot(document.getElementById('react-fixture')).render(<Fixture />);
