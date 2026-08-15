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

/** Deterministic PRNG so a given metric+range always renders the same placeholder series. */
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

function seedFor(metric: MetricKey, range: TrendRange): number {
  const key = `${metric}:${range}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return hash;
}

const CLAMPS: Record<MetricKey, { min: number; allowNegative: boolean }> = {
  spend: { min: 0, allowNegative: false },
  ppd: { min: 0, allowNegative: false },
  delta: { min: -Infinity, allowNegative: true },
  budget: { min: 0, allowNegative: false },
};

/**
 * Placeholder history for one KPI tile. The final point equals `currentValue` (the real, already-
 * displayed figure); every earlier point is a smoothed random walk backward from it, seeded so the
 * same metric+range always renders the same illustrative shape.
 */
export function generateTrendSeries(
  metric: MetricKey,
  range: TrendRange,
  currentValue: number,
): TrendPoint[] {
  const meta = getRangeMeta(range);
  const labels = labelsFor(range, meta.points);
  const rand = mulberry32(seedFor(metric, range));
  const clamp = CLAMPS[metric];

  const values: number[] = new Array(meta.points);
  values[meta.points - 1] = currentValue;
  for (let i = meta.points - 2; i >= 0; i -= 1) {
    const drift = 1 + (rand() - 0.5) * 0.3; // ±15% step-to-step
    let next = values[i + 1] * drift;
    if (!clamp.allowNegative) next = Math.max(clamp.min, next);
    values[i] = next;
  }

  return labels.map((label, i) => ({ label, value: Math.round(values[i] * 100) / 100 }));
}
