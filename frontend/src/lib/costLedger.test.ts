import { describe, expect, it } from 'vitest';
import {
  basketTotals,
  buildBasket,
  ledgerPpd,
  priceLadder,
  SERVICE_FLOOR_PCT,
  spendTrend,
  vendorColumns,
} from './costLedger';
import { getPeriod } from './costPeriod';

const period = getPeriod('aug-2026');
const columns = vendorColumns('HSP-001');
const lines = buildBasket('HSP-001', period);
const totals = basketTotals(lines, columns);

describe('vendorColumns', () => {
  it('qualifies only vendors clearing the on-time floor', () => {
    expect(columns.filter((c) => c.qualified).map((c) => c.vendor.id)).toEqual(['VND-001']);
    for (const column of columns) {
      expect(column.qualified, column.vendor.id).toBe(column.onTimePct >= SERVICE_FLOOR_PCT);
    }
  });

  it('names exactly one contracted vendor and puts it first', () => {
    expect(columns.filter((c) => c.contracted)).toHaveLength(1);
    expect(columns[0].contracted).toBe(true);
    expect(columns[0].vendor.id).toBe('VND-002');
  });

  it('reports how much of the hospice ZIP footprint each vendor actually serves', () => {
    const coverage = Object.fromEntries(columns.map((c) => [c.vendor.id, c.servedZipCount]));
    expect(coverage['VND-001']).toBe(4);
    expect(coverage['VND-002']).toBe(1);
    expect(coverage['VND-003']).toBe(0);
    for (const column of columns) {
      expect(column.patientZipCount, column.vendor.id).toBe(10);
    }
  });
});

describe('buildBasket', () => {
  it('counts the units the hospice actually ordered in the period', () => {
    const units = Object.fromEntries(lines.map((l) => [l.hcpcs, l.units]));
    expect(units).toEqual({
      E1390: 8, E0250: 7, E0143: 7, E1130: 7, E0601: 6,
      E0277: 5, E0431: 5, E0163: 5, A7030: 5, E0100: 5,
    });
  });

  it('splits every line across the period without losing or inventing units', () => {
    for (const line of lines) {
      const bucketed = line.weeklyUnits.reduce((a, b) => a + b, 0);
      expect(bucketed, line.hcpcs).toBe(line.units);
    }
    const weeklyTotals = period.buckets.map((_, i) =>
      lines.reduce((sum, l) => sum + (l.weeklyUnits[i] ?? 0), 0),
    );
    expect(weeklyTotals).toEqual([15, 21, 21, 3]);
  });

  it('prices every line at all three vendors', () => {
    for (const line of lines) {
      expect(line.prices, line.hcpcs).toHaveLength(3);
      for (const cell of line.prices) {
        expect(cell.unitUsd, `${line.hcpcs}/${cell.vendorId}`).not.toBeNull();
        expect(cell.extendedUsd, `${line.hcpcs}/${cell.vendorId}`).not.toBeNull();
      }
    }
  });

  it('marks rentals and purchases from the catalog, never guessing', () => {
    const purchases = lines.filter((l) => l.kind === 'purchase').map((l) => l.hcpcs).sort();
    expect(purchases).toEqual(['A7030', 'E0100', 'E0143', 'E0163']);
  });
});

describe('basketTotals', () => {
  it('prices the basket at each vendor', () => {
    expect(totals.perVendorUsd['VND-001']).toBeCloseTo(5140, 2);
    expect(totals.perVendorUsd['VND-002']).toBeCloseTo(4563.5, 2);
    expect(totals.perVendorUsd['VND-003']).toBeCloseTo(4144, 2);
  });

  it('reports what was actually paid, each order at the vendor that took it', () => {
    expect(totals.actualUsd).toBeCloseTo(4606, 2);
    expect(totals.rentalMonthlyUsd + totals.purchaseUsd).toBeCloseTo(totals.actualUsd, 2);
  });

  it('reports the qualified delta as a signed number, so a premium is never shown as a saving', () => {
    // The only vendor clearing the service floor is also the most expensive: qualifying costs more.
    expect(totals.qualifiedDeltaUsd).toBeCloseTo(4606 - 5140, 2);
    expect(totals.qualifiedDeltaUsd).toBeLessThan(0);
  });

  it('measures every delta against what was actually paid, matching the trend chart', () => {
    for (const line of lines) {
      if (line.bestQualifiedUsd === null) continue;
      expect(line.qualifiedDeltaUsd, line.hcpcs).toBeCloseTo(
        line.actualUsd - line.bestQualifiedUsd,
        2,
      );
    }
    const lineSum = lines.reduce((sum, l) => sum + (l.qualifiedDeltaUsd ?? 0), 0);
    expect(totals.qualifiedDeltaUsd).toBeCloseTo(lineSum, 1);
  });
});

describe('spendTrend', () => {
  const trend = spendTrend(lines, period, columns, 'HSP-001');

  it('returns one bucket per period bucket, summing to the actual spend', () => {
    expect(trend).toHaveLength(4);
    const sum = trend.reduce((a, b) => a + b.actualUsd, 0);
    expect(sum).toBeCloseTo(totals.actualUsd, 1);
  });

  it('flags the bucket that runs past the newest order on file', () => {
    expect(trend.map((b) => b.partial)).toEqual([false, false, false, true]);
  });
});

describe('priceLadder', () => {
  it('ranks vendors cheapest first and tones them by contract and service', () => {
    const line = lines.find((l) => l.hcpcs === 'E0250')!;
    const ladder = priceLadder(line, columns);
    expect(ladder).toHaveLength(3);
    const amounts = ladder.map((r) => r.extendedUsd ?? 0);
    expect([...amounts]).toEqual([...amounts].sort((a, b) => a - b));
    expect(ladder.find((r) => r.vendor.id === 'VND-002')?.tone).toBe('contracted');
    expect(ladder.find((r) => r.vendor.id === 'VND-003')?.tone).toBe('risk');
    expect(ladder.find((r) => r.vendor.id === 'VND-001')?.tone).toBe('best');
    expect(Math.max(...ladder.map((r) => r.widthPct))).toBe(100);
  });
});

describe('ledgerPpd', () => {
  it('divides spend by census times days', () => {
    const ppd = ledgerPpd('HSP-001', totals.actualUsd, period);
    expect(ppd.census).toBe(142);
    expect(ppd.days).toBe(31);
    expect(ppd.ppdUsd).toBeCloseTo(4606 / (142 * 31), 4);
  });

  it('returns zero rather than Infinity for an unknown hospice', () => {
    expect(ledgerPpd('HSP-999', 1000, period).ppdUsd).toBe(0);
  });
});
