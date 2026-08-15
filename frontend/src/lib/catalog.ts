/**
 * Pure helpers for the DME Catalog view: price/lead-time derivation, vendor linkage, and
 * per-patient equipment ownership. Everything here reads from src/data/db.ts — nothing is
 * invented. An item with no inventory-linked vendor simply has no vendor/lead-time data; callers
 * must render that as "vendor assigned at dispatch" rather than a fabricated number.
 */

import { getVendor, inventory, orders } from '../data/db';
import type { CatalogEntry, EquipmentCategory, Order, Patient, Vendor } from '../types/domain';

export interface ItemPrice {
  amount: number;
  /** '/mo' for a rental, 'one-time' for a purchase. */
  unit: '/mo' | 'one-time';
}

export interface CatalogProductVM {
  entry: CatalogEntry;
  price: ItemPrice;
  /** Vendors known (via inventory) to carry this HCPCS code. Empty when unknown. */
  vendors: Vendor[];
  /** Fastest linked vendor's routine delivery lead time, in whole days. Null when unknown. */
  leadDays: number | null;
}

export const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  bed: 'Beds & Support',
  respiratory: 'Respiratory',
  mobility: 'Mobility',
  bathroom_safety: 'Bath & Safety',
  consumable: 'Consumables',
};

export function moneyLabel(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Money with cents, for the cart's line prices and totals where precision reads as trust. */
export function moneyCents(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function itemPrice(entry: CatalogEntry): ItemPrice {
  if (entry.rental && entry.avgMonthlyAllowedUsd !== undefined) {
    return { amount: entry.avgMonthlyAllowedUsd, unit: '/mo' };
  }
  return { amount: entry.avgPurchaseAllowedUsd ?? 0, unit: 'one-time' };
}

/** Vendors with any inventory record for this HCPCS code, deduped, in vendors.json order. */
export function vendorsForHcpcs(hcpcs: string): Vendor[] {
  const ids = new Set(inventory.filter((u) => u.hcpcs === hcpcs).map((u) => u.vendorId));
  const found: Vendor[] = [];
  for (const id of ids) {
    const v = getVendor(id);
    if (v) found.push(v);
  }
  return found;
}

export function fastestLeadDays(vendorsForItem: Vendor[]): number | null {
  if (vendorsForItem.length === 0) return null;
  const hours = Math.min(...vendorsForItem.map((v) => v.sla.routineDeliveryHours));
  return Math.ceil(hours / 24);
}

export function buildCatalogItems(catalog: CatalogEntry[]): CatalogProductVM[] {
  return catalog.map((entry) => {
    const vendors = vendorsForHcpcs(entry.hcpcs);
    return {
      entry,
      price: itemPrice(entry),
      vendors,
      leadDays: fastestLeadDays(vendors),
    };
  });
}

/** Highest price across the catalog, for the "max price" filter's upper bound. */
export function priceCeiling(catalog: CatalogEntry[]): number {
  const max = Math.max(0, ...catalog.map((e) => itemPrice(e).amount));
  return Math.max(50, Math.ceil(max / 10) * 10);
}

const HOLDS_EQUIPMENT_STATUSES = new Set<Order['status']>([
  'ordered',
  'dispatched',
  'in_transit',
  'delivered',
  'pickup_triggered',
]);

/** True if the patient has a non-terminal order that includes this HCPCS code already. */
export function patientOwnsEquipment(patientId: string, hcpcs: string): boolean {
  return orders.some(
    (o) =>
      o.patientId === patientId &&
      HOLDS_EQUIPMENT_STATUSES.has(o.status) &&
      o.equipment.some((e) => e.hcpcs === hcpcs),
  );
}

/** Which of the given patients already have this equipment, per patientOwnsEquipment. */
export function ownersOf(hcpcs: string, pool: Patient[]): Patient[] {
  return pool.filter((p) => patientOwnsEquipment(p.id, hcpcs));
}

export function patientFullName(patient: Patient): string {
  return `${patient.firstName} ${patient.lastName}`;
}

const TIME_FMT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/** Short status line for the patient-assignment sheet: where they are, and by when. */
export function patientMeta(patient: Patient): string {
  const place = `${patient.address.city}, ${patient.address.state}`;
  if (patient.dischargeAt) {
    const d = new Date(patient.dischargeAt);
    return `${place} · discharge ${TIME_FMT.format(d)} ${DATE_FMT.format(d)}`;
  }
  if (patient.status === 'active') return `${place} · active care`;
  return `${place} · ${patient.status.replace('_', ' ')}`;
}

/**
 * The dataset's "today" (see docs/DATA_MODEL.md — 2026-08-14, Mountain). Deadline comparisons on
 * the cart are rule-based against this fixed clock, so they stay deterministic and auditable.
 */
export const DATASET_NOW = new Date('2026-08-14T12:00:00-06:00');

const ARRIVAL_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** Earliest a line can arrive: dataset "now" plus the fastest known vendor lead time. */
export function earliestArrival(leadDays: number | null): Date | null {
  if (leadDays === null) return null;
  const d = new Date(DATASET_NOW);
  d.setDate(d.getDate() + leadDays);
  return d;
}

export interface CartLineTiming {
  /** True when the patient has a discharge and the earliest arrival lands after it. */
  missesDischarge: boolean;
  /** One human line a nurse can read: arrival date, and the deadline it misses when it does. */
  text: string;
}

/** Rule-based delivery-vs-discharge check for one cart line. No model, no fabricated dates. */
export function cartLineTiming(
  patient: Patient,
  leadDays: number | null,
  unit: ItemPrice['unit'],
): CartLineTiming {
  const kind = unit === '/mo' ? 'rental' : 'one-time purchase';
  const arrival = earliestArrival(leadDays);
  if (!arrival) return { missesDischarge: false, text: `Vendor assigned at dispatch · ${kind}` };
  if (patient.dischargeAt) {
    const discharge = new Date(patient.dischargeAt);
    if (arrival > discharge) {
      return {
        missesDischarge: true,
        text: `Earliest arrival ${ARRIVAL_FMT.format(arrival)} — after the ${TIME_FMT.format(discharge)} ${DATE_FMT.format(discharge)} discharge`,
      };
    }
  }
  return { missesDischarge: false, text: `Arrives ~${ARRIVAL_FMT.format(arrival)} · ${kind}` };
}

export interface CartPpdImpact {
  /** Rental dollars this order adds per day, over the budget period. */
  perDay: number;
  /** That daily cost spread across the hospice's active census — the PPD contribution. */
  ppdContribution: number;
  census: number;
  days: number;
}

/** What this order's recurring rentals add to the hospice's DME PPD. Derived, labeled as such in UI. */
export function cartPpdImpact(monthlyRentals: number, census: number, days: number): CartPpdImpact {
  const perDay = days > 0 ? monthlyRentals / days : 0;
  return { perDay, ppdContribution: census > 0 ? perDay / census : 0, census, days };
}

export type SortKey = 'featured' | 'price' | 'speed';
export type SpeedFilter = 'any' | '1' | '3' | '7';

export interface CatalogFilterState {
  category: 'All' | EquipmentCategory;
  vendorIds: string[];
  speed: SpeedFilter;
  maxPrice: number;
  sort: SortKey;
}

export const CATALOG_PAGE_SIZE = 30;

export interface CatalogPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  firstItem: number;
  lastItem: number;
}

/** Returns one bounded page and the 1-based range used by the catalog pagination label. */
export function paginateCatalog<T>(items: T[], requestedPage: number): CatalogPage<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / CATALOG_PAGE_SIZE));
  const page = Math.max(1, Math.min(totalPages, Math.floor(requestedPage)));
  const start = (page - 1) * CATALOG_PAGE_SIZE;
  const pageItems = items.slice(start, start + CATALOG_PAGE_SIZE);

  return {
    items: pageItems,
    page,
    totalPages,
    firstItem: pageItems.length === 0 ? 0 : start + 1,
    lastItem: start + pageItems.length,
  };
}

export interface CartLine {
  hcpcs: string;
  patientId: string;
  qty: number;
}

export interface CartLineVM {
  hcpcs: string;
  patientId: string;
  qty: number;
  name: string;
  imagePath: string;
  metaLine: string;
  /** Human category label, e.g. "Beds & Support". */
  categoryLabel: string;
  /** Vendors known to carry the item, or "Vendor assigned at dispatch". */
  vendorNote: string;
  /** Fastest known vendor lead time in days; null when no vendor is linked yet. */
  leadDays: number | null;
  lineTotal: number;
  priceUnit: ItemPrice['unit'];
  dupe: boolean;
}

export interface CartGroupVM {
  patientId: string;
  patientName: string;
  patientMetaLine: string;
  lines: CartLineVM[];
}

/** Add `addQty` to an existing (hcpcs, patient) line, or append a new one. */
export function upsertCartLine(lines: CartLine[], hcpcs: string, patientId: string, addQty: number): CartLine[] {
  const i = lines.findIndex((l) => l.hcpcs === hcpcs && l.patientId === patientId);
  if (i >= 0) {
    const next = lines.slice();
    next[i] = { ...next[i], qty: Math.min(99, next[i].qty + addQty) };
    return next;
  }
  return [...lines, { hcpcs, patientId, qty: addQty }];
}

/** Set a line's quantity; a quantity of 0 or less removes it. */
export function setCartLineQty(lines: CartLine[], hcpcs: string, patientId: string, qty: number): CartLine[] {
  if (qty <= 0) return lines.filter((l) => !(l.hcpcs === hcpcs && l.patientId === patientId));
  return lines.map((l) => (l.hcpcs === hcpcs && l.patientId === patientId ? { ...l, qty: Math.min(99, qty) } : l));
}

export function totalUnitsInCart(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

export function unitsInCartFor(lines: CartLine[], hcpcs: string): number {
  return lines.filter((l) => l.hcpcs === hcpcs).reduce((n, l) => n + l.qty, 0);
}

/** Joins cart lines against catalog items and patients into display-ready groups, one per patient. */
export function buildCartGroups(
  lines: CartLine[],
  catalogItems: CatalogProductVM[],
  patients: Patient[],
): CartGroupVM[] {
  const groups: CartGroupVM[] = [];
  for (const line of lines) {
    const item = catalogItems.find((it) => it.entry.hcpcs === line.hcpcs);
    const patient = patients.find((p) => p.id === line.patientId);
    if (!item || !patient) continue; // a broken foreign key must never blank the cart

    const vendorNote = item.vendors.length
      ? item.vendors.map((v) => v.name.replace('Sample ', '')).join(', ')
      : 'Vendor assigned at dispatch';
    const leadNote = item.leadDays !== null ? (item.leadDays === 1 ? 'next day' : `${item.leadDays} days`) : null;

    const lineVM: CartLineVM = {
      hcpcs: line.hcpcs,
      patientId: line.patientId,
      qty: line.qty,
      name: item.entry.name,
      imagePath: item.entry.imagePath,
      metaLine: `${item.entry.hcpcs} · ${vendorNote}${leadNote ? ` · ${leadNote}` : ''}`,
      categoryLabel: CATEGORY_LABELS[item.entry.category],
      vendorNote,
      leadDays: item.leadDays,
      lineTotal: item.price.amount * line.qty,
      priceUnit: item.price.unit,
      dupe: patientOwnsEquipment(line.patientId, line.hcpcs),
    };

    let group = groups.find((g) => g.patientId === line.patientId);
    if (!group) {
      group = {
        patientId: patient.id,
        patientName: patientFullName(patient),
        patientMetaLine: patientMeta(patient),
        lines: [],
      };
      groups.push(group);
    }
    group.lines.push(lineVM);
  }
  return groups;
}

export interface CartTotals {
  monthly: number;
  oneTime: number;
  /** Fastest known lead time across every line, in days. Null if no line has a known vendor yet. */
  slowestKnownLeadDays: number | null;
  /** True if at least one line has no vendor linked yet. */
  hasUnknownVendor: boolean;
}

export function cartTotals(lines: CartLine[], catalogItems: CatalogProductVM[]): CartTotals {
  let monthly = 0;
  let oneTime = 0;
  let slowestKnownLeadDays: number | null = null;
  let hasUnknownVendor = false;
  for (const line of lines) {
    const item = catalogItems.find((it) => it.entry.hcpcs === line.hcpcs);
    if (!item) continue;
    if (item.price.unit === '/mo') monthly += item.price.amount * line.qty;
    else oneTime += item.price.amount * line.qty;
    if (item.leadDays === null) hasUnknownVendor = true;
    else slowestKnownLeadDays = Math.max(slowestKnownLeadDays ?? 0, item.leadDays);
  }
  return { monthly, oneTime, slowestKnownLeadDays, hasUnknownVendor };
}

export function filterAndSortCatalog(
  items: CatalogProductVM[],
  f: CatalogFilterState,
): CatalogProductVM[] {
  let list = items.filter((it) => {
    if (f.category !== 'All' && it.entry.category !== f.category) return false;
    if (f.vendorIds.length > 0 && !it.vendors.some((v) => f.vendorIds.includes(v.id))) return false;
    if (f.speed !== 'any' && (it.leadDays === null || it.leadDays > Number(f.speed))) return false;
    if (it.price.amount > f.maxPrice) return false;
    return true;
  });

  if (f.sort === 'price') {
    list = list.slice().sort((a, b) => a.price.amount - b.price.amount);
  } else if (f.sort === 'speed') {
    list = list.slice().sort((a, b) => {
      if (a.leadDays === null) return 1;
      if (b.leadDays === null) return -1;
      return a.leadDays - b.leadDays;
    });
  }
  return list;
}
