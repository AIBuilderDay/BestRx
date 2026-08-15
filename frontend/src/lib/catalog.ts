/**
 * Pure helpers for the DME Catalog view. Storefront rows come from vendor_offers.json — one card per
 * offer, with product name, vendor, price, lead time, and image all read directly from the JSON.
 * Joins to equipment_catalog are for FK validation only.
 */

import { getCatalogEntry, getVendor, orders, vendorOffers } from '../data/db';
import { offerRatingSummary } from './reviews';
import type { CatalogEntry, EquipmentCategory, OfferRatingSummary, Order, Patient, ProductReview, Vendor, VendorOffer } from '../types/domain';

export interface ItemPrice {
  amount: number;
  /** '/mo' for a rental, 'one-time' for a purchase. */
  unit: '/mo' | 'one-time';
}

/** One storefront listing: a single vendor offer row from vendor_offers.json. */
export interface CatalogProductVM {
  offer: VendorOffer;
  vendor: Vendor;
  price: ItemPrice;
  /** Average star rating for this vendor SKU, from product_reviews.json. */
  rating: OfferRatingSummary | null;
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

export function offerPrice(offer: VendorOffer): ItemPrice {
  return {
    amount: offer.priceUsd,
    unit: offer.unit === 'month' ? '/mo' : 'one-time',
  };
}

/** Medicare-allowed rate from the catalog entry (reference pricing, not the vendor offer). */
export function itemPrice(entry: CatalogEntry): ItemPrice {
  if (entry.rental && entry.avgMonthlyAllowedUsd !== undefined) {
    return { amount: entry.avgMonthlyAllowedUsd, unit: '/mo' };
  }
  return { amount: entry.avgPurchaseAllowedUsd ?? 0, unit: 'one-time' };
}

/** One catalog card per vendor offer. Items with no offer are not listed. */
export function buildCatalogItems(sessionReviews: ProductReview[] = []): CatalogProductVM[] {
  const items: CatalogProductVM[] = [];
  for (const offer of vendorOffers) {
    const vendor = getVendor(offer.vendorId);
    if (!vendor || !getCatalogEntry(offer.hcpcs)) continue;
    items.push({
      offer,
      vendor,
      price: offerPrice(offer),
      rating: offerRatingSummary(offer.id, sessionReviews),
    });
  }
  return items;
}

/** Highest offer price across the storefront, for the "max price" filter's upper bound. */
export function priceCeiling(items: CatalogProductVM[]): number {
  const max = Math.max(0, ...items.map((it) => it.price.amount));
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

/** Default sidebar + sort state when the user returns to the catalog grid. */
export function defaultCatalogFilters(priceMax: number): CatalogFilterState {
  return {
    category: 'All',
    vendorIds: [],
    speed: 'any',
    maxPrice: priceMax,
    sort: 'featured',
  };
}

export const RESET_CATALOG_FILTERS_STATE = { resetCatalogFilters: true } as const;

export interface CatalogPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  firstItem: number;
  lastItem: number;
}

/** Returns one bounded page and the 1-based range used by the catalog pagination label. */
export function paginateItems<T>(items: T[], requestedPage: number, pageSize: number): CatalogPage<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(1, Math.min(totalPages, Math.floor(requestedPage)));
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    items: pageItems,
    page,
    totalPages,
    firstItem: pageItems.length === 0 ? 0 : start + 1,
    lastItem: start + pageItems.length,
  };
}

export function paginateCatalog<T>(items: T[], requestedPage: number): CatalogPage<T> {
  return paginateItems(items, requestedPage, CATALOG_PAGE_SIZE);
}

export interface CartLine {
  offerId: string;
  patientId: string;
  qty: number;
}

export interface CartLineVM {
  offerId: string;
  patientId: string;
  qty: number;
  name: string;
  imagePath: string;
  metaLine: string;
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

/** Add `addQty` to an existing (offer, patient) line, or append a new one. */
export function upsertCartLine(lines: CartLine[], offerId: string, patientId: string, addQty: number): CartLine[] {
  const i = lines.findIndex((l) => l.offerId === offerId && l.patientId === patientId);
  if (i >= 0) {
    const next = lines.slice();
    next[i] = { ...next[i], qty: Math.min(99, next[i].qty + addQty) };
    return next;
  }
  return [...lines, { offerId, patientId, qty: addQty }];
}

/** Set a line's quantity; a quantity of 0 or less removes it. */
export function setCartLineQty(lines: CartLine[], offerId: string, patientId: string, qty: number): CartLine[] {
  if (qty <= 0) return lines.filter((l) => !(l.offerId === offerId && l.patientId === patientId));
  return lines.map((l) => (l.offerId === offerId && l.patientId === patientId ? { ...l, qty: Math.min(99, qty) } : l));
}

export function totalUnitsInCart(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.qty, 0);
}

export function unitsInCartFor(lines: CartLine[], offerId: string): number {
  return lines.filter((l) => l.offerId === offerId).reduce((n, l) => n + l.qty, 0);
}

/** Joins cart lines against catalog items and patients into display-ready groups, one per patient. */
export function buildCartGroups(
  lines: CartLine[],
  catalogItems: CatalogProductVM[],
  patients: Patient[],
): CartGroupVM[] {
  const groups: CartGroupVM[] = [];
  for (const line of lines) {
    const item = catalogItems.find((it) => it.offer.id === line.offerId);
    const patient = patients.find((p) => p.id === line.patientId);
    if (!item || !patient) continue;

    const { offer, vendor } = item;
    const leadNote = offer.deliveryLeadDays === 1 ? 'next day' : `${offer.deliveryLeadDays} days`;

    const lineVM: CartLineVM = {
      offerId: line.offerId,
      patientId: line.patientId,
      qty: line.qty,
      name: offer.productName,
      imagePath: offer.imagePath,
      metaLine: `${offer.hcpcs} · ${vendor.displayName} · ${leadNote}`,
      lineTotal: item.price.amount * line.qty,
      priceUnit: item.price.unit,
      dupe: patientOwnsEquipment(line.patientId, offer.hcpcs),
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
  /** Slowest promised lead time across every line, in days. */
  slowestLeadDays: number | null;
}

export function cartTotals(lines: CartLine[], catalogItems: CatalogProductVM[]): CartTotals {
  let monthly = 0;
  let oneTime = 0;
  let slowestLeadDays: number | null = null;
  for (const line of lines) {
    const item = catalogItems.find((it) => it.offer.id === line.offerId);
    if (!item) continue;
    if (item.price.unit === '/mo') monthly += item.price.amount * line.qty;
    else oneTime += item.price.amount * line.qty;
    slowestLeadDays = Math.max(slowestLeadDays ?? 0, item.offer.deliveryLeadDays);
  }
  return { monthly, oneTime, slowestLeadDays };
}

export function filterAndSortCatalog(
  items: CatalogProductVM[],
  f: CatalogFilterState,
): CatalogProductVM[] {
  let list = items.filter((it) => {
    if (f.category !== 'All' && it.offer.category !== f.category) return false;
    if (f.vendorIds.length > 0 && !f.vendorIds.includes(it.vendor.id)) return false;
    if (f.speed !== 'any' && it.offer.deliveryLeadDays > Number(f.speed)) return false;
    if (it.price.amount > f.maxPrice) return false;
    return true;
  });

  if (f.sort === 'price') {
    list = list.slice().sort((a, b) => a.price.amount - b.price.amount);
  } else if (f.sort === 'speed') {
    list = list.slice().sort((a, b) => a.offer.deliveryLeadDays - b.offer.deliveryLeadDays);
  }
  return list;
}
