import { describe, expect, it } from 'vitest';
import { getRangeMeta, TREND_RANGES } from './trendRange';

describe('TREND_RANGES', () => {
  it('offers all five ranges the UI asks for, in order', () => {
    expect(TREND_RANGES.map((r) => r.key)).toEqual(['1w', '1m', '3m', '6m', '1y']);
  });

  it('marks only the two ranges the dataset can actually back', () => {
    const withRealData = TREND_RANGES.filter((r) => r.hasRealData).map((r) => r.key);
    expect(withRealData).toEqual(['1w', '1m']);
  });
});

describe('getRangeMeta', () => {
  it('falls back to a sane default for an unknown key', () => {
    // @ts-expect-error deliberately invalid input
    expect(getRangeMeta('bogus').key).toBe('1m');
  });

  it('returns the matching entry for every real key', () => {
    for (const range of TREND_RANGES) {
      expect(getRangeMeta(range.key)).toEqual(range);
    }
  });
});
