// React adapter for the framework-agnostic chart tree.
import {
  createElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { buildFigure, clampPoint, nextPoint, pointDimensions, type BuildChartOptions, type ChartData, type ChartType, type SvgNode } from './core.js';

export type TableMode = 'hidden' | 'visible' | 'none';

export interface ChartProps {
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
}

function camel(key: string): string {
  if (/^(aria|data)-/.test(key)) return key;
  if (key === 'class') return 'className';
  return key.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
}

function parseStyle(value: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const declaration of value.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator < 0) continue;
    const rawName = declaration.slice(0, separator).trim();
    const rawValue = declaration.slice(separator + 1).trim();
    if (!rawName || !rawValue) continue;
    const name = rawName.startsWith('--')
      ? rawName
      : rawName.replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
    style[name] = rawValue;
  }
  return style as CSSProperties;
}

function pointFromEvent(target: EventTarget | null): { category: number; series: number } | null {
  if (!(target instanceof Element)) return null;
  const point = target.closest<SVGElement>('[data-point-category][data-point-series]');
  if (!point) return null;
  return {
    category: Number(point.getAttribute('data-point-category')),
    series: Number(point.getAttribute('data-point-series')),
  };
}

function clampActive(point: { category: number; series: number } | null, type: ChartType, data: ChartData) {
  if (!point) return null;
  const dims = pointDimensions(type, data);
  const clamped = clampPoint(point, dims);
  if (clamped) return clamped;
  return nextPoint(null, 'ArrowRight', dims) ?? null;
}

function toReact(
  node: SvgNode | string,
  key: number | undefined,
  figureRef: React.RefObject<HTMLElement | null>,
  handlers: {
    onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => void;
    onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
    onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  },
): ReactNode {
  if (typeof node === 'string') return node;
  const props: Record<string, unknown> = key === undefined ? {} : { key };
  for (const [name, value] of Object.entries(node.attrs)) {
    if (value === undefined || value === null) continue;
    props[camel(name)] = name === 'style' && typeof value === 'string' ? parseStyle(value) : value;
  }
  if (node.tag === 'figure') props.ref = figureRef;
  if (node.tag === 'svg') {
    props.onKeyDown = handlers.onKeyDown;
    props.onPointerMove = handlers.onPointerMove;
    props.onPointerDown = handlers.onPointerDown;
  }
  return createElement(node.tag, props as never, ...node.children.map((child, index) => toReact(child, index, figureRef, handlers)));
}

export function Chart({
  type = 'bar',
  data = { labels: [], series: [] },
  width = 480,
  height = 300,
  colors,
  caption,
  description,
  table = 'hidden',
  interactive = true,
  idPrefix: requestedIdPrefix,
}: ChartProps) {
  const reactId = useId();
  const uniqueId = reactId.replace(/[^A-Za-z0-9_-]/g, '');
  const idPrefix = requestedIdPrefix ? `${requestedIdPrefix}-${uniqueId}` : `mini-chart-${uniqueId}`;
  const figureRef = useRef<HTMLElement>(null);
  const [observedWidth, setObservedWidth] = useState(0);
  const [activePoint, setActivePoint] = useState<{ category: number; series: number } | null>(null);
  const actualWidth = observedWidth || width;
  const options: BuildChartOptions & { idPrefix: string; activePoint: typeof activePoint } = {
    type, data, width: actualWidth, height, colors, caption, description, table, interactive, idPrefix, activePoint,
  };
  const tree = useMemo(() => buildFigure(options), [type, data, actualWidth, height, colors, caption, description, table, interactive, idPrefix, activePoint]);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || typeof ResizeObserver === 'undefined') return undefined;
    const updateWidth = () => {
      const nextWidth = Math.round(figure.getBoundingClientRect().width);
      if (nextWidth > 0) setObservedWidth((previous) => previous === nextWidth ? previous : nextWidth);
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(figure);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActivePoint((point) => clampActive(point, type, data));
  }, [type, data]);

  const handlers = {
    onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
      if (!interactive) return;
      const next = nextPoint(activePoint, event.key, pointDimensions(type, data));
      if (next === undefined) return;
      event.preventDefault();
      setActivePoint(next);
    },
    onPointerMove(event: PointerEvent<SVGSVGElement>) {
      if (!interactive) return;
      const point = pointFromEvent(event.target);
      if (point) setActivePoint(point);
    },
    onPointerDown(event: PointerEvent<SVGSVGElement>) {
      if (!interactive) return;
      const point = pointFromEvent(event.target);
      if (point) setActivePoint(point);
    },
  };

  return toReact(tree, undefined, figureRef, handlers);
}
