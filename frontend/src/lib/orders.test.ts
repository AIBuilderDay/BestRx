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
      sort: 'recent',
      query: '',
    });
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((it) => it.patientId === patientId)).toBe(true);
  });
});

describe('orderFilterOptions', () => {
  const dana = users().find((u) => u.id === 'USR-001')!;
  const items = getVisibleOrders(dana).map(buildOrderListItemVM);

  it('updates patient counts when a category is selected', () => {
    const allPatients = orderFilterOptions(items, {
      category: 'All',
      patientIds: [],
      sort: 'recent',
      query: '',
    }).patients;
    const respiratoryPatients = orderFilterOptions(items, {
      category: 'respiratory',
      patientIds: [],
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
      sort: 'recent',
      query: '',
    }).categories;
    expect(options.every((c) => c.key === 'All' || c.count > 0)).toBe(true);
    expect(options.length).toBeLessThan(6);
  });
});
