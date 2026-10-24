export type ChartType = 'bar' | 'line' | 'pie';

export interface ChartSeries {
  name?: string;
  values: number[];
  color?: string;
}

export interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

export interface BuildChartOptions {
  type?: ChartType;
  data?: ChartData;
  width?: number;
  height?: number;
  colors?: string[];
}

export interface SvgNode {
  tag: string;
  attrs: Record<string, string | number>;
  children: Array<SvgNode | string>;
}

export const PALETTE: string[];
export function niceTicks(min: number, max: number, count?: number): number[];
export function buildChart(options?: BuildChartOptions): SvgNode;
