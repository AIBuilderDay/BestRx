import { describe, expect, it } from 'vitest';
import { aiUsageTotals, aiUsageTrendForRange, formatTokenCount } from './aiUsage';
import { getPeriod } from './costPeriod';

const period = getPeriod('aug-2026');

describe('aiUsageTotals', () => {
  it('sums real AI usage cost, tokens, and requests for visible accounts', () => {
    expect(aiUsageTotals('HSP-001', period, ['USR-001', 'USR-010'])).toEqual({
      costUsd: 18.98,
      tokenCount: 354300,
      requestCount: 10,
    });
  });
});

describe('aiUsageTrendForRange', () => {
  it('returns daily AI spend for the last real week on file', () => {
    const trend = aiUsageTrendForRange('HSP-001', period, '1w', [
      'USR-001',
      'USR-002',
      'USR-010',
      'USR-012',
    ]);
    expect(trend?.map((point) => point.label)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(trend?.map((point) => point.value)).toEqual([4.32, 0.97, 2.61, 3.75, 0.76, 1.96, 1.89]);
  });

  it('returns weekly AI spend for the current month', () => {
    const trend = aiUsageTrendForRange('HSP-001', period, '1m', [
      'USR-001',
      'USR-002',
      'USR-010',
      'USR-012',
    ]);
    expect(trend?.map((point) => point.value)).toEqual([4.86, 2.66, 14.37, 1.89]);
    expect(trend?.[3].partial).toBe(true);
  });

  it('returns null for ranges without real AI history', () => {
    expect(aiUsageTrendForRange('HSP-001', period, '3m')).toBeNull();
  });
});

describe('formatTokenCount', () => {
  it('formats large token counts compactly', () => {
    expect(formatTokenCount(900)).toBe('900');
    expect(formatTokenCount(148000)).toBe('148K');
    expect(formatTokenCount(1250000)).toBe('1.3M');
  });
});
