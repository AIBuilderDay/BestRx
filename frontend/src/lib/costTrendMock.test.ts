import { describe, expect, it } from 'vitest';
import { generatePpdTrend } from './costTrendMock';
import { TREND_RANGES, type TrendRange } from './trendRange';

const RANGES: TrendRange[] = TREND_RANGES.map((r) => r.key);

describe('generatePpdTrend', () => {
  it('returns the range\'s declared point count', () => {
    for (const range of RANGES) {
      const series = generatePpdTrend(range, 100);
      const meta = TREND_RANGES.find((r) => r.key === range)!;
      expect(series, range).toHaveLength(meta.points);
    }
  });

  it('pins the final point to the real current value, exactly, at every range', () => {
    // PPD is a rate, never partitioned across sub-periods, so this holds everywhere.
    for (const range of RANGES) {
      const series = generatePpdTrend(range, 1234.5);
      expect(series[series.length - 1].value, range).toBe(1234.5);
    }
  });

  it('is deterministic: same range and current value always renders the same shape', () => {
    const a = generatePpdTrend('1y', 5000);
    const b = generatePpdTrend('1y', 5000);
    expect(a).toEqual(b);
  });

  it('never goes negative, however far it walks back', () => {
    for (const range of RANGES) {
      for (const point of generatePpdTrend(range, 100)) {
        expect(point.value, `${range} ${point.label}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('produces no NaN or Infinity at any point', () => {
    for (const range of RANGES) {
      for (const point of generatePpdTrend(range, 42)) {
        expect(Number.isFinite(point.value), `${range}/${point.label}`).toBe(true);
      }
    }
  });

  it('labels August ranges around the dataset\'s real anchor month', () => {
    const week = generatePpdTrend('1w', 100);
    expect(week[week.length - 1].label).toBe('Aug 22');
    const month = generatePpdTrend('1m', 100);
    expect(month.map((p) => p.label)).toEqual(['Aug wk1', 'Aug wk2', 'Aug wk3', 'Aug wk4']);
    const year = generatePpdTrend('1y', 100);
    expect(year[year.length - 1].label).toBe('Aug');
    expect(year).toHaveLength(12);
  });
});
