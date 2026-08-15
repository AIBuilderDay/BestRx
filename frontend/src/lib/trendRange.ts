/**
 * The 1wk/1mo/3mo/6mo/1yr range picker shared by every "over time" panel on the cost dashboard —
 * Total Spend (real data) and Cost per patient-day (placeholder, see costTrendMock.ts). Neutral
 * metadata only: how many points a range has, and whether the dataset actually has history for it.
 */

export type TrendRange = '1w' | '1m' | '3m' | '6m' | '1y';

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
