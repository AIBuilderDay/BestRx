/**
 * Chart geometry. Pure maths in SVG user units — no DOM, no refs, no measurement.
 *
 * Keeping every coordinate in viewBox space is what lets the trend chart scale with CSS and
 * position its tooltip in percentages, so it needs no resize listener.
 */

export interface NiceScale {
  step: number;
  /** Top gridline — always >= the data max. */
  top: number;
  ticks: number[];
}

/** Snaps an axis to round numbers, so ticks read $2k / $4k rather than $1,847 / $3,694. */
export function niceScale(max: number, tickCount = 4): NiceScale {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const rough = safeMax / tickCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const nice = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].find((n) => n >= normalized) ?? 10;
  const step = nice * magnitude;
  const top = step * tickCount;
  return { step, top, ticks: Array.from({ length: tickCount + 1 }, (_, i) => i * step) };
}

export interface PlotBox {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Matches the mockup's trend chart viewBox and margins. */
export const TREND_BOX: PlotBox = { width: 900, height: 240, left: 62, right: 16, top: 14, bottom: 30 };

export interface Point {
  x: number;
  y: number;
}

export function xAt(box: PlotBox, index: number, count: number): number {
  const span = box.width - box.left - box.right;
  if (count <= 1) return box.left + span / 2;
  return box.left + (span * index) / (count - 1);
}

export function yAt(box: PlotBox, value: number, top: number): number {
  const span = box.height - box.top - box.bottom;
  if (top <= 0) return box.height - box.bottom;
  const clamped = Math.max(0, Math.min(value, top));
  return box.height - box.bottom - (span * clamped) / top;
}

export function toPoints(box: PlotBox, values: number[], top: number): Point[] {
  return values.map((value, i) => ({ x: xAt(box, i, values.length), y: yAt(box, value, top) }));
}

export function linePath(points: Point[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

export function areaPath(points: Point[], baselineY: number): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L${last.x.toFixed(1)} ${baselineY.toFixed(1)} L${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

/** The filled gap between two series — the delta, made visible. */
export function bandPath(upper: Point[], lower: Point[]): string {
  if (upper.length === 0 || lower.length !== upper.length) return '';
  const back = [...lower].reverse();
  return `${linePath(upper)} ${back.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')} Z`;
}

/** Invisible full-height hover/focus targets, one per bucket, clamped to the plot area. */
export function hitBands(box: PlotBox, count: number): { x: number; width: number }[] {
  if (count <= 0) return [];
  const leftEdge = box.left;
  const rightEdge = box.width - box.right;
  return Array.from({ length: count }, (_, i) => {
    const center = xAt(box, i, count);
    const half = (rightEdge - leftEdge) / Math.max(count - 1, 1) / 2;
    const start = Math.max(leftEdge, center - half);
    const end = Math.min(rightEdge, center + half);
    return { x: start, width: Math.max(0, end - start) };
  });
}

export interface SparkGeometry {
  d: string;
  last: Point;
  direction: 'rising' | 'falling' | 'flat';
  /**
   * False when there is too little movement to read as a trend. A flat line implying steady spend
   * would be a fabricated fact, so the caller renders a dash instead.
   */
  usable: boolean;
}

export function sparklineGeometry(values: number[], w: number, h: number, pad: number): SparkGeometry {
  const nonZero = values.filter((v) => v > 0).length;
  // Span is measured across the values themselves, not against a zero baseline: an all-equal
  // series has no span and must not read as a trend.
  const min = values.length === 0 ? 0 : Math.min(...values);
  const max = values.length === 0 ? 0 : Math.max(...values);
  const span = max - min;
  const points: Point[] = values.map((value, i) => ({
    x: values.length <= 1 ? w / 2 : (i / (values.length - 1)) * w,
    y: span === 0 ? h / 2 : h - pad - ((value - min) / span) * (h - pad * 2),
  }));
  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  return {
    d: linePath(points),
    last: points[points.length - 1] ?? { x: w, y: h / 2 },
    direction: last > first ? 'rising' : last < first ? 'falling' : 'flat',
    usable: values.length > 1 && nonZero >= 2 && span > 0,
  };
}
