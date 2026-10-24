export type ChartType = 'bar' | 'line' | 'pie';
export type TableMode = 'hidden' | 'visible' | 'none';

export interface ChartSeries {
  name?: string;
  values: Array<number | null | undefined>;
  color?: string;
}

export interface ChartData {
  labels: string[];
  series: ChartSeries[];
}

export interface DataPoint {
  category: number;
  series: number;
}

export interface PointDimensions {
  categories: number;
  series: number;
  pie?: boolean;
  validPoints?: boolean[][];
}

export interface BuildChartOptions {
  type?: ChartType;
  data?: ChartData;
  width?: number;
  height?: number;
  colors?: string[];
  caption?: string;
  description?: string;
  table?: TableMode;
  interactive?: boolean;
  idPrefix?: string;
  activePoint?: DataPoint | null;
}

export interface SvgNode {
  tag: string;
  attrs: Record<string, string | number | undefined>;
  children: Array<SvgNode | string>;
}

export const PALETTE: string[];
export function niceTicks(min: number, max: number, count?: number): number[];
export function buildChart(options?: BuildChartOptions): SvgNode;
export function buildFigure(options?: BuildChartOptions): SvgNode;
export function pointDimensions(type: ChartType, data?: ChartData): PointDimensions;
export function clampPoint(state: DataPoint | null, dims: PointDimensions): DataPoint | null;
export function nextPoint(state: DataPoint | null, key: string, dims: PointDimensions): DataPoint | null | undefined;
