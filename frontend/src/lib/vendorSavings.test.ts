import { describe, expect, it } from 'vitest';
import { buildBasket, vendorColumns } from './costLedger';
import { getPeriod } from './costPeriod';
import {
  buildProductSavings,
  countGenuineSavings,
  LOCAL_SERVICE_WEIGHT,
  LOSS_FREE_PREMIUM_USD,
  MAX_LOSS_VALUE_PENALTY,
  productVendorOptions,
  RATING_WEIGHT,
  SAVINGS_WEIGHT,
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

  it('recommends the best-value vendor when savings, rating, and service fit are weighed', () => {
    // E0250: the current fixture picks the strongest value option, not merely the incumbent.
    const row = rowFor('E0250');
    expect(row.suggested?.vendor.id).toBe('VND-007');
    expect(row.suggested?.savingsUsd).toBeCloseTo(1129, 0);
  });

  it('never suggests VND-003 for HSP-001 — it reaches none of its patient locations', () => {
    // VND-003's service area is Ogden-area ZIPs; every HSP-001 patient is in Salt Lake City.
    // It would win E0601/E0431 on price alone, but an unreachable vendor isn't a real option.
    for (const row of rows) {
      expect(row.suggested?.vendor.id, row.hcpcs).not.toBe('VND-003');
    }
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

  it('carries value criteria for the hover breakdown', () => {
    // HSP-001's only patient location is Salt Lake City, UT, and VND-001 reaches it.
    const row = rowFor('E0250');
    const suggested = row.suggested;
    expect(suggested).not.toBeNull();
    if (suggested === null) throw new Error('Expected a suggested vendor');
    expect(suggested.servedLocations).toEqual(['Salt Lake City, UT']);
    expect(suggested.unservedLocations).toEqual([]);
    expect(suggested.valueCriteria).toMatchObject({
      savingsScore: 5,
      ratingScore: suggested.rating,
      localServiceScore: 5,
      lossPenalty: expect.any(Number),
    });
  });

  it('every value score lands in 0-100', () => {
    for (const row of rows) {
      if (!row.suggested) continue;
      expect(row.suggested.valueScore, row.hcpcs).toBeGreaterThanOrEqual(0);
      expect(row.suggested.valueScore, row.hcpcs).toBeLessThanOrEqual(100);
    }
  });

  it('weighs savings, vendor rating, and local service fit, summing to 100%', () => {
    expect(SAVINGS_WEIGHT + RATING_WEIGHT + LOCAL_SERVICE_WEIGHT).toBeCloseTo(1, 6);
    expect(SAVINGS_WEIGHT).toBeGreaterThan(RATING_WEIGHT);
    expect(RATING_WEIGHT).toBeGreaterThan(LOCAL_SERVICE_WEIGHT);
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
    expect(totalPotentialSavingsUsd(rows)).toBe(2319);
    expect(countGenuineSavings(rows)).toBe(10);
  });

  it('returns zero for an empty set rather than throwing', () => {
    expect(totalPotentialSavingsUsd([])).toBe(0);
    expect(countGenuineSavings([])).toBe(0);
  });

  it('subtracts savings once the suggested vendor is selected', () => {
    const acceptedVendor = fakeVendor({ id: 'VND-ACCEPTED' });
    const openVendor = fakeVendor({ id: 'VND-OPEN' });
    const acceptedRow: ProductSavingsRow = {
      hcpcs: 'X1111',
      name: 'Accepted Product',
      categoryLabel: 'Test',
      units: 1,
      kind: 'purchase',
      paidUsd: 100,
      paidUnitUsd: 100,
      suggested: {
        vendor: acceptedVendor,
        unitUsd: 70,
        extendedUsd: 70,
        savingsUsd: 30,
        qualified: true,
        onTimePct: 90,
        onTimePickupPct: 90,
        rating: 4,
        ratingCount: 100,
        servedLocations: ['Faketown, UT'],
        unservedLocations: [],
        valueScore: 80,
        valueCriteria: { savingsScore: 3, ratingScore: 4, localServiceScore: 5, lossPenalty: 0 },
      },
    };
    const openRow: ProductSavingsRow = {
      ...acceptedRow,
      hcpcs: 'X2222',
      name: 'Open Product',
      suggested: acceptedRow.suggested ? { ...acceptedRow.suggested, vendor: openVendor, savingsUsd: 20 } : null,
    };

    const rowsWithAccepted = [acceptedRow, openRow];
    const preferredVendors = { X1111: acceptedVendor.id };

    expect(totalPotentialSavingsUsd(rowsWithAccepted, preferredVendors)).toBe(20);
    expect(countGenuineSavings(rowsWithAccepted, preferredVendors)).toBe(1);
  });
});

describe('productVendorOptions', () => {
  it('excludes the contracted vendor and unreachable vendors from the option list', () => {
    const line = lines.find((l) => l.hcpcs === 'E0250')!;
    const options = productVendorOptions(line, columns);
    expect(options.map((o) => o.vendor.id)).toEqual([
      'VND-007',
      'VND-009',
      'VND-008',
      'VND-006',
      'VND-005',
      'VND-001',
    ]);
  });

});

// Synthetic fixtures isolate the scoring formula from what the real dataset happens to contain.
function fakeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'VND-X',
    name: 'Fake Vendor',
    displayName: 'Fake Vendor',
    realVendorId: 'RVND-TEST-X',
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
    sourceUrl: '',
    sourceRetrieved: '',
    simulated: { fields: [], note: 'Synthetic test fixture — not a real supplier.' },
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
    zipCoveragePct: 100,
    servedZipCount: 10,
    patientZipCount: 10,
    servedLocations: ['Faketown, UT'],
    unservedLocations: [],
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
  it('excludes a vendor that reaches none of the hospice\'s patient locations, however it would score', () => {
    const col = fakeColumn({
      vendor: fakeVendor({ id: 'VND-NOCOVER', overallRating: 5 }),
      onTimePct: 100,
      servedLocations: [],
      unservedLocations: ['Faketown, UT'],
    });
    const line = fakeLine({ actualUsd: 1000, prices: [{ vendorId: 'VND-NOCOVER', unitUsd: 80, extendedUsd: 800 }] });
    expect(productVendorOptions(line, [col])).toHaveLength(0);
  });

  it('ranks reachable options best-value first', () => {
    const cols = [
      fakeColumn({ vendor: fakeVendor({ id: 'VND-A', overallRating: 2 }), onTimePct: 60 }),
      fakeColumn({ vendor: fakeVendor({ id: 'VND-B', overallRating: 5 }), onTimePct: 100 }),
    ];
    const line = fakeLine({
      actualUsd: 1000,
      prices: [
        { vendorId: 'VND-A', unitUsd: 80, extendedUsd: 800 },
        { vendorId: 'VND-B', unitUsd: 80, extendedUsd: 800 },
      ],
    });
    const options = productVendorOptions(line, cols);
    expect(options.map((o) => o.vendor.id)).toEqual(['VND-B', 'VND-A']);
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

  it('calibrates $100 savings with a 4.5+ vendor rating to roughly 80 value', () => {
    const col = fakeColumn({ vendor: fakeVendor({ id: 'VND-CALIBRATED', overallRating: 4.6 }) });
    const line = fakeLine({
      actualUsd: 1000,
      prices: [{ vendorId: 'VND-CALIBRATED', unitUsd: 90, extendedUsd: 900 }],
    });
    const [option] = productVendorOptions(line, [col]);
    expect(option.valueCriteria).toMatchObject({
      savingsScore: 3.5,
      ratingScore: 4.6,
      localServiceScore: 5,
      lossPenalty: 0,
    });
    expect(option.valueScore).toBe(80);
  });

  it('keeps a tiny premium near 50 but penalizes a large premium toward 20', () => {
    const col = fakeColumn({ vendor: fakeVendor({ id: 'VND-PREMIUM', overallRating: 4.6 }) });

    const tinyPremiumLine = fakeLine({
      actualUsd: 1000,
      prices: [{ vendorId: 'VND-PREMIUM', unitUsd: 100.5, extendedUsd: 1005 }],
    });
    const [tinyPremium] = productVendorOptions(tinyPremiumLine, [col]);
    expect(tinyPremium.valueCriteria.lossPenalty).toBe(0);
    expect(tinyPremium.valueScore).toBe(50);

    const largePremiumLine = fakeLine({
      actualUsd: 1000,
      prices: [{ vendorId: 'VND-PREMIUM', unitUsd: 200, extendedUsd: 2000 }],
    });
    const [largePremium] = productVendorOptions(largePremiumLine, [col]);
    expect(largePremium.valueCriteria.lossPenalty).toBe(MAX_LOSS_VALUE_PENALTY);
    expect(largePremium.valueScore).toBe(20);
  });

  it('does not penalize premiums within the small-loss tolerance', () => {
    expect(LOSS_FREE_PREMIUM_USD).toBe(5);
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
