import { describe, expect, it } from 'vitest';
import { equipmentCatalog, patients } from '../data/db';
import {
  fastestLeadDays,
  filterAndSortCatalog,
  buildCatalogItems,
  itemPrice,
  moneyLabel,
  ownersOf,
  paginateCatalog,
  patientOwnsEquipment,
  priceCeiling,
  vendorsForHcpcs,
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

describe('vendorsForHcpcs', () => {
  it('finds vendors with an inventory record for the code, deduped', () => {
    const ids = vendorsForHcpcs('E0250').map((v) => v.id).sort();
    expect(ids).toEqual(['VND-001', 'VND-003']);
  });

  it('returns an empty list for a code with no inventory records', () => {
    expect(vendorsForHcpcs('E0470')).toEqual([]);
  });
});

describe('fastestLeadDays', () => {
  it('takes the fastest linked vendor, rounded up to whole days', () => {
    const vendors = vendorsForHcpcs('E0250'); // VND-001 (24h) and VND-003 (48h)
    expect(fastestLeadDays(vendors)).toBe(1);
  });

  it('is null with no linked vendors', () => {
    expect(fastestLeadDays([])).toBeNull();
  });
});

describe('patientOwnsEquipment / ownersOf', () => {
  it('is true for a patient with a non-terminal order carrying that code', () => {
    // DME-10231: PT-88421 has an ordered E0250 hospital bed.
    expect(patientOwnsEquipment('PT-88421', 'E0250')).toBe(true);
  });

  it('is false once the equipment has been picked back up', () => {
    // DME-09950: PT-87602's hospital bed was already picked up.
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
  it('rounds up past the most expensive item', () => {
    expect(priceCeiling(equipmentCatalog)).toBeGreaterThanOrEqual(
      Math.max(...equipmentCatalog.map((e) => itemPrice(e).amount)),
    );
  });
});

describe('filterAndSortCatalog', () => {
  const items = buildCatalogItems(equipmentCatalog);

  it('filters by category', () => {
    const result = filterAndSortCatalog(items, {
      category: 'respiratory',
      vendorIds: [],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'featured',
    });
    expect(result.every((it) => it.entry.category === 'respiratory')).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters out items with no vendor match, including unlinked items', () => {
    const result = filterAndSortCatalog(items, {
      category: 'All',
      vendorIds: ['VND-001'],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'featured',
    });
    expect(result.some((it) => it.entry.hcpcs === 'E0470')).toBe(false); // no inventory link at all
    expect(result.every((it) => it.vendors.some((v) => v.id === 'VND-001'))).toBe(true);
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

  it('sorts by speed, unknown lead time last', () => {
    const result = filterAndSortCatalog(items, {
      category: 'All',
      vendorIds: [],
      speed: 'any',
      maxPrice: 10_000,
      sort: 'speed',
    });
    const lastFew = result.slice(-3);
    expect(lastFew.some((it) => it.leadDays === null)).toBe(true);
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
