import { describe, expect, it } from 'vitest';
import { users } from '../data/db';
import { buildOrderListItemVM, filterAndSortOrders, getVisibleOrders, orderFilterOptions } from './orders';

describe('getVisibleOrders', () => {
  const dana = users().find((u) => u.id === 'USR-001')!;
  const don = users().find((u) => u.id === 'USR-012')!;

  it('returns caseload orders for a case manager', () => {
    const visible = getVisibleOrders(dana);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((o) => o.hospiceId === dana.orgId)).toBe(true);
  });

  it('returns all hospice orders for director of nursing', () => {
    const visible = getVisibleOrders(don);
    const hospiceTotal = visible.filter((o) => o.hospiceId === don.orgId).length;
    expect(hospiceTotal).toBe(visible.length);
    expect(visible.length).toBeGreaterThan(getVisibleOrders(dana).length);
  });
});

describe('filterAndSortOrders', () => {
  const dana = users().find((u) => u.id === 'USR-001')!;
  const items = getVisibleOrders(dana).map(buildOrderListItemVM);

  it('filters to one patient only', () => {
    const patientId = items[0]?.patientId;
    expect(patientId).toBeTruthy();
    const filtered = filterAndSortOrders(items, {
      category: 'All',
      patientIds: [patientId],
      dateRange: 'All',
      sort: 'recent',
      query: '',
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((it) => it.patientId === patientId)).toBe(true);
  });

  it('puts a just-placed order first under Most recent', () => {
    const justPlaced = { ...items[0]!, orderId: 'ORD-NEW', orderedAt: new Date().toISOString() };
    const sorted = filterAndSortOrders([...items, justPlaced], {
      category: 'All',
      patientIds: [],
      dateRange: 'All',
      sort: 'recent',
      query: '',
    });
    expect(sorted[0]?.orderId).toBe('ORD-NEW');
  });

  it('keeps only orders created inside the date window', () => {
    const now = new Date('2026-08-15T12:00:00-06:00');
    const recent = { ...items[0]!, orderId: 'ORD-RECENT', orderedAt: '2026-08-14T08:00:00-06:00' };
    const old = { ...items[0]!, orderId: 'ORD-OLD', orderedAt: '2026-06-01T08:00:00-06:00' };
    const filtered = filterAndSortOrders(
      [recent, old],
      { category: 'All', patientIds: [], dateRange: '7d', sort: 'recent', query: '' },
      now,
    );
    expect(filtered.map((it) => it.orderId)).toEqual(['ORD-RECENT']);
  });
});

describe('orderFilterOptions', () => {
  const dana = users().find((u) => u.id === 'USR-001')!;
  const items = getVisibleOrders(dana).map(buildOrderListItemVM);

  it('updates patient counts when a category is selected', () => {
    const allPatients = orderFilterOptions(items, {
      category: 'All',
      patientIds: [],
      dateRange: 'All',
      sort: 'recent',
      query: '',
    }).patients;
    const respiratoryPatients = orderFilterOptions(items, {
      category: 'respiratory',
      patientIds: [],
      dateRange: 'All',
      sort: 'recent',
      query: '',
    }).patients;

    expect(respiratoryPatients.length).toBeLessThanOrEqual(allPatients.length);
    const aliceAll = allPatients.find((p) => p.name.includes('Alice'));
    const aliceRespiratory = respiratoryPatients.find((p) => p.name.includes('Alice'));
    if (aliceAll && aliceRespiratory) {
      expect(aliceRespiratory.count).toBeLessThanOrEqual(aliceAll.count);
    }
  });

  it('hides categories with zero matching orders', () => {
    const patientId = items.find((item) => item.category === 'respiratory')?.patientId;
    expect(patientId).toBeTruthy();
    const options = orderFilterOptions(items, {
      category: 'All',
      patientIds: [patientId!],
      dateRange: 'All',
      sort: 'recent',
      query: '',
    }).categories;
    expect(options.every((c) => c.key === 'All' || c.count > 0)).toBe(true);
    expect(options.length).toBeLessThan(6);
  });
});
