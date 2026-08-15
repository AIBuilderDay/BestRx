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

/**
 * Which arrangement the storefront is pricing right now. Rental is the default: most capital DME
 * (beds, wheelchairs, oxygen, CPAP/BiPAP) is rented, and renting versus buying is the PPD lever a
 * short length of stay turns on.
 */
export type PricingMode = 'rent' | 'buy';

/** The cart's stored unit, and the offer field each mode reads. */
export type PriceUnit = 'month' | 'purchase';

export const UNIT_FOR_MODE: Record<PricingMode, PriceUnit> = { rent: 'month', buy: 'purchase' };

/** One storefront listing: a single vendor offer row from vendor_offers.json. */
export interface CatalogProductVM {
  offer: VendorOffer;
  vendor: Vendor;
  /** Price under the mode this VM was built for. */
  price: ItemPrice;
  /** The unit `price` resolved to — may differ from the requested mode on a single-price offer. */
  priceUnit: PriceUnit;
  /** Both units when the offer can be rented or bought; one when it cannot. */
  availableUnits: PriceUnit[];
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

/** Which arrangements this offer actually sells. Always at least one; a row with neither is broken. */
export function availableUnits(offer: VendorOffer): PriceUnit[] {
  const units: PriceUnit[] = [];
  if (offer.rentalPriceUsd !== undefined) units.push('month');
  if (offer.purchasePriceUsd !== undefined) units.push('purchase');
  return units;
}

/**
 * Price this offer under `unit`, falling back to the arrangement it does sell. A walker has no
 * rental rate, so in Rental mode it prices as the purchase it is — the card tags it rather than
 * hiding it, because a nurse who searched for a walker should find one.
 */
export function offerPriceFor(offer: VendorOffer, unit: PriceUnit): ItemPrice | null {
  const rental = offer.rentalPriceUsd;
  const purchase = offer.purchasePriceUsd;
  if (unit === 'month') {
    if (rental !== undefined) return { amount: rental, unit: '/mo' };
    if (purchase !== undefined) return { amount: purchase, unit: 'one-time' };
    return null;
  }
  if (purchase !== undefined) return { amount: purchase, unit: 'one-time' };
  if (rental !== undefined) return { amount: rental, unit: '/mo' };
  return null;
}

/** The offer's own default arrangement, used where no mode is in play. */
export function offerPrice(offer: VendorOffer): ItemPrice | null {
  return offerPriceFor(offer, offer.unit);
}

/** Money with cents, for the cart's line prices and totals where precision reads as trust. */
export function moneyCents(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Medicare-allowed rate from the catalog entry (reference pricing, not the vendor offer). */
export function itemPrice(entry: CatalogEntry): ItemPrice {
  if (entry.rental && entry.avgMonthlyAllowedUsd !== undefined) {
    return { amount: entry.avgMonthlyAllowedUsd, unit: '/mo' };
  }
  return { amount: entry.avgPurchaseAllowedUsd ?? 0, unit: 'one-time' };
}

/**
 * One catalog card per vendor offer, priced for `mode`. Items with no offer, no vendor, or no
 * price at all are not listed.
 */
export function buildCatalogItems(
  sessionReviews: ProductReview[] = [],
  mode: PricingMode = 'rent',
): CatalogProductVM[] {
  const items: CatalogProductVM[] = [];
  for (const offer of vendorOffers()) {
    const vendor = getVendor(offer.vendorId);
    if (!vendor || !getCatalogEntry(offer.hcpcs)) continue;
    const price = offerPriceFor(offer, UNIT_FOR_MODE[mode]);
    if (!price) continue;
    items.push({
      offer,
      vendor,
      price,
      priceUnit: price.unit === '/mo' ? 'month' : 'purchase',
      availableUnits: availableUnits(offer),
      rating: offerRatingSummary(offer.id, sessionReviews),
    });
  }
  return items;
}

/**
 * Highest price across the storefront as currently priced, for the "max price" filter's upper
 * bound. Rental and purchase are different orders of magnitude, so the ceiling moves with the mode.
 */
export function priceCeiling(items: CatalogProductVM[]): number {
  const max = Math.max(0, ...items.map((it) => it.price.amount));
  return Math.max(50, Math.ceil(max / 10) * 10);
}

/**
 * Carry a max-price filter across a mode switch. The slider's scale changes underneath the user, so
 * "the cheap half of the catalog" stays the cheap half rather than snapping to everything or nothing.
 */
export function rescaleMaxPrice(maxPrice: number, fromCeiling: number, toCeiling: number): number {
  if (fromCeiling <= 0) return toCeiling;
  if (maxPrice >= fromCeiling) return toCeiling;
  return Math.min(toCeiling, Math.max(1, Math.round((maxPrice / fromCeiling) * toCeiling)));
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
  return orders().some(
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

export interface CategoryOption {
  key: 'All' | EquipmentCategory;
  label: string;
  count: number;
}

export interface VendorFilterOption {
  id: string;
  displayName: string;
  count: number;
}

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
  /** Rented or bought. Part of line identity: one SKU can be on the cart both ways. */
  unit: PriceUnit;
  qty: number;
}

export interface CartLineVM {
  offerId: string;
  patientId: string;
  /** The arrangement this line was added under. */
  unit: PriceUnit;
  qty: number;
  name: string;
  hcpcs: string;
  imagePath: string;
  metaLine: string;
  /** Human category label, e.g. "Beds & Support". */
  categoryLabel: string;
  /** Vendor selling this SKU. */
  vendorNote: string;
  /** Promised vendor lead time in days. */
  leadDays: number;
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

const sameLine = (l: CartLine, offerId: string, patientId: string, unit: PriceUnit): boolean =>
  l.offerId === offerId && l.patientId === patientId && l.unit === unit;

/** Add `addQty` to an existing (offer, patient, unit) line, or append a new one. */
export function upsertCartLine(
  lines: CartLine[],
  offerId: string,
  patientId: string,
  unit: PriceUnit,
  addQty: number,
): CartLine[] {
  const i = lines.findIndex((l) => sameLine(l, offerId, patientId, unit));
  if (i >= 0) {
    const next = lines.slice();
    next[i] = { ...next[i], qty: Math.min(99, next[i].qty + addQty) };
    return next;
  }
  return [...lines, { offerId, patientId, unit, qty: addQty }];
}

/** Set a line's quantity; a quantity of 0 or less removes it. */
export function setCartLineQty(
  lines: CartLine[],
  offerId: string,
  patientId: string,
  unit: PriceUnit,
  qty: number,
): CartLine[] {
  if (qty <= 0) return lines.filter((l) => !sameLine(l, offerId, patientId, unit));
  return lines.map((l) => (sameLine(l, offerId, patientId, unit) ? { ...l, qty: Math.min(99, qty) } : l));
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
    const price = offerPriceFor(offer, line.unit);
    if (!price) continue;
    const leadNote = offer.deliveryLeadDays === 1 ? 'next day' : `${offer.deliveryLeadDays} days`;

    const lineVM: CartLineVM = {
      offerId: line.offerId,
      patientId: line.patientId,
      unit: line.unit,
      qty: line.qty,
      name: offer.productName,
      hcpcs: offer.hcpcs,
      imagePath: offer.imagePath,
      metaLine: `${offer.hcpcs} · ${vendor.displayName} · ${leadNote}`,
      categoryLabel: CATEGORY_LABELS[offer.category],
      vendorNote: vendor.displayName,
      leadDays: offer.deliveryLeadDays,
      lineTotal: price.amount * line.qty,
      priceUnit: price.unit,
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

/**
 * How many orders this cart will become. Mirrors the backend's checkout split — one order per
 * (patient, vendor) — so the summary never promises a number the API then contradicts. Change one
 * and you must change the other: `backend/app/services/carts.py::checkout`.
 */
export function projectedOrderCount(lines: CartLine[], catalogItems: CatalogProductVM[]): number {
  const groups = new Set<string>();
  for (const line of lines) {
    const item = catalogItems.find((it) => it.offer.id === line.offerId);
    if (!item) continue;
    groups.add(`${line.patientId}|${item.vendor.id}`);
  }
  return groups.size;
}

export function cartTotals(lines: CartLine[], catalogItems: CatalogProductVM[]): CartTotals {
  let monthly = 0;
  let oneTime = 0;
  let slowestLeadDays: number | null = null;
  for (const line of lines) {
    const item = catalogItems.find((it) => it.offer.id === line.offerId);
    if (!item) continue;
    const price = offerPriceFor(item.offer, line.unit);
    if (!price) continue;
    if (price.unit === '/mo') monthly += price.amount * line.qty;
    else oneTime += price.amount * line.qty;
    slowestLeadDays = Math.max(slowestLeadDays ?? 0, item.offer.deliveryLeadDays);
  }
  return { monthly, oneTime, slowestLeadDays };
}

type CatalogFilterDimension = 'category' | 'vendorIds' | 'speed' | 'maxPrice';

function matchesCatalogFilters(
  item: CatalogProductVM,
  f: CatalogFilterState,
  skip: CatalogFilterDimension[] = [],
): boolean {
  if (!skip.includes('category') && f.category !== 'All' && item.offer.category !== f.category) return false;
  if (!skip.includes('vendorIds') && f.vendorIds.length > 0 && !f.vendorIds.includes(item.vendor.id)) return false;
  if (!skip.includes('speed') && f.speed !== 'any' && item.offer.deliveryLeadDays > Number(f.speed)) return false;
  if (!skip.includes('maxPrice') && item.price.amount > f.maxPrice) return false;
  return true;
}

/**
 * Sidebar counts reflect every active filter except the group being counted. Every category and
 * vendor stays listed even at count 0, so the sidebar doesn't reshuffle as filters narrow.
 */
export function catalogFilterOptions(
  items: CatalogProductVM[],
  filters: CatalogFilterState,
  allVendors: Vendor[],
): { categories: CategoryOption[]; vendors: VendorFilterOption[] } {
  const forCategory = items.filter((it) => matchesCatalogFilters(it, filters, ['category']));
  const categories: CategoryOption[] = [
    { key: 'All', label: 'All', count: forCategory.length },
    ...(Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      count: forCategory.filter((it) => it.offer.category === key).length,
    })),
  ];

  const forVendor = items.filter((it) => matchesCatalogFilters(it, filters, ['vendorIds']));
  const vendors: VendorFilterOption[] = allVendors.map((v) => ({
    id: v.id,
    displayName: v.displayName,
    count: forVendor.filter((it) => it.vendor.id === v.id).length,
  }));

  return { categories, vendors };
}

/** Text search from the top-nav bar: every word must match name, vendor, or category. */
export function searchCatalog(items: CatalogProductVM[], query: string): CatalogProductVM[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((it) => {
    const haystack =
      `${it.offer.productName} ${it.offer.description} ${it.vendor.displayName} ${it.vendor.name} ${CATEGORY_LABELS[it.offer.category]}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

export function filterAndSortCatalog(
  items: CatalogProductVM[],
  f: CatalogFilterState,
): CatalogProductVM[] {
  let list = items.filter((it) => matchesCatalogFilters(it, f));

  if (f.sort === 'price') {
    list = list.slice().sort((a, b) => a.price.amount - b.price.amount);
  } else if (f.sort === 'speed') {
    list = list.slice().sort((a, b) => a.offer.deliveryLeadDays - b.offer.deliveryLeadDays);
  }
  return list;
}
