/**
 * Placeholder trend history for the four cost KPI tiles.
 *
 * The dataset holds one month of real orders (Aug 1-22, 2026) - there is no prior month and no
 * multi-month history anywhere in frontend/src/data. A per-tile "history leading up to today"
 * chart across 1wk/1mo/3mo/6mo/1yr ranges cannot be honestly built from it.
 *
 * Per explicit product direction, this ships anyway using generated placeholder history, with the
 * most recent point pinned to the real current KPI value shown in the tile above the chart. Every
 * consumer of this module must visibly label its output as illustrative (see MetricTrendPanel) -
 * this is the one place in the app that intentionally shows a number nothing in the data backs.
 * Swap this module for a real historical series once one exists; nothing else needs to change,
 * since the shape (TrendPoint[]) matches what a real endpoint would return.
 *
 * All four metrics are mechanically related in the real formulas - PPD is spend divided by a
 * constant (census x days), budget utilization is spend divided by a constant (the cap), and the
 * qualified-vendor delta moves with the size of the basket. So every metric for a given range is
 * generated from the SAME underlying relative shape and scaled by that metric's own real current
 * value, rather than each metric randomizing independently. That is what makes the four charts
 * agree with each other - spend rising and budget utilization falling in the same week never
 * happens, because both are the one shape multiplied by a different constant.
 *
 * One more thing has to hold for the numbers to "add up": spend and the qualified-vendor delta are
 * dollar amounts that accumulate over a period, while PPD and budget utilization are rates that
 * don't. At the 1wk/1mo ranges - buckets shorter than the month `currentValue` itself measures -
 * an accumulating metric's points are a partition that SUMS to currentValue (four weeks of spend
 * adding up to the month's total), never four points each independently hovering near the whole
 * month's figure. A rate keeps scaling from the shared shape at every range, since a rate doesn't
 * accumulate across sub-periods - "this week's $/patient-day" is comparable in size to "this
 * month's", not a quarter of it.
 */

export type MetricKey = 'spend' | 'ppd' | 'delta' | 'budget';
export type TrendRange = '1w' | '1m' | '3m' | '6m' | '1y';

export interface TrendPoint {
  label: string;
  value: number;
}

export interface RangeMeta {
  key: TrendRange;
  label: string;
  points: number;
  /** True where the app holds any real data for this range (drives the disabled-pill state). */
  hasRealData: boolean;
}

export const TREND_RANGES: RangeMeta[] = [
  { key: '1w', label: '1wk', points: 7, hasRealData: true },
  { key: '1m', label: '1mo', points: 4, hasRealData: true },
  { key: '3m', label: '3mo', points: 3, hasRealData: false },
  { key: '6m', label: '6mo', points: 6, hasRealData: false },
  { key: '1y', label: '1yr', points: 12, hasRealData: false },
];

export function getRangeMeta(range: TrendRange): RangeMeta {
  return TREND_RANGES.find((r) => r.key === range) ?? TREND_RANGES[1];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The dataset's "today" — August 2026 — anchors every synthetic label so they read as real dates. */
const ANCHOR_MONTH_INDEX = 7; // August, 0-indexed

function labelsFor(range: TrendRange, count: number): string[] {
  if (range === '1w') {
    return Array.from({ length: count }, (_, i) => `Aug ${22 - (count - 1 - i)}`);
  }
  if (range === '1m') {
    return Array.from({ length: count }, (_, i) => `Aug wk${i + 1}`);
  }
  // Monthly ranges: count months ending at August, wrapping back through the prior year.
  return Array.from({ length: count }, (_, i) => {
    const offset = count - 1 - i;
    const monthIndex = (((ANCHOR_MONTH_INDEX - offset) % 12) + 12) % 12;
    return MONTH_NAMES[monthIndex];
  });
}

/** Deterministic PRNG so a given range always renders the same placeholder shape. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedForRange(range: TrendRange): number {
  let hash = 0;
  for (let i = 0; i < range.length; i += 1) hash = (hash * 31 + range.charCodeAt(i)) | 0;
  return hash;
}

const shapeCache = new Map<TrendRange, number[]>();

/**
 * One relative shape per range, shared by every metric: a smoothed random walk of multipliers
 * ending at exactly 1 (so scaling by any metric's real current value pins that metric's last point
 * exactly, with no separate override needed). Cached so repeated calls for the same range - one
 * per metric, every render - don't redo the walk or drift from each other by floating point noise.
 */
function shapeFor(range: TrendRange): number[] {
  const cached = shapeCache.get(range);
  if (cached) return cached;

  const meta = getRangeMeta(range);
  const rand = mulberry32(seedForRange(range));
  const shape: number[] = new Array(meta.points);
  shape[meta.points - 1] = 1;
  for (let i = meta.points - 2; i >= 0; i -= 1) {
    const drift = 1 + (rand() - 0.5) * 0.3; // ±15% step-to-step
    shape[i] = Math.max(0.2, shape[i + 1] * drift); // never collapses to (or through) zero
  }
  shapeCache.set(range, shape);
  return shape;
}

const ACCUMULATES: Record<MetricKey, boolean> = {
  spend: true,
  delta: true,
  ppd: false,
  budget: false,
};

/** Sub-month ranges: each point is a slice of the current month, not its own independent month. */
const isSubMonthRange = (range: TrendRange): boolean => range === '1w' || range === '1m';

/**
 * True when this metric+range pair should partition `currentValue` across its points (they sum to
 * it) rather than each independently scale toward it. Only accumulating dollar metrics, only at
 * sub-month granularity — see the module doc comment for why.
 */
export function partitionsCurrentValue(metric: MetricKey, range: TrendRange): boolean {
  return ACCUMULATES[metric] && isSubMonthRange(range);
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Placeholder history for one KPI tile, scaled from the range's shared shape so it moves in the
 * same relative pattern as the other three metrics at this range.
 *
 * For a rate metric, or an accumulating metric at month-or-longer granularity, the final point
 * equals `currentValue` exactly (the shape ends at 1). For an accumulating metric at sub-month
 * granularity, every point is instead a share of `currentValue` proportional to the shape, so the
 * whole series sums to it - see `partitionsCurrentValue`.
 */
export function generateTrendSeries(
  metric: MetricKey,
  range: TrendRange,
  currentValue: number,
): TrendPoint[] {
  const meta = getRangeMeta(range);
  const labels = labelsFor(range, meta.points);
  const shape = shapeFor(range);

  if (partitionsCurrentValue(metric, range)) {
    const shapeSum = shape.reduce((sum, s) => sum + s, 0);
    return labels.map((label, i) => ({ label, value: round2((shape[i] / shapeSum) * currentValue) }));
  }

  return labels.map((label, i) => ({ label, value: round2(shape[i] * currentValue) }));
}
