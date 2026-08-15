import { describe, expect, it } from 'vitest';
import {
  generateTrendSeries,
  getRangeMeta,
  partitionsCurrentValue,
  TREND_RANGES,
  type MetricKey,
  type TrendRange,
} from './costTrendMock';

const METRICS: MetricKey[] = ['spend', 'ppd', 'delta', 'budget'];
const RANGES: TrendRange[] = ['1w', '1m', '3m', '6m', '1y'];
const RATE_METRICS: MetricKey[] = ['ppd', 'budget'];
const ACCUMULATING_METRICS: MetricKey[] = ['spend', 'delta'];
const MONTHLY_OR_LONGER: TrendRange[] = ['3m', '6m', '1y'];

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

describe('partitionsCurrentValue', () => {
  it('only partitions an accumulating dollar metric at sub-month granularity', () => {
    for (const metric of METRICS) {
      for (const range of RANGES) {
        const expected = ACCUMULATING_METRICS.includes(metric) && (range === '1w' || range === '1m');
        expect(partitionsCurrentValue(metric, range), `${metric}/${range}`).toBe(expected);
      }
    }
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

  it('sums an accumulating metric\'s sub-month buckets to the real month total, never each near it', () => {
    // The bug this guards: 4 "weekly" spend points each independently near the monthly total would
    // imply a month several times larger than the figure on the tile above.
    for (const metric of ACCUMULATING_METRICS) {
      for (const range of ['1w', '1m'] as const) {
        const series = generateTrendSeries(metric, range, 15578);
        const sum = series.reduce((total, p) => total + p.value, 0);
        expect(sum, `${metric}/${range}`).toBeCloseTo(15578, 0);
        // No single bucket should itself be anywhere near the whole month's figure.
        for (const point of series) expect(Math.abs(point.value)).toBeLessThan(15578 * 0.8);
      }
    }
  });

  it('pins the final point to the real current value for every non-partitioned metric+range', () => {
    for (const metric of METRICS) {
      for (const range of RANGES) {
        if (partitionsCurrentValue(metric, range)) continue;
        const series = generateTrendSeries(metric, range, 1234.5);
        expect(series[series.length - 1].value, `${metric}/${range}`).toBe(1234.5);
      }
    }
  });

  it('keeps a rate metric scaling toward the current value at every range, never partitioning it', () => {
    for (const metric of RATE_METRICS) {
      for (const range of RANGES) {
        expect(partitionsCurrentValue(metric, range), `${metric}/${range}`).toBe(false);
      }
    }
  });

  it('is deterministic: same metric, range, and current value always renders the same shape', () => {
    const a = generateTrendSeries('spend', '1y', 5000);
    const b = generateTrendSeries('spend', '1y', 5000);
    expect(a).toEqual(b);
  });

  it('moves every metric in the same relative shape at monthly-or-longer ranges', () => {
    // Real PPD is spend divided by a constant, so if the placeholder data is honest about that
    // relationship, spend[i]/ppd[i] must be the same ratio at every point in the series - spend
    // rising while PPD falls in the same month would be nonsense. This only holds where both
    // metrics take the plain shape-scaling path (rates always; accumulating metrics once the
    // bucket period reaches a full month).
    for (const range of MONTHLY_OR_LONGER) {
      const spend = generateTrendSeries('spend', range, 15578).map((p) => p.value);
      const ppd = generateTrendSeries('ppd', range, 3.54).map((p) => p.value);
      // Each metric's own value is independently rounded to 2dp, so the ratio has a little
      // rounding noise - real, but tiny relative to a ~4,400 ratio.
      const ratios = spend.map((s, i) => s / ppd[i]);
      for (const ratio of ratios) {
        expect(Math.abs(ratio - ratios[0]) / ratios[0], range).toBeLessThan(0.01);
      }
    }
  });

  it('still gives each metric its own units, scaled from the shared shape', () => {
    const spend = generateTrendSeries('spend', '6m', 5000).map((p) => p.value);
    const budget = generateTrendSeries('budget', '6m', 80).map((p) => p.value);
    expect(spend).not.toEqual(budget);
  });

  it('never lets a non-negative metric go negative, however far it walks back', () => {
    for (const metric of ['spend', 'ppd', 'budget'] as const) {
      for (const range of RANGES) {
        const series = generateTrendSeries(metric, range, 100);
        for (const point of series) expect(point.value, `${metric}/${range} ${point.label}`).toBeGreaterThanOrEqual(0);
      }
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
