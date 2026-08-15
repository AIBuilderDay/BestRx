import { describe, expect, it } from 'vitest';
import { equipmentCatalog, patients, vendorOffers, vendors } from '../data/db';
import {
  buildCatalogItems,
  catalogFilterOptions,
  filterAndSortCatalog,
  itemPrice,
  moneyLabel,
  offerPrice,
  ownersOf,
  paginateCatalog,
  patientOwnsEquipment,
  priceCeiling,
  searchCatalog,
} from './catalog';

describe('itemPrice', () => {
  it('uses the monthly allowed rate for rentals', () => {
    const bed = equipmentCatalog.find((e) => e.hcpcs === 'E0250')!;
    expect(itemPrice(bed)).toEqual({ amount: 65.47, unit: '/mo' });
  });

  it('uses the purchase allowed rate for non-rentals', () => {
    const walker = equipmentCatalog.find((e) => e.hcpcs === 'E0143')!;
    expect(itemPrice(walker)).toEqual({ amount: 64.17, unit: 'one-time' });
  });
});

describe('buildCatalogItems', () => {
  const items = buildCatalogItems();

  it('creates one storefront card per vendor offer row', () => {
    expect(items).toHaveLength(vendorOffers.length);
    expect(new Set(items.map((it) => it.offer.id)).size).toBe(vendorOffers.length);
  });

  it('lists three separate hospital beds from three vendors', () => {
    const beds = items.filter((it) => it.offer.hcpcs === 'E0250');
    expect(beds).toHaveLength(3);
    expect(new Set(beds.map((it) => it.vendor.id)).size).toBe(3);
    expect(new Set(beds.map((it) => it.offer.imagePath)).size).toBe(3);
  });

  it('reads price, vendor label, and item rating from JSON', () => {
    const bed = items.find((it) => it.offer.id === 'OFR-001')!;
    expect(bed.price).toEqual({ amount: 1045, unit: 'one-time' });
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
    const owners = ownersOf('E0250', patients).map((p) => p.id);
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
    }, vendors);
    const withVendor = catalogFilterOptions(items, {
      category: 'All',
      vendorIds: ['VND-001'],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'featured',
    }, vendors);

    const respiratoryAll = unfiltered.categories.find((c) => c.key === 'respiratory')!.count;
    const respiratoryVendor1 = withVendor.categories.find((c) => c.key === 'respiratory')!.count;
    expect(respiratoryVendor1).toBeLessThanOrEqual(respiratoryAll);
  });

  it('updates vendor counts when a category is selected', () => {
    const options = catalogFilterOptions(items, filters, vendors);
    const vendor1Respiratory = options.vendors.find((v) => v.id === 'VND-001')!.count;
    const vendor1All = catalogFilterOptions(items, {
      category: 'All',
      vendorIds: [],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'featured',
    }, vendors).vendors.find((v) => v.id === 'VND-001')!.count;
    expect(vendor1Respiratory).toBeLessThanOrEqual(vendor1All);
  });

  it('hides categories and vendors with zero matching items', () => {
    const options = catalogFilterOptions(items, filters, vendors);
    expect(options.categories.every((c) => c.key === 'All' || c.count > 0)).toBe(true);
    expect(options.vendors.every((v) => v.count > 0)).toBe(true);
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
