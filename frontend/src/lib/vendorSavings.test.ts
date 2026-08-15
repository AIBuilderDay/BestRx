import { describe, expect, it } from 'vitest';
import { buildBasket, basketTotals, vendorColumns } from './costLedger';
import { getPeriod } from './costPeriod';
import {
  COVERAGE_WEIGHT,
  DELIVERY_WEIGHT,
  PRICE_WEIGHT,
  REVIEW_WEIGHT,
  sortVendorSavings,
  vendorSavingsOptions,
} from './vendorSavings';
import type { BasketTotals, VendorColumn } from './costLedger';
import type { Vendor } from '../types/domain';

const period = getPeriod('aug-2026');
const columns = vendorColumns('HSP-001');
const lines = buildBasket('HSP-001', period);
const totals = basketTotals(lines, columns);
const options = vendorSavingsOptions(totals, columns);

describe('vendorSavingsOptions (real HSP-001 data)', () => {
  it('excludes the contracted vendor and lists every other vendor that prices the basket', () => {
    expect(options.map((o) => o.vendor.id).sort()).toEqual(['VND-001', 'VND-003']);
  });

  it('reports the real dollar delta against what was actually paid', () => {
    const v1 = options.find((o) => o.vendor.id === 'VND-001')!;
    const v3 = options.find((o) => o.vendor.id === 'VND-003')!;
    expect(v1.savingsUsd).toBeCloseTo(15578 - 17786, 1); // a premium
    expect(v1.savingsUsd).toBeLessThan(0);
    expect(v3.savingsUsd).toBeCloseTo(15578 - 14434, 1); // a real saving
    expect(v3.savingsUsd).toBeGreaterThan(0);
  });

  it('weighs the four terms so the weights themselves sum to 100%', () => {
    expect(PRICE_WEIGHT + REVIEW_WEIGHT + DELIVERY_WEIGHT + COVERAGE_WEIGHT).toBeCloseTo(1, 6);
  });

  it('ranks the pricier vendor #1 by value once its zero ZIP coverage drags the cheap one down', () => {
    // The whole point of the "heavy penalty, still listed" design: Vendor 3 is cheaper but serves
    // 0 of this hospice's 10 patient ZIPs, so it must not win Best Value despite the lower price.
    const byValue = sortVendorSavings(options, 'value');
    expect(byValue[0].vendor.id).toBe('VND-001');
    expect(byValue).toHaveLength(2); // never hard-excluded, just ranked low
    expect(byValue[1].vendor.id).toBe('VND-003');
    expect(byValue[1].zipCoveragePct).toBe(0);
  });

  it('never hides a vendor for zero coverage — it is a scoring input, not a filter', () => {
    expect(options.some((o) => o.zipCoveragePct === 0)).toBe(true);
  });

  it('every value score lands in 0-100', () => {
    for (const option of options) {
      expect(option.valueScore, option.vendor.id).toBeGreaterThanOrEqual(0);
      expect(option.valueScore, option.vendor.id).toBeLessThanOrEqual(100);
    }
  });

  it('carries the vendor context a card needs: rating, delivery, coverage', () => {
    const v1 = options.find((o) => o.vendor.id === 'VND-001')!;
    expect(v1.rating).toBe(4.6);
    expect(v1.onTimePct).toBe(94);
    expect(v1.servedZipCount).toBe(4);
    expect(v1.patientZipCount).toBe(10);
  });
});

describe('sortVendorSavings', () => {
  it('price-asc puts the cheaper basket total first', () => {
    const sorted = sortVendorSavings(options, 'price-asc');
    expect(sorted.map((o) => o.vendor.id)).toEqual(['VND-003', 'VND-001']);
  });

  it('price-desc reverses it', () => {
    const sorted = sortVendorSavings(options, 'price-desc');
    expect(sorted.map((o) => o.vendor.id)).toEqual(['VND-001', 'VND-003']);
  });

  it('leaves the source array untouched', () => {
    const before = options.map((o) => o.vendor.id);
    sortVendorSavings(options, 'price-desc');
    expect(options.map((o) => o.vendor.id)).toEqual(before);
  });
});

// Synthetic fixtures below isolate the scoring formula's edge behavior from what the real dataset
// happens to contain — extremes the live data doesn't exercise (a vendor priced exactly at parity,
// a perfect 5-star / 100% record, full ZIP coverage).
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
  const vendor = fakeVendor(overrides.vendor);
  return {
    vendor,
    contracted: false,
    qualified: true,
    onTimePct: 90,
    onTimePickupPct: 90,
    zipCoveragePct: 50,
    servedZipCount: 5,
    patientZipCount: 10,
    ...overrides,
  };
}

function fakeTotals(actualUsd: number, perVendorUsd: Record<string, number | null>): BasketTotals {
  return { actualUsd, rentalMonthlyUsd: 0, purchaseUsd: actualUsd, perVendorUsd };
}

describe('vendorSavingsOptions (synthetic edge cases)', () => {
  it('scores a vendor priced exactly at parity at the score-50 midpoint on price', () => {
    const col = fakeColumn({
      vendor: fakeVendor({ id: 'VND-PAR', overallRating: 3 }),
      onTimePct: 0,
      zipCoveragePct: 0,
    });
    const totals = fakeTotals(1000, { 'VND-PAR': 1000 });
    const [option] = vendorSavingsOptions(totals, [col]);
    // price term alone is 50; review (3 stars -> 50), delivery 0, coverage 0
    expect(option.savingsUsd).toBe(0);
    expect(option.valueScore).toBe(Math.round(50 * PRICE_WEIGHT + 50 * REVIEW_WEIGHT));
  });

  it('clamps a wildly cheaper vendor at the score-100 ceiling rather than overflowing', () => {
    const col = fakeColumn({ vendor: fakeVendor({ id: 'VND-CHEAP' }) });
    const totals = fakeTotals(1000, { 'VND-CHEAP': 1 }); // ~100% cheaper
    const [option] = vendorSavingsOptions(totals, [col]);
    expect(option.valueScore).toBeLessThanOrEqual(100);
    expect(option.valueScore).toBeGreaterThanOrEqual(0);
  });

  it('clamps a wildly pricier vendor at the score-0 floor rather than going negative', () => {
    const col = fakeColumn({ vendor: fakeVendor({ id: 'VND-EXPENSIVE' }) });
    const totals = fakeTotals(1000, { 'VND-EXPENSIVE': 100000 });
    const [option] = vendorSavingsOptions(totals, [col]);
    expect(option.valueScore).toBeGreaterThanOrEqual(0);
  });

  it('gives a 5-star, 100% on-time, full-coverage, cheaper vendor a high score', () => {
    const col = fakeColumn({
      vendor: fakeVendor({ id: 'VND-IDEAL', overallRating: 5 }),
      onTimePct: 100,
      zipCoveragePct: 100,
      servedZipCount: 10,
    });
    const totals = fakeTotals(1000, { 'VND-IDEAL': 800 }); // 20% cheaper
    const [option] = vendorSavingsOptions(totals, [col]);
    expect(option.valueScore).toBeGreaterThan(90);
  });

  it('gives a 1-star, 0% on-time, zero-coverage, pricier vendor a near-bottom score', () => {
    const col = fakeColumn({
      vendor: fakeVendor({ id: 'VND-WORST', overallRating: 1 }),
      onTimePct: 0,
      zipCoveragePct: 0,
      servedZipCount: 0,
    });
    const totals = fakeTotals(1000, { 'VND-WORST': 1200 }); // 20% pricier
    const [option] = vendorSavingsOptions(totals, [col]);
    expect(option.valueScore).toBeLessThan(15);
  });

  it('excludes a vendor with no price for this basket instead of showing a broken entry', () => {
    const col = fakeColumn({ vendor: fakeVendor({ id: 'VND-UNPRICED' }) });
    const totals = fakeTotals(1000, { 'VND-UNPRICED': null });
    expect(vendorSavingsOptions(totals, [col])).toHaveLength(0);
  });

  it('never divides by zero when the basket itself costs nothing', () => {
    const col = fakeColumn({ vendor: fakeVendor({ id: 'VND-ZERO' }) });
    const totals = fakeTotals(0, { 'VND-ZERO': 0 });
    const [option] = vendorSavingsOptions(totals, [col]);
    expect(Number.isFinite(option.valueScore)).toBe(true);
  });
});
