/**
 * Pure helpers for the Orders list view. Visibility follows auth permissions; display reuses
 * patient order row logic from lib/patients.ts.
 */

import { getCatalogEntry, getPatient, orders } from '../data/db';
import { can } from './auth';
import { CATEGORY_LABELS, paginateItems, patientFullName } from './catalog';
import {
  buildOrderEquipmentVM,
  getCaseloadPatients,
  type PatientEquipmentVM,
} from './patients';
import type { EquipmentCategory, Order, OrderStatus, User } from '../types/domain';

export type OrderSortKey = 'recent' | 'status';

export interface OrderFilterState {
  category: 'All' | EquipmentCategory;
  patientIds: string[];
  sort: OrderSortKey;
  query: string;
}

export interface OrderListItemVM extends PatientEquipmentVM {
  patientId: string;
  patientName: string;
  imagePath: string | null;
  category: EquipmentCategory | null;
  orderedAtLabel: string;
}

const STATUS_SORT_RANK: Record<OrderStatus, number> = {
  ordered: 0,
  dispatched: 1,
  in_transit: 2,
  delivered: 3,
  pickup_triggered: 4,
  picked_up: 5,
};

export const ORDERS_PAGE_SIZE = 30;

export function defaultOrderFilters(): OrderFilterState {
  return {
    category: 'All',
    patientIds: [],
    sort: 'recent',
    query: '',
  };
}

/** Orders this user may see: hospice-wide, caseload, and/or placed by them. */
export function getVisibleOrders(user: User): Order[] {
  const hospiceOrders = orders().filter((o) => o.hospiceId === user.orgId);

  if (can(user, 'orders:all')) return hospiceOrders;

  const caseloadIds = new Set(getCaseloadPatients(user.id, user.orgId).map((p) => p.id));
  const byPatient = hospiceOrders.filter((o) => caseloadIds.has(o.patientId));

  if (!can(user, 'orders:own')) return byPatient;

  const byNurse = hospiceOrders.filter((o) => o.orderedById === user.id);
  const seen = new Set<string>();
  return [...byPatient, ...byNurse].filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
}

function primaryCategory(order: Order): EquipmentCategory | null {
  const hcpcs = order.equipment[0]?.hcpcs;
  return hcpcs ? (getCatalogEntry(hcpcs)?.category ?? null) : null;
}

function primaryImagePath(order: Order): string | null {
  const hcpcs = order.equipment[0]?.hcpcs;
  return hcpcs ? (getCatalogEntry(hcpcs)?.imagePath ?? null) : null;
}

function formatOrderedAt(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function buildOrderListItemVM(order: Order): OrderListItemVM {
  const patient = getPatient(order.patientId);
  const base = buildOrderEquipmentVM(order);
  return {
    ...base,
    patientId: order.patientId,
    patientName: patient ? patientFullName(patient) : '—',
    imagePath: primaryImagePath(order),
    category: primaryCategory(order),
    orderedAtLabel: formatOrderedAt(order.orderedAt),
  };
}

function matchesQuery(item: OrderListItemVM, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.orderId.toLowerCase().includes(q) ||
    item.patientName.toLowerCase().includes(q) ||
    item.name.toLowerCase().includes(q) ||
    item.patientId.toLowerCase().includes(q)
  );
}

type OrderFilterDimension = 'category' | 'patientIds' | 'query';

function matchesOrderFilters(
  item: OrderListItemVM,
  filters: OrderFilterState,
  skip: OrderFilterDimension[] = [],
): boolean {
  if (!skip.includes('category') && filters.category !== 'All' && item.category !== filters.category) return false;
  if (!skip.includes('patientIds') && filters.patientIds.length > 0 && !filters.patientIds.includes(item.patientId)) {
    return false;
  }
  if (!skip.includes('query') && !matchesQuery(item, filters.query)) return false;
  return true;
}

export function filterAndSortOrders(items: OrderListItemVM[], filters: OrderFilterState): OrderListItemVM[] {
  let out = items.filter((item) => matchesOrderFilters(item, filters));

  out = out.slice().sort((a, b) => {
    if (filters.sort === 'status') {
      const ao = orders().find((o) => o.id === a.orderId);
      const bo = orders().find((o) => o.id === b.orderId);
      return (STATUS_SORT_RANK[ao?.status ?? 'ordered'] ?? 0) - (STATUS_SORT_RANK[bo?.status ?? 'ordered'] ?? 0);
    }
    const ao = orders().find((o) => o.id === a.orderId)?.orderedAt ?? '';
    const bo = orders().find((o) => o.id === b.orderId)?.orderedAt ?? '';
    return bo.localeCompare(ao);
  });

  return out;
}

/**
 * Keeps filter groups consistent: changing category drops patients with no orders() in it;
 * changing patients drops a category that none of them have orders in.
 */
export function resolveOrderFilters(
  items: OrderListItemVM[],
  current: OrderFilterState,
  patch: Partial<OrderFilterState>,
): OrderFilterState {
  const merged: OrderFilterState = { ...current, ...patch };
  const categoryChanged = 'category' in patch;
  const patientsChanged = 'patientIds' in patch;

  if (categoryChanged && !patientsChanged && merged.category !== 'All' && merged.patientIds.length > 0) {
    const applies = items.some(
      (item) => merged.patientIds.includes(item.patientId) && item.category === merged.category,
    );
    if (!applies) merged.category = 'All';
  }

  if (patientsChanged && !categoryChanged && merged.category !== 'All' && merged.patientIds.length > 0) {
    const validIds = new Set(
      items.filter((item) => item.category === merged.category).map((item) => item.patientId),
    );
    merged.patientIds = merged.patientIds.filter((id) => validIds.has(id));
  }

  if (categoryChanged && patientsChanged) {
    if (merged.category !== 'All' && merged.patientIds.length > 0) {
      const validIds = new Set(
        items.filter((item) => item.category === merged.category).map((item) => item.patientId),
      );
      merged.patientIds = merged.patientIds.filter((id) => validIds.has(id));
      if (merged.patientIds.length === 0) {
        // Category still applies on its own when no patients remain selected.
      } else {
        const applies = items.some(
          (item) => merged.patientIds.includes(item.patientId) && item.category === merged.category,
        );
        if (!applies) merged.category = 'All';
      }
    }
  }

  return merged;
}

export function orderCategoryOptions(items: OrderListItemVM[]): { key: 'All' | EquipmentCategory; label: string; count: number }[] {
  const categories = (Object.keys(CATEGORY_LABELS) as EquipmentCategory[])
    .map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      count: items.filter((it) => it.category === key).length,
    }))
    .filter((c) => c.count > 0);

  return [{ key: 'All', label: 'All', count: items.length }, ...categories];
}

export function orderPatientOptions(
  items: OrderListItemVM[],
): { id: string; name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    const existing = counts.get(item.patientId);
    if (existing) existing.count += 1;
    else counts.set(item.patientId, { name: item.patientName, count: 1 });
  }
  return [...counts.entries()]
    .map(([id, { name, count }]) => ({ id, name, count }))
    .filter((p) => p.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Sidebar counts reflect every active filter except the group being counted. */
export function orderFilterOptions(
  items: OrderListItemVM[],
  filters: OrderFilterState,
): {
  categories: ReturnType<typeof orderCategoryOptions>;
  patients: ReturnType<typeof orderPatientOptions>;
} {
  const forCategory = items.filter((item) => matchesOrderFilters(item, filters, ['category']));
  const forPatient = items.filter((item) => matchesOrderFilters(item, filters, ['patientIds']));
  return {
    categories: orderCategoryOptions(forCategory),
    patients: orderPatientOptions(forPatient),
  };
}

export function paginateOrders<T>(items: T[], requestedPage: number) {
  return paginateItems(items, requestedPage, ORDERS_PAGE_SIZE);
}

export function ordersSubtitle(items: OrderListItemVM[]): string {
  const n = items.length;
  const orderWord = n === 1 ? 'order' : 'orders';
  return `${n} ${orderWord} on your watch`;
}
