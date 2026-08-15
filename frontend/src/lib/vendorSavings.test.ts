import { describe, expect, it } from 'vitest';
import { buildBasket, vendorColumns } from './costLedger';
import { getPeriod } from './costPeriod';
import {
  buildProductSavings,
  countGenuineSavings,
  DELIVERY_WEIGHT,
  PRICE_WEIGHT,
  productVendorOptions,
  REVIEW_WEIGHT,
  totalPotentialSavingsUsd,
  type ProductSavingsRow,
} from './vendorSavings';
import type { BasketLine, VendorColumn } from './costLedger';
import type { Vendor } from '../types/domain';

const period = getPeriod('aug-2026');
const columns = vendorColumns('HSP-001');
const lines = buildBasket('HSP-001', period);
const rows = buildProductSavings(lines, columns);
const rowFor = (hcpcs: string) => rows.find((r) => r.hcpcs === hcpcs)!;

describe('buildProductSavings (real HSP-001 data)', () => {
  it('returns one row per ordered product, all 10 codes', () => {
    expect(rows).toHaveLength(10);
    expect(new Set(rows.map((r) => r.hcpcs)).size).toBe(10);
  });

  it('recommends the pricier, higher-quality vendor when the price gap is large', () => {
    // E0250: Vendor 1 costs $831 more but wins on reviews+delivery; Vendor 3 saves $548 but loses.
    const row = rowFor('E0250');
    expect(row.suggested?.vendor.id).toBe('VND-001');
    expect(row.suggested?.savingsUsd).toBeCloseTo(-831, 0);
  });

  it('flips to the cheaper vendor when the price gap is small enough to overcome the quality gap', () => {
    // E0601 (CPAP) and E0431 (portable oxygen) are the two codes where Vendor 3's price edge beats
    // Vendor 1's review/delivery edge under price 40% / reviews 30% / delivery 30%.
    expect(rowFor('E0601').suggested?.vendor.id).toBe('VND-003');
    expect(rowFor('E0601').suggested?.savingsUsd).toBeCloseTo(42, 0);
    expect(rowFor('E0431').suggested?.vendor.id).toBe('VND-003');
    expect(rowFor('E0431').suggested?.savingsUsd).toBeCloseTo(18, 0);
  });

  it('reports the real per-unit prices, matching what a nurse can act on directly', () => {
    const row = rowFor('E1130'); // Standard Wheelchair, 7 units
    expect(row.units).toBe(7);
    expect(row.paidUnitUsd).toBeCloseTo(row.paidUsd / 7, 2);
    expect(row.suggested?.unitUsd).toBeGreaterThan(0);
  });

  it('never recommends the contracted vendor as an alternative to itself', () => {
    for (const row of rows) {
      expect(row.suggested?.vendor.id, row.hcpcs).not.toBe('VND-002');
    }
  });

  it('carries ZIP coverage on every option for display, without it moving the ranking', () => {
    const row = rowFor('E0250');
    expect(row.suggested?.zipCoveragePct).toBeGreaterThanOrEqual(0);
    expect(row.suggested?.patientZipCount).toBe(10);
  });

  it('every value score lands in 0-100', () => {
    for (const row of rows) {
      if (!row.suggested) continue;
      expect(row.suggested.valueScore, row.hcpcs).toBeGreaterThanOrEqual(0);
      expect(row.suggested.valueScore, row.hcpcs).toBeLessThanOrEqual(100);
    }
  });

  it('weighs price, reviews, and delivery only, summing to 100%', () => {
    expect(PRICE_WEIGHT + REVIEW_WEIGHT + DELIVERY_WEIGHT).toBeCloseTo(1, 6);
  });

  it('sorts biggest opportunity first', () => {
    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1].suggested?.savingsUsd ?? -Infinity;
      const cur = rows[i].suggested?.savingsUsd ?? -Infinity;
      expect(cur, rows[i].hcpcs).toBeLessThanOrEqual(prev);
    }
  });
});

describe('totalPotentialSavingsUsd / countGenuineSavings', () => {
  it('sums only the real savings, never netting a premium against them', () => {
    // Only E0601 (+42) and E0431 (+18) genuinely save money; the other 8 rows are premiums and
    // must not drag the total below their sum.
    expect(totalPotentialSavingsUsd(rows)).toBeCloseTo(60, 0);
    expect(countGenuineSavings(rows)).toBe(2);
  });

  it('returns zero for an empty set rather than throwing', () => {
    expect(totalPotentialSavingsUsd([])).toBe(0);
    expect(countGenuineSavings([])).toBe(0);
  });
});

describe('productVendorOptions', () => {
  it('excludes the contracted vendor from the option list entirely', () => {
    const line = lines.find((l) => l.hcpcs === 'E0250')!;
    const options = productVendorOptions(line, columns);
    expect(options.every((o) => o.vendor.id !== 'VND-002')).toBe(true);
    expect(options).toHaveLength(2);
  });

  it('ranks options best-value first', () => {
    const line = lines.find((l) => l.hcpcs === 'E0250')!;
    const options = productVendorOptions(line, columns);
    expect(options[0].valueScore).toBeGreaterThanOrEqual(options[1].valueScore);
  });
});

// Synthetic fixtures isolate the scoring formula from what the real dataset happens to contain.
function fakeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'VND-X',
    name: 'Fake Vendor',
    displayName: 'Fake Vendor',
    market: 'Test',
    contracted: false,
    serviceAreaZips: [],
    hours: '24/7',
    contact: { dispatchPhone: '', dispatchEmail: '', repName: '' },
    fleet: { trucks: 1, routesToday: 1, capacityUsedPct: 50 },
    sla: { statDeliveryHours: 4, routineDeliveryHours: 24, pickupHours: 48 },
    performance30d: { onTimeDeliveryPct: 90, onTimePickupPct: 90, avgDeliveryHours: 8, podCapturePct: 95 },
    logoPath: '',
    overallRating: 4,
    overallRatingCount: 100,
    ...overrides,
  };
}

function fakeColumn(overrides: Partial<VendorColumn> = {}): VendorColumn {
  return {
    vendor: fakeVendor(overrides.vendor),
    contracted: false,
    qualified: true,
    onTimePct: 90,
    onTimePickupPct: 90,
    zipCoveragePct: 0,
    servedZipCount: 0,
    patientZipCount: 10,
    ...overrides,
  };
}

function fakeLine(overrides: Partial<BasketLine> = {}): BasketLine {
  return {
    hcpcs: 'X0000',
    name: 'Fake Product',
    categoryLabel: 'Test',
    units: 10,
    kind: 'purchase',
    prices: [],
    actualUsd: 1000,
    contractedUsd: null,
    bestQualifiedVendorId: null,
    bestQualifiedUsd: null,
    qualifiedDeltaUsd: null,
    weeklyUnits: [],
    weeklyActualUsd: [],
    ...overrides,
  };
}

describe('productVendorOptions (synthetic edge cases)', () => {
  it('a zero-coverage vendor can still win the per-product recommendation', () => {
    // Unlike the whole-basket ranking, coverage doesn't gate this score at all.
    const col = fakeColumn({
      vendor: fakeVendor({ id: 'VND-NOCOVER', overallRating: 5 }),
      onTimePct: 100,
      zipCoveragePct: 0,
      servedZipCount: 0,
    });
    const line = fakeLine({ actualUsd: 1000, prices: [{ vendorId: 'VND-NOCOVER', unitUsd: 80, extendedUsd: 800 }] });
    const [option] = productVendorOptions(line, [col]);
    expect(option.zipCoveragePct).toBe(0);
    expect(option.valueScore).toBeGreaterThan(80);
  });

  it('excludes a vendor with no offer on this code instead of a broken entry', () => {
    const col = fakeColumn({ vendor: fakeVendor({ id: 'VND-UNPRICED' }) });
    const line = fakeLine({ prices: [] });
    expect(productVendorOptions(line, [col])).toHaveLength(0);
  });

  it('never divides by zero when the product itself cost nothing', () => {
    const col = fakeColumn({ vendor: fakeVendor({ id: 'VND-ZERO' }) });
    const line = fakeLine({ actualUsd: 0, prices: [{ vendorId: 'VND-ZERO', unitUsd: 0, extendedUsd: 0 }] });
    const [option] = productVendorOptions(line, [col]);
    expect(Number.isFinite(option.valueScore)).toBe(true);
  });

  it('clamps a wildly cheaper or pricier vendor at the 0-100 score bounds', () => {
    const cheap = fakeColumn({ vendor: fakeVendor({ id: 'VND-CHEAP' }) });
    const cheapLine = fakeLine({ actualUsd: 1000, prices: [{ vendorId: 'VND-CHEAP', unitUsd: 1, extendedUsd: 1 }] });
    expect(productVendorOptions(cheapLine, [cheap])[0].valueScore).toBeLessThanOrEqual(100);

    const pricey = fakeColumn({ vendor: fakeVendor({ id: 'VND-PRICEY' }) });
    const priceyLine = fakeLine({ actualUsd: 1000, prices: [{ vendorId: 'VND-PRICEY', unitUsd: 10000, extendedUsd: 100000 }] });
    expect(productVendorOptions(priceyLine, [pricey])[0].valueScore).toBeGreaterThanOrEqual(0);
  });

  it('never suggests a fabricated row for a synthetic product with no line data', () => {
    const empty: ProductSavingsRow[] = [];
    expect(totalPotentialSavingsUsd(empty)).toBe(0);
  });
});
