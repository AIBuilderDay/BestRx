/**
 * Placeholder trend history for Cost per patient-day — the one KPI tile left with no real
 * over-time data. Total Spend now uses real derivations (lib/costLedger.ts:
 * dailySpendTrend/spendTrend); Budget utilization opens a real donut breakdown instead
 * (lib/budgetBreakdown.ts); Potential Savings opens a real vendor ranking instead
 * (lib/vendorSavings.ts). None of those need placeholder history anymore.
 *
 * The dataset holds one month of real orders (Aug 1-22, 2026) - there is no prior month and no
 * multi-month history anywhere in frontend/src/data, so a PPD "history leading up to today" chart
 * across 3mo/6mo/1yr cannot be honestly built from it. Per explicit product direction, this ships
 * anyway using generated placeholder history, with the most recent point pinned to the real current
 * value shown on the tile. Every consumer must visibly label its output as illustrative (see
 * MetricTrendPanel) - this is the one place in the app that intentionally shows a number nothing in
 * the data backs. Swap this module for a real historical series once one exists.
 *
 * PPD is a rate (spend / census / days), not a dollar amount that accumulates over a period, so
 * every range scales the same shared per-range shape toward the real current value - never a
 * partition, since "this week's $/patient-day" is comparable in size to "this month's," not a
 * fraction of it.
 */

import { TREND_RANGES, type TrendRange } from './trendRange';

export interface TrendPoint {
  label: string;
  value: number;
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
 * One relative shape per range: a smoothed random walk of multipliers ending at exactly 1, so
 * scaling by the real current value pins the last point exactly. Cached so repeated calls for the
 * same range don't redo the walk.
 */
function shapeFor(range: TrendRange): number[] {
  const cached = shapeCache.get(range);
  if (cached) return cached;

  const meta = TREND_RANGES.find((r) => r.key === range) ?? TREND_RANGES[1];
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

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Placeholder PPD history for one range, scaled so the final point equals `currentValue` exactly. */
export function generatePpdTrend(range: TrendRange, currentValue: number): TrendPoint[] {
  const meta = TREND_RANGES.find((r) => r.key === range) ?? TREND_RANGES[1];
  const labels = labelsFor(range, meta.points);
  const shape = shapeFor(range);
  return labels.map((label, i) => ({ label, value: round2(shape[i] * currentValue) }));
}
