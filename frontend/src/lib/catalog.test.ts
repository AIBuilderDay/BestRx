import { describe, expect, it } from 'vitest';
import { equipmentCatalog, patients, vendors } from '../data/db';
import { resetSnapshot } from '../data/store';
import { seedFixtures } from '../data/testSnapshot';
import {
  buildCartGroups,
  buildCatalogItems,
  catalogFilterOptions,
  CATEGORY_LABELS,
  filterAndSortCatalog,
  itemPrice,
  moneyLabel,
  offerPrice,
  ownersOf,
  paginateCatalog,
  patientOwnsEquipment,
  priceCeiling,
  projectedOrderCount,
  rescaleMaxPrice,
  searchCatalog,
  setCartLineQty,
  cartTotals,
  offerPriceFor,
  upsertCartLine,
  type CartLine,
} from './catalog';
import { vendorOffers } from '../data/db';

describe('itemPrice', () => {
  it('uses the monthly allowed rate for rentals', () => {
    const bed = equipmentCatalog().find((e) => e.hcpcs === 'E0250')!;
    expect(itemPrice(bed)).toEqual({ amount: 65.47, unit: '/mo' });
  });

  it('uses the purchase allowed rate for non-rentals', () => {
    const walker = equipmentCatalog().find((e) => e.hcpcs === 'E0143')!;
    expect(itemPrice(walker)).toEqual({ amount: 64.17, unit: 'one-time' });
  });
});

describe('buildCatalogItems', () => {
  const items = buildCatalogItems();

  it('creates one storefront card per vendor offer row', () => {
    expect(items).toHaveLength(16);
    expect(new Set(items.map((it) => it.offer.id)).size).toBe(16);
  });

  it('lists three separate hospital beds from three vendors', () => {
    const beds = items.filter((it) => it.offer.hcpcs === 'E0250');
    expect(beds).toHaveLength(3);
    expect(new Set(beds.map((it) => it.vendor.id)).size).toBe(3);
    expect(new Set(beds.map((it) => it.offer.imagePath)).size).toBe(3);
  });

  it('reads price, vendor label, and item rating from JSON', () => {
    const bed = items.find((it) => it.offer.id === 'OFR-001')!;
    // Built in the default rent mode, so a bed that is both rented and sold shows its rental rate.
    expect(bed.price).toEqual({ amount: 130, unit: '/mo' });
    expect(buildCatalogItems([], 'buy').find((it) => it.offer.id === 'OFR-001')!.price).toEqual({
      amount: 1045,
      unit: 'one-time',
    });
    expect(bed.vendor.displayName).toBe('Vendor 1');
    expect(bed.offer.deliveryLeadDays).toBe(1);
    expect(bed.offer.productName).toBe('Hospital Bed');
    expect(bed.rating).not.toBeNull();
    expect(bed.rating!.count).toBeGreaterThan(0);
    expect(bed.rating!.average).toBeGreaterThanOrEqual(1);
  });
});

describe('offerPrice', () => {
  it('maps offer unit fields to display units', () => {
    const items = buildCatalogItems();
    const walker = items.find((it) => it.offer.id === 'OFR-015')!;
    expect(offerPrice(walker.offer)).toEqual({ amount: 55, unit: 'one-time' });
  });

  it('maps a monthly rental offer to the /mo unit', () => {
    const items = buildCatalogItems();
    const concentrator = items.find((it) => it.offer.id === 'OFR-002')!;
    expect(offerPrice(concentrator.offer)).toEqual({ amount: 124.5, unit: '/mo' });
  });
});

describe('patientOwnsEquipment / ownersOf', () => {
  it('is true for a patient with a non-terminal order carrying that code', () => {
    expect(patientOwnsEquipment('PT-88421', 'E0250')).toBe(true);
  });

  it('is false once the equipment has been picked back up', () => {
    expect(patientOwnsEquipment('PT-87602', 'E0250')).toBe(false);
  });

  it('is false for an unrelated code', () => {
    expect(patientOwnsEquipment('PT-88421', 'E1390')).toBe(false);
  });

  it('filters a patient pool down to owners', () => {
    const owners = ownersOf('E0250', patients()).map((p) => p.id);
    expect(owners).toContain('PT-88421');
    expect(owners).not.toContain('PT-87602');
  });
});

describe('priceCeiling', () => {
  it('rounds up past the most expensive offer', () => {
    const items = buildCatalogItems();
    expect(priceCeiling(items)).toBeGreaterThanOrEqual(Math.max(...items.map((it) => it.price.amount)));
  });
});

describe('filterAndSortCatalog', () => {
  const items = buildCatalogItems();

  it('filters by category from the offer row', () => {
    const result = filterAndSortCatalog(items, {
      category: 'respiratory',
      vendorIds: [],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'featured',
    });
    expect(result.every((it) => it.offer.category === 'respiratory')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters to a single vendor without lumping multiple vendors on one card', () => {
    const result = filterAndSortCatalog(items, {
      category: 'All',
      vendorIds: ['VND-001'],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'featured',
    });
    expect(result.every((it) => it.vendor.id === 'VND-001')).toBe(true);
    expect(result.filter((it) => it.offer.hcpcs === 'E0250')).toHaveLength(1);
  });

  it('sorts by price ascending', () => {
    const result = filterAndSortCatalog(items, {
      category: 'All',
      vendorIds: [],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'price',
    });
    const amounts = result.map((it) => it.price.amount);
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it('sorts by deliveryLeadDays from the offer row', () => {
    const result = filterAndSortCatalog(items, {
      category: 'All',
      vendorIds: [],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'speed',
    });
    const leadDays = result.map((it) => it.offer.deliveryLeadDays);
    expect(leadDays).toEqual([...leadDays].sort((a, b) => a - b));
  });
});

describe('catalogFilterOptions', () => {
  const items = buildCatalogItems();
  const filters = {
    category: 'respiratory' as const,
    vendorIds: [],
    speed: 'any' as const,
    maxPrice: 10_000,
    sort: 'featured' as const,
  };

  it('updates category counts when a vendor is selected', () => {
    const unfiltered = catalogFilterOptions(items, {
      category: 'All',
      vendorIds: [],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'featured',
    }, vendors());
    const withVendor = catalogFilterOptions(items, {
      category: 'All',
      vendorIds: ['VND-001'],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'featured',
    }, vendors());

    const respiratoryAll = unfiltered.categories.find((c) => c.key === 'respiratory')!.count;
    const respiratoryVendor1 = withVendor.categories.find((c) => c.key === 'respiratory')!.count;
    expect(respiratoryVendor1).toBeLessThanOrEqual(respiratoryAll);
  });

  it('updates vendor counts when a category is selected', () => {
    const options = catalogFilterOptions(items, filters, vendors());
    const vendor1Respiratory = options.vendors.find((v) => v.id === 'VND-001')!.count;
    const vendor1All = catalogFilterOptions(items, {
      category: 'All',
      vendorIds: [],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'featured',
    }, vendors()).vendors.find((v) => v.id === 'VND-001')!.count;
    expect(vendor1Respiratory).toBeLessThanOrEqual(vendor1All);
  });

  it('keeps every category and vendor listed even when a filter zeroes them out', () => {
    // A $1 ceiling matches no offer at all, so every count lands on zero.
    const options = catalogFilterOptions(items, { ...filters, maxPrice: 1 }, vendors());
    expect(options.categories.map((c) => c.key)).toEqual(['All', ...Object.keys(CATEGORY_LABELS)]);
    expect(options.vendors.map((v) => v.id)).toEqual(vendors().map((v) => v.id));
    expect(options.categories.every((c) => c.count === 0)).toBe(true);
    expect(options.vendors.every((v) => v.count === 0)).toBe(true);
  });
});

describe('moneyLabel', () => {
  it('formats with a dollar sign and thousands separator', () => {
    expect(moneyLabel(1234)).toBe('$1,234');
  });
});

describe('paginateCatalog', () => {
  const items = Array.from({ length: 65 }, (_, index) => `item-${index + 1}`);

  it('returns no more than 30 items for a catalog page', () => {
    expect(paginateCatalog(items, 2)).toEqual({
      items: items.slice(30, 60),
      page: 2,
      totalPages: 3,
      firstItem: 31,
      lastItem: 60,
    });
  });

  it('clamps a page past the filtered results to the final available page', () => {
    expect(paginateCatalog(items, 9)).toEqual({
      items: items.slice(60),
      page: 3,
      totalPages: 3,
      firstItem: 61,
      lastItem: 65,
    });
  });
});

describe('searchCatalog', () => {
  const items = buildCatalogItems();

  it('returns all items for an empty or whitespace query', () => {
    expect(searchCatalog(items, '')).toHaveLength(items.length);
    expect(searchCatalog(items, '   ')).toHaveLength(items.length);
  });

  it('matches product names case-insensitively', () => {
    const results = searchCatalog(items, 'HOSPITAL BED');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((it) => /hospital bed/i.test(it.offer.productName))).toBe(true);
  });

  it('matches vendor display names', () => {
    const vendorName = items[0]!.vendor.displayName;
    const results = searchCatalog(items, vendorName);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((it) => it.vendor.displayName === vendorName)).toBe(true);
  });

  it('requires every word in the query to match', () => {
    expect(searchCatalog(items, 'hospital zzzznope')).toHaveLength(0);
  });
});

describe('projectedOrderCount', () => {
  const items = buildCatalogItems();
  const [patientA, patientB] = patients();

  /** An offer id from a vendor other than the first, so a split can actually be observed. */
  const offerFrom = (vendorId: string) => items.find((it) => it.vendor.id === vendorId)!.offer.id;
  const vendorIds = [...new Set(items.map((it) => it.vendor.id))];

  it('counts nothing for an empty cart', () => {
    expect(projectedOrderCount([], items)).toBe(0);
  });

  it('groups one patient buying from one vendor into a single order', () => {
    const [first, second] = items.filter((it) => it.vendor.id === vendorIds[0]);
    const lines = [
      { offerId: first.offer.id, patientId: patientA.id, unit: 'month' as const, qty: 1 },
      { offerId: second.offer.id, patientId: patientA.id, unit: 'month' as const, qty: 2 },
    ];
    expect(projectedOrderCount(lines, items)).toBe(1);
  });

  it('splits one patient across two vendors into two orders', () => {
    const lines = [
      { offerId: offerFrom(vendorIds[0]), patientId: patientA.id, unit: 'month' as const, qty: 1 },
      { offerId: offerFrom(vendorIds[1]), patientId: patientA.id, unit: 'month' as const, qty: 1 },
    ];
    expect(projectedOrderCount(lines, items)).toBe(2);
  });

  it('splits the same vendor across two patients into two orders', () => {
    const lines = [
      { offerId: offerFrom(vendorIds[0]), patientId: patientA.id, unit: 'month' as const, qty: 1 },
      { offerId: offerFrom(vendorIds[0]), patientId: patientB.id, unit: 'month' as const, qty: 1 },
    ];
    expect(projectedOrderCount(lines, items)).toBe(2);
  });

  it('ignores a line whose offer is not in the catalog', () => {
    const lines = [{ offerId: 'OFR-does-not-exist', patientId: patientA.id, unit: 'month' as const, qty: 1 }];
    expect(projectedOrderCount(lines, items)).toBe(0);
  });
});

describe('buildCatalogItems timing', () => {
  /**
   * Regression: CartContext used to call buildCatalogItems() at module load, before DataProvider
   * had fetched the snapshot. That cached [] forever, and buildCartGroups silently dropped every
   * cart line because no offer matched. Callers must build it after the snapshot is populated.
   */
  it('returns nothing when the snapshot has not loaded yet', () => {
    resetSnapshot();
    expect(buildCatalogItems()).toHaveLength(0);

    seedFixtures();
    expect(buildCatalogItems().length).toBeGreaterThan(0);
  });

  it('drops cart lines when built against an empty snapshot', () => {
    const line = [{ offerId: 'OFR-003', patientId: patients()[0].id, unit: 'month' as const, qty: 1 }];
    const populated = buildCatalogItems();

    resetSnapshot();
    const stale = buildCatalogItems();
    seedFixtures();

    expect(buildCartGroups(line, stale, patients())).toHaveLength(0);
    expect(buildCartGroups(line, populated, patients())).toHaveLength(1);
  });
});

describe('rent versus buy pricing', () => {
  const offer = (id: string) => vendorOffers().find((o) => o.id === id)!;

  it('prices an offer under whichever arrangement is asked for', () => {
    // OFR-003: a wheelchair Vendor 1 both rents and sells.
    const wheelchair = offer('OFR-003');
    expect(offerPriceFor(wheelchair, 'month')).toEqual({ amount: 70, unit: '/mo' });
    expect(offerPriceFor(wheelchair, 'purchase')).toEqual({ amount: 280, unit: 'one-time' });
  });

  it('falls back to the arrangement a single-price offer does sell', () => {
    // OFR-005 is a walker: bought outright, never rented. Asking to rent it must still price it
    // rather than returning nothing, so the card can show it with a "Purchase only" tag.
    const walker = offer('OFR-005');
    expect(walker.rentalPriceUsd).toBeUndefined();
    expect(offerPriceFor(walker, 'month')).toEqual({ amount: 68, unit: 'one-time' });
  });

  it('marks which arrangements each offer actually sells', () => {
    const rentAndBuy = buildCatalogItems([], 'rent').find((it) => it.offer.id === 'OFR-003')!;
    const buyOnly = buildCatalogItems([], 'rent').find((it) => it.offer.id === 'OFR-005')!;
    expect(rentAndBuy.availableUnits).toEqual(['month', 'purchase']);
    expect(buyOnly.availableUnits).toEqual(['purchase']);
  });

  it('raises the price ceiling when the catalog switches to purchase prices', () => {
    const rentCeiling = priceCeiling(buildCatalogItems([], 'rent'));
    const buyCeiling = priceCeiling(buildCatalogItems([], 'buy'));
    expect(buyCeiling).toBeGreaterThan(rentCeiling);
  });

  it('keeps a max-price filter at the same fraction of a rescaled ceiling', () => {
    expect(rescaleMaxPrice(50, 100, 1000)).toBe(500);
    // A filter left wide open stays wide open rather than snapping to a fraction.
    expect(rescaleMaxPrice(100, 100, 1000)).toBe(1000);
  });
});

describe('cart lines carry their arrangement', () => {
  const patientId = 'PT-001';

  it('keeps a rented and a bought line of one offer apart', () => {
    let lines: CartLine[] = [];
    lines = upsertCartLine(lines, 'OFR-003', patientId, 'month', 1);
    lines = upsertCartLine(lines, 'OFR-003', patientId, 'purchase', 1);
    expect(lines).toHaveLength(2);
  });

  it('merges quantities only within the same arrangement', () => {
    let lines: CartLine[] = [];
    lines = upsertCartLine(lines, 'OFR-003', patientId, 'month', 1);
    lines = upsertCartLine(lines, 'OFR-003', patientId, 'month', 2);
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(3);
  });

  it('removes only the arrangement whose quantity went to zero', () => {
    let lines: CartLine[] = [
      { offerId: 'OFR-003', patientId, unit: 'month', qty: 1 },
      { offerId: 'OFR-003', patientId, unit: 'purchase', qty: 1 },
    ];
    lines = setCartLineQty(lines, 'OFR-003', patientId, 'month', 0);
    expect(lines).toHaveLength(1);
    expect(lines[0].unit).toBe('purchase');
  });

  it('totals a rented and a bought line into their own buckets', () => {
    const items = buildCatalogItems();
    const lines: CartLine[] = [
      { offerId: 'OFR-003', patientId, unit: 'month', qty: 1 },
      { offerId: 'OFR-003', patientId, unit: 'purchase', qty: 1 },
    ];
    const totals = cartTotals(lines, items);
    expect(totals.monthly).toBe(70);
    expect(totals.oneTime).toBe(280);
  });
});
