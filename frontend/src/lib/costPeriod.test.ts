import { describe, expect, it } from 'vitest';
import { bucketIndexFor, COST_PERIODS, getPeriod, periodContains } from './costPeriod';

const period = getPeriod('aug-2026');

describe('getPeriod', () => {
  it('falls back to the default rather than throwing on an unknown key', () => {
    expect(getPeriod('nope').key).toBe(period.key);
    expect(getPeriod(undefined).key).toBe(period.key);
    expect(getPeriod(null).key).toBe(period.key);
  });

  it('exposes one period, because the dataset holds one month of orders', () => {
    expect(COST_PERIODS).toHaveLength(1);
    expect(period.days).toBe(31);
    expect(period.months).toBe(1);
  });
});

describe('buckets', () => {
  it('tiles the whole month so no order can fall outside one', () => {
    expect(period.buckets).toHaveLength(4);
    expect(period.buckets[0].startIso).toBe(period.startIso);
    expect(period.buckets[period.buckets.length - 1].endIso).toBe(period.endIso);
    for (let i = 1; i < period.buckets.length; i += 1) {
      expect(period.buckets[i].startIso).toBe(period.buckets[i - 1].endIso);
    }
  });

  it('places a timestamp in the right bucket regardless of its time or offset', () => {
    expect(bucketIndexFor(period, '2026-08-01T00:00:00-06:00')).toBe(0);
    expect(bucketIndexFor(period, '2026-08-07T23:59:00-06:00')).toBe(0);
    expect(bucketIndexFor(period, '2026-08-08T00:00:00-06:00')).toBe(1);
    expect(bucketIndexFor(period, '2026-08-21T12:00:00-06:00')).toBe(2);
    expect(bucketIndexFor(period, '2026-08-31T23:00:00-06:00')).toBe(3);
  });

  it('returns -1 for anything outside the period or unparseable', () => {
    for (const iso of ['2026-07-31', '2026-09-01', 'not-a-date', '', undefined, null]) {
      expect(bucketIndexFor(period, iso), String(iso)).toBe(-1);
    }
  });
});

describe('periodContains', () => {
  it('includes the first day and excludes the first day of the next month', () => {
    expect(periodContains(period, '2026-08-01T00:00:00-06:00')).toBe(true);
    expect(periodContains(period, '2026-08-31T23:59:00-06:00')).toBe(true);
    expect(periodContains(period, '2026-09-01T00:00:00-06:00')).toBe(false);
    expect(periodContains(period, '2026-07-31T23:59:00-06:00')).toBe(false);
  });

  it('treats missing and malformed timestamps as outside', () => {
    expect(periodContains(period, undefined)).toBe(false);
    expect(periodContains(period, 'garbage')).toBe(false);
  });
});
