// React wrapper. Converts the core's SVG tree into React elements.
import { createElement, useMemo, type ReactNode, type SVGProps } from 'react';
import { buildChart, type ChartData, type ChartType, type SvgNode } from './core.js';

export interface ChartProps {
  type?: ChartType;
  data?: ChartData;
  width?: number;
  height?: number;
  colors?: string[];
}

// 'stroke-width' -> 'strokeWidth' (aria-* and data-* stay as they are)
const camel = (key: string): string =>
  /^(aria|data)-/.test(key) ? key : key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());

function toReact(node: SvgNode | string, key?: number): ReactNode {
  if (typeof node === 'string') return node;

  const props: SVGProps<SVGElement> & Record<string, unknown> =
    key === undefined ? {} : { key };
  for (const [name, value] of Object.entries(node.attrs)) props[camel(name)] = value;

  return createElement(node.tag, props, ...node.children.map((child, index) => toReact(child, index)));
}

export function Chart({ type, data, width, height, colors }: ChartProps) {
  // Rebuild only when inputs change. Pass a stable `data` reference (or memoize it) to benefit.
  const tree = useMemo(
    () => buildChart({ type, data, width, height, colors }),
    [type, data, width, height, colors]
  );
  return toReact(tree);
}
