import { describe, expect, it } from 'vitest';
import { generateTrendSeries, getRangeMeta, TREND_RANGES, type MetricKey, type TrendRange } from './costTrendMock';

const METRICS: MetricKey[] = ['spend', 'ppd', 'delta', 'budget'];
const RANGES: TrendRange[] = ['1w', '1m', '3m', '6m', '1y'];

describe('TREND_RANGES', () => {
  it('offers all five ranges the UI asks for, in order', () => {
    expect(TREND_RANGES.map((r) => r.key)).toEqual(['1w', '1m', '3m', '6m', '1y']);
  });

  it('marks only the two ranges the dataset can actually back', () => {
    const withRealData = TREND_RANGES.filter((r) => r.hasRealData).map((r) => r.key);
    expect(withRealData).toEqual(['1w', '1m']);
  });

  it('falls back to a sane default for an unknown key', () => {
    // @ts-expect-error deliberately invalid input
    expect(getRangeMeta('bogus').key).toBe('1m');
  });
});

describe('generateTrendSeries', () => {
  it('returns the range\'s declared point count for every metric', () => {
    for (const metric of METRICS) {
      for (const range of RANGES) {
        const series = generateTrendSeries(metric, range, 100);
        expect(series, `${metric}/${range}`).toHaveLength(getRangeMeta(range).points);
      }
    }
  });

  it('pins the final point to the real current value, exactly', () => {
    for (const metric of METRICS) {
      for (const range of RANGES) {
        const series = generateTrendSeries(metric, range, 1234.5);
        expect(series[series.length - 1].value, `${metric}/${range}`).toBe(1234.5);
      }
    }
  });

  it('is deterministic: same metric, range, and current value always renders the same shape', () => {
    const a = generateTrendSeries('spend', '1y', 5000);
    const b = generateTrendSeries('spend', '1y', 5000);
    expect(a).toEqual(b);
  });

  it('gives every metric+range pair its own shape, not one series reused everywhere', () => {
    const spend = generateTrendSeries('spend', '6m', 5000).map((p) => p.value);
    const ppd = generateTrendSeries('ppd', '6m', 5000).map((p) => p.value);
    expect(spend).not.toEqual(ppd);
  });

  it('never lets a non-negative metric go negative, however far it walks back', () => {
    for (const metric of ['spend', 'ppd', 'budget'] as const) {
      const series = generateTrendSeries(metric, '1y', 100);
      for (const point of series) expect(point.value, `${metric} ${point.label}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('lets the qualified-delta metric walk into negative territory, since a premium is a real state', () => {
    const series = generateTrendSeries('delta', '1y', -2208);
    expect(series.some((p) => p.value < 0)).toBe(true);
  });

  it('produces no NaN or Infinity at any point', () => {
    for (const metric of METRICS) {
      for (const range of RANGES) {
        for (const point of generateTrendSeries(metric, range, 42)) {
          expect(Number.isFinite(point.value), `${metric}/${range}/${point.label}`).toBe(true);
        }
      }
    }
  });

  it('labels August ranges around the dataset\'s real anchor month', () => {
    const week = generateTrendSeries('spend', '1w', 100);
    expect(week[week.length - 1].label).toBe('Aug 22');
    const month = generateTrendSeries('spend', '1m', 100);
    expect(month.map((p) => p.label)).toEqual(['Aug wk1', 'Aug wk2', 'Aug wk3', 'Aug wk4']);
    const year = generateTrendSeries('spend', '1y', 100);
    expect(year[year.length - 1].label).toBe('Aug');
    expect(year).toHaveLength(12);
  });
});
