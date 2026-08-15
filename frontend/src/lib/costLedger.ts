/**
 * Cost ledger derivations — the basket a hospice actually bought, re-priced against every vendor
 * that could have supplied it.
 *
 * This module is the backend-swap boundary: everything here is pure, takes its hospice and period
 * explicitly, and returns plain view models. Replacing the bodies with API calls leaves the
 * signatures intact.
 *
 * Pricing rule, stated once:
 *   rental line   = units x priceUsd x period.months   (a month of rent per unit)
 *   purchase line = units x priceUsd                   (charged once)
 * Rentals and purchases are never silently added together — every mixed total carries its split,
 * because a $200/mo bed rental and a $200 walker are not the same commitment.
 */

import {
  getCatalogEntry,
  getHospice,
  getOffersForItem,
  getOrdersForHospice,
  getPatient,
  getUser,
  getVendor,
  patients,
  vendors,
} from '../data/db';
import { CATEGORY_LABELS, patientFullName } from './catalog';
import { bucketIndexFor, periodContains, type CostPeriod } from './costPeriod';
import type { TrendRange } from './trendRange';
import type { EquipmentItem, Order, Vendor, VendorOffer } from '../types/domain';

/** On-time delivery floor a vendor must clear before its price counts as a real alternative. */
export const SERVICE_FLOOR_PCT = 85;

export interface VendorColumn {
  vendor: Vendor;
  contracted: boolean;
  qualified: boolean;
  onTimePct: number;
  onTimePickupPct: number;
  /** Share of this hospice's patient ZIPs the vendor's service area covers, 0-100. */
  zipCoveragePct: number;
  servedZipCount: number;
  patientZipCount: number;
  /** "City, ST" labels among this hospice's patient locations the vendor's service area reaches. */
  servedLocations: string[];
  /** "City, ST" labels the vendor's service area does NOT reach — never a real option there. */
  unservedLocations: string[];
}

export interface VendorUnitPrice {
  vendorId: string;
  unitUsd: number | null;
  extendedUsd: number | null;
}

export interface BasketLine {
  hcpcs: string;
  name: string;
  categoryLabel: string;
  units: number;
  kind: 'rental' | 'purchase';
  prices: VendorUnitPrice[];
  /** Each order priced at the vendor that actually took it. */
  actualUsd: number;
  contractedUsd: number | null;
  bestQualifiedVendorId: string | null;
  bestQualifiedUsd: number | null;
  /**
   * actualUsd - bestQualifiedUsd. Measured against what was actually paid, because "switch to this
   * vendor" is a move from today's position, not from the contracted rate. Negative means
   * qualifying costs more — a premium, never to be rendered as a saving. Used by the per-code row
   * drawer; the "Potential Savings" card uses lib/vendorSavings.ts instead, which weighs price
   * against reviews and delivery per product rather than a single floor-gated delta.
   */
  qualifiedDeltaUsd: number | null;
  weeklyUnits: number[];
  weeklyActualUsd: number[];
}

export interface BasketTotals {
  actualUsd: number;
  rentalMonthlyUsd: number;
  purchaseUsd: number;
  perVendorUsd: Record<string, number | null>;
}

export interface TrendBucket {
  label: string;
  actualUsd: number;
  /** True once the bucket runs past the newest order on file. */
  partial: boolean;
}

export interface SpendRangeSummary {
  /** Sum of the real spend buckets for the selected range. */
  actualUsd: number;
  bucketCount: number;
  partial: boolean;
}

export interface LadderRow {
  vendor: Vendor;
  tone: 'contracted' | 'best' | 'alt' | 'risk';
  extendedUsd: number | null;
  unitUsd: number | null;
  onTimePct: number;
  onTimePickupPct: number;
  widthPct: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Cheapest offer a vendor lists for a code, or null when it doesn't sell it. Billing model
 * (`unit`) is read off the offer itself rather than `equipment_catalog.rental` — a code's
 * Medicare-allowed reference basis and how a given vendor actually bills it are independent facts,
 * and only the offer knows the latter.
 */
function cheapestOfferFor(vendorId: string, hcpcs: string): VendorOffer | null {
  const offers = getOffersForItem(hcpcs).filter((o) => o.vendorId === vendorId);
  if (offers.length === 0) return null;
  return offers.reduce((min, o) => (o.priceUsd < min.priceUsd ? o : min));
}

const monthsFor = (offer: VendorOffer, period: CostPeriod): number =>
  offer.unit === 'month' ? period.months : 1;

/** The billing model this code is actually sold under. Falls back to the catalog only if a code
 *  has no offers at all (nothing to read a real billing model from). */
function codeUnitKind(hcpcs: string): BasketLine['kind'] {
  const offers = getOffersForItem(hcpcs);
  if (offers.length > 0) return offers[0].unit === 'month' ? 'rental' : 'purchase';
  return getCatalogEntry(hcpcs)?.rental ? 'rental' : 'purchase';
}

export function vendorColumns(hospiceId: string): VendorColumn[] {
  const patientZips = hospicePatientZips(hospiceId);
  const patientLocations = hospicePatientLocations(hospiceId);
  return [...vendors]
    .map((vendor) => {
      const served = [...patientZips].filter((zip) => vendor.serviceAreaZips.includes(zip));
      const servedLocations: string[] = [];
      const unservedLocations: string[] = [];
      for (const [label, zips] of patientLocations) {
        const reaches = zips.some((zip) => vendor.serviceAreaZips.includes(zip));
        (reaches ? servedLocations : unservedLocations).push(label);
      }
      return {
        vendor,
        contracted: vendor.contracted === true,
        qualified: vendor.performance30d.onTimeDeliveryPct >= SERVICE_FLOOR_PCT,
        onTimePct: vendor.performance30d.onTimeDeliveryPct,
        onTimePickupPct: vendor.performance30d.onTimePickupPct,
        zipCoveragePct:
          patientZips.size === 0 ? 0 : Math.round((served.length / patientZips.size) * 100),
        servedZipCount: served.length,
        patientZipCount: patientZips.size,
        servedLocations,
        unservedLocations,
      };
    })
    .sort((a, b) => Number(b.contracted) - Number(a.contracted) || a.vendor.name.localeCompare(b.vendor.name));
}

function hospicePatientZips(hospiceId: string): Set<string> {
  return new Set(patients.filter((p) => p.hospiceId === hospiceId).map((p) => p.address.zip));
}

/** This hospice's distinct patient locations ("City, ST" -> the ZIPs on file for it), alphabetical. */
function hospicePatientLocations(hospiceId: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const p of patients) {
    if (p.hospiceId !== hospiceId) continue;
    const label = `${p.address.city}, ${p.address.state}`;
    const zips = map.get(label);
    if (zips) {
      if (!zips.includes(p.address.zip)) zips.push(p.address.zip);
    } else {
      map.set(label, [p.address.zip]);
    }
  }
  return new Map([...map].sort(([a], [b]) => a.localeCompare(b)));
}

/** Prices one order's equipment at the vendor that actually delivered it. */
export function orderItemExtendedUsd(order: Order, item: EquipmentItem, period: CostPeriod): number {
  if (!order.vendorId) return 0;
  const offer = cheapestOfferFor(order.vendorId, item.hcpcs);
  if (offer === null) return 0;
  return round2(item.qty * offer.priceUsd * monthsFor(offer, period));
}

export function orderExtendedUsd(order: Order, period: CostPeriod): number {
  return round2(order.equipment.reduce((total, item) => total + orderItemExtendedUsd(order, item, period), 0));
}

export interface CodeOrderHistoryEntry {
  orderId: string;
  orderedAt: string;
  qty: number;
  unitUsd: number | null;
  extendedUsd: number;
  vendorName: string;
  orderedByName: string;
  patientName: string;
}

/** Every order this period that included this HCPCS code, oldest first — the "who bought how many,
 *  when, at what price" behind one basket line. */
export function orderHistoryForCode(
  hospiceId: string,
  period: CostPeriod,
  hcpcs: string,
): CodeOrderHistoryEntry[] {
  const entries: CodeOrderHistoryEntry[] = [];

  for (const order of getOrdersForHospice(hospiceId)) {
    if (!order.orderedAt || !periodContains(period, order.orderedAt)) continue;
    const item = order.equipment.find((e) => e.hcpcs === hcpcs);
    if (!item) continue;

    const offer = order.vendorId ? cheapestOfferFor(order.vendorId, hcpcs) : null;
    const patient = getPatient(order.patientId);

    entries.push({
      orderId: order.id,
      orderedAt: order.orderedAt,
      qty: item.qty,
      unitUsd: offer?.priceUsd ?? null,
      extendedUsd: orderItemExtendedUsd(order, item, period),
      vendorName: getVendor(order.vendorId)?.displayName ?? 'Vendor not yet assigned',
      orderedByName: getUser(order.orderedById)?.name ?? 'Unknown',
      patientName: patient ? patientFullName(patient) : 'Unknown patient',
    });
  }

  return entries.sort((a, b) => a.orderedAt.localeCompare(b.orderedAt));
}

export function buildBasket(hospiceId: string, period: CostPeriod): BasketLine[] {
  const columns = vendorColumns(hospiceId);
  const bucketCount = period.buckets.length;

  const units = new Map<string, number>();
  const weeklyUnits = new Map<string, number[]>();
  const weeklyActual = new Map<string, number[]>();
  const actual = new Map<string, number>();

  for (const order of getOrdersForHospice(hospiceId)) {
    if (!periodContains(period, order.orderedAt)) continue;
    const bucket = bucketIndexFor(period, order.orderedAt);
    for (const item of order.equipment) {
      units.set(item.hcpcs, (units.get(item.hcpcs) ?? 0) + item.qty);

      const weeks = weeklyUnits.get(item.hcpcs) ?? new Array<number>(bucketCount).fill(0);
      if (bucket >= 0) weeks[bucket] += item.qty;
      weeklyUnits.set(item.hcpcs, weeks);

      const paidOffer = order.vendorId ? cheapestOfferFor(order.vendorId, item.hcpcs) : null;
      const paid = paidOffer === null ? 0 : item.qty * paidOffer.priceUsd * monthsFor(paidOffer, period);
      actual.set(item.hcpcs, (actual.get(item.hcpcs) ?? 0) + paid);

      const paidWeeks = weeklyActual.get(item.hcpcs) ?? new Array<number>(bucketCount).fill(0);
      if (bucket >= 0) paidWeeks[bucket] += paid;
      weeklyActual.set(item.hcpcs, paidWeeks);
    }
  }

  const lines: BasketLine[] = [];
  for (const [hcpcs, unitCount] of units) {
    const entry = getCatalogEntry(hcpcs);
    const kind = codeUnitKind(hcpcs);

    const prices: VendorUnitPrice[] = columns.map((column) => {
      const offer = cheapestOfferFor(column.vendor.id, hcpcs);
      const unitUsd = offer?.priceUsd ?? null;
      return {
        vendorId: column.vendor.id,
        unitUsd,
        extendedUsd:
          offer === null ? null : round2(unitCount * offer.priceUsd * monthsFor(offer, period)),
      };
    });

    const priceOf = (vendorId: string | undefined): number | null =>
      prices.find((p) => p.vendorId === vendorId)?.extendedUsd ?? null;

    const contractedUsd = priceOf(columns.find((c) => c.contracted)?.vendor.id);
    const qualifiedPrices = columns
      .filter((c) => c.qualified && !c.contracted)
      .map((c) => ({ id: c.vendor.id, usd: priceOf(c.vendor.id) }))
      .filter((c): c is { id: string; usd: number } => c.usd !== null)
      .sort((a, b) => a.usd - b.usd);
    const best = qualifiedPrices[0] ?? null;

    lines.push({
      hcpcs,
      name: entry?.name ?? hcpcs,
      categoryLabel: entry ? CATEGORY_LABELS[entry.category] : 'Uncategorised',
      units: unitCount,
      kind,
      prices,
      actualUsd: round2(actual.get(hcpcs) ?? 0),
      contractedUsd,
      bestQualifiedVendorId: best?.id ?? null,
      bestQualifiedUsd: best?.usd ?? null,
      qualifiedDeltaUsd: best === null ? null : round2((actual.get(hcpcs) ?? 0) - best.usd),
      weeklyUnits: weeklyUnits.get(hcpcs) ?? new Array<number>(bucketCount).fill(0),
      weeklyActualUsd: (weeklyActual.get(hcpcs) ?? new Array<number>(bucketCount).fill(0)).map(round2),
    });
  }

  return lines.sort((a, b) => b.actualUsd - a.actualUsd || a.hcpcs.localeCompare(b.hcpcs));
}

export function basketTotals(lines: BasketLine[], columns: VendorColumn[]): BasketTotals {
  const perVendorUsd: Record<string, number | null> = {};
  for (const column of columns) {
    let total = 0;
    let complete = true;
    for (const line of lines) {
      const cell = line.prices.find((p) => p.vendorId === column.vendor.id);
      if (!cell || cell.extendedUsd === null) complete = false;
      else total += cell.extendedUsd;
    }
    perVendorUsd[column.vendor.id] = complete ? round2(total) : null;
  }

  return {
    actualUsd: round2(lines.reduce((sum, l) => sum + l.actualUsd, 0)),
    rentalMonthlyUsd: round2(
      lines.filter((l) => l.kind === 'rental').reduce((sum, l) => sum + l.actualUsd, 0),
    ),
    purchaseUsd: round2(
      lines.filter((l) => l.kind === 'purchase').reduce((sum, l) => sum + l.actualUsd, 0),
    ),
    perVendorUsd,
  };
}

/** Real spend per period bucket — no vendor comparison; see lib/vendorSavings.ts for that. */
export function spendTrend(
  lines: BasketLine[],
  period: CostPeriod,
  hospiceId: string,
): TrendBucket[] {
  const lastOrderDate = newestOrderDate(hospiceId);

  return period.buckets.map((bucket, index) => {
    let actual = 0;
    for (const line of lines) {
      actual += line.weeklyActualUsd[index] ?? 0;
    }
    return {
      label: bucket.label,
      actualUsd: round2(actual),
      partial: lastOrderDate !== null && bucket.endIso > lastOrderDate,
    };
  });
}

function newestOrderDate(hospiceId: string): string | null {
  const dates = getOrdersForHospice(hospiceId)
    .map((o) => o.orderedAt?.slice(0, 10))
    .filter((d): d is string => typeof d === 'string');
  return dates.length === 0 ? null : dates.reduce((a, b) => (a > b ? a : b));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Real spend for each of the last 7 real days on file, ending at the newest order — the 1-week
 * range on the Total Spend tile. Every bucket is real; a day with no orders is a real $0, not a
 * gap. Anchored to the newest order rather than a hardcoded date so this stays correct if the
 * dataset grows.
 */
export function dailySpendTrend(hospiceId: string, period: CostPeriod): TrendBucket[] {
  const lastOrderDate = newestOrderDate(hospiceId);
  if (lastOrderDate === null) return [];

  const end = new Date(`${lastOrderDate}T00:00:00Z`);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(end.getTime() - (6 - i) * DAY_MS);
    return d.toISOString().slice(0, 10);
  });

  const totalsByDay = new Map<string, number>();
  for (const order of getOrdersForHospice(hospiceId)) {
    const date = order.orderedAt?.slice(0, 10);
    if (date === undefined || !days.includes(date)) continue;
    totalsByDay.set(date, (totalsByDay.get(date) ?? 0) + orderExtendedUsd(order, period));
  }

  return days.map((date) => ({
    label: WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()],
    actualUsd: round2(totalsByDay.get(date) ?? 0),
    partial: false,
  }));
}

/**
 * Real spend for the Total Spend tile's range picker — the single dispatch point between the two
 * ranges the dataset can actually back (1wk daily, 1mo weekly) and the three it can't. Null means
 * "no real data for this range," never a fabricated series; the caller renders an honest empty
 * state instead of a chart.
 */
export function spendTrendForRange(
  hospiceId: string,
  period: CostPeriod,
  lines: BasketLine[],
  range: TrendRange,
): TrendBucket[] | null {
  if (range === '1w') return dailySpendTrend(hospiceId, period);
  if (range === '1m') return spendTrend(lines, period, hospiceId);
  return null;
}

/** Total Spend tile summary for the selected range. Null means the range has no real history. */
export function spendSummaryForRange(
  hospiceId: string,
  period: CostPeriod,
  lines: BasketLine[],
  range: TrendRange,
): SpendRangeSummary | null {
  const buckets = spendTrendForRange(hospiceId, period, lines, range);
  if (buckets === null) return null;
  return {
    actualUsd: round2(buckets.reduce((sum, bucket) => sum + bucket.actualUsd, 0)),
    bucketCount: buckets.length,
    partial: buckets.some((bucket) => bucket.partial),
  };
}

/** Vendors ranked cheapest first for one code, for the row drawer. */
export function priceLadder(line: BasketLine, columns: VendorColumn[]): LadderRow[] {
  const priced = columns
    .map((column) => {
      const cell = line.prices.find((p) => p.vendorId === column.vendor.id);
      return { column, extendedUsd: cell?.extendedUsd ?? null, unitUsd: cell?.unitUsd ?? null };
    })
    .sort((a, b) => (a.extendedUsd ?? Infinity) - (b.extendedUsd ?? Infinity));

  const max = Math.max(...priced.map((p) => p.extendedUsd ?? 0), 0);

  return priced.map(({ column, extendedUsd, unitUsd }) => {
    const tone: LadderRow['tone'] = column.contracted
      ? 'contracted'
      : !column.qualified
        ? 'risk'
        : column.vendor.id === line.bestQualifiedVendorId
          ? 'best'
          : 'alt';
    return {
      vendor: column.vendor,
      tone,
      extendedUsd,
      unitUsd,
      onTimePct: column.onTimePct,
      onTimePickupPct: column.onTimePickupPct,
      widthPct: max === 0 || extendedUsd === null ? 0 : Math.round((extendedUsd / max) * 100),
    };
  });
}

export interface CostPpd {
  ppdUsd: number;
  census: number;
  days: number;
}

/** Spend per patient per day — the number the hospice buyer actually judges us on. */
export function ledgerPpd(hospiceId: string, spendUsd: number, period: CostPeriod): CostPpd {
  const census = getHospice(hospiceId)?.activeCensus ?? 0;
  const denominator = census * period.days;
  return {
    ppdUsd: denominator === 0 ? 0 : spendUsd / denominator,
    census,
    days: period.days,
  };
}
