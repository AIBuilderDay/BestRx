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
  patients,
  vendors,
} from '../data/db';
import { CATEGORY_LABELS } from './catalog';
import { bucketIndexFor, periodContains, type CostPeriod } from './costPeriod';
import type { Order, Vendor } from '../types/domain';

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
  /** contractedUsd - bestQualifiedUsd. Negative means qualifying costs more — a premium. */
  qualifiedDeltaUsd: number | null;
  weeklyUnits: number[];
  weeklyActualUsd: number[];
}

export interface BasketTotals {
  actualUsd: number;
  rentalMonthlyUsd: number;
  purchaseUsd: number;
  perVendorUsd: Record<string, number | null>;
  contractedUsd: number | null;
  bestQualifiedUsd: number | null;
  qualifiedDeltaUsd: number | null;
}

export interface TrendBucket {
  label: string;
  actualUsd: number;
  contractedUsd: number;
  qualifiedUsd: number;
  /** True once the bucket runs past the newest order on file. */
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

/** Cheapest offer a vendor lists for a code, or null when it doesn't sell it. */
function unitPriceFor(vendorId: string, hcpcs: string): number | null {
  const prices = getOffersForItem(hcpcs)
    .filter((o) => o.vendorId === vendorId)
    .map((o) => o.priceUsd);
  return prices.length === 0 ? null : Math.min(...prices);
}

export function vendorColumns(hospiceId: string): VendorColumn[] {
  const patientZips = hospicePatientZips(hospiceId);
  return [...vendors]
    .map((vendor) => {
      const served = [...patientZips].filter((zip) => vendor.serviceAreaZips.includes(zip));
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
      };
    })
    .sort((a, b) => Number(b.contracted) - Number(a.contracted) || a.vendor.name.localeCompare(b.vendor.name));
}

function hospicePatientZips(hospiceId: string): Set<string> {
  return new Set(patients.filter((p) => p.hospiceId === hospiceId).map((p) => p.address.zip));
}

/** Prices one order's equipment at the vendor that actually delivered it. */
export function orderExtendedUsd(order: Order, period: CostPeriod): number {
  if (!order.vendorId) return 0;
  let total = 0;
  for (const item of order.equipment) {
    const unit = unitPriceFor(order.vendorId, item.hcpcs);
    if (unit === null) continue;
    const entry = getCatalogEntry(item.hcpcs);
    const months = entry?.rental ? period.months : 1;
    total += item.qty * unit * months;
  }
  return round2(total);
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
      const entry = getCatalogEntry(item.hcpcs);
      const months = entry?.rental ? period.months : 1;
      units.set(item.hcpcs, (units.get(item.hcpcs) ?? 0) + item.qty);

      const weeks = weeklyUnits.get(item.hcpcs) ?? new Array<number>(bucketCount).fill(0);
      if (bucket >= 0) weeks[bucket] += item.qty;
      weeklyUnits.set(item.hcpcs, weeks);

      const paidUnit = order.vendorId ? unitPriceFor(order.vendorId, item.hcpcs) : null;
      const paid = paidUnit === null ? 0 : item.qty * paidUnit * months;
      actual.set(item.hcpcs, (actual.get(item.hcpcs) ?? 0) + paid);

      const paidWeeks = weeklyActual.get(item.hcpcs) ?? new Array<number>(bucketCount).fill(0);
      if (bucket >= 0) paidWeeks[bucket] += paid;
      weeklyActual.set(item.hcpcs, paidWeeks);
    }
  }

  const lines: BasketLine[] = [];
  for (const [hcpcs, unitCount] of units) {
    const entry = getCatalogEntry(hcpcs);
    const kind: BasketLine['kind'] = entry?.rental ? 'rental' : 'purchase';
    const months = entry?.rental ? period.months : 1;

    const prices: VendorUnitPrice[] = columns.map((column) => {
      const unitUsd = unitPriceFor(column.vendor.id, hcpcs);
      return {
        vendorId: column.vendor.id,
        unitUsd,
        extendedUsd: unitUsd === null ? null : round2(unitCount * unitUsd * months),
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
      qualifiedDeltaUsd:
        contractedUsd === null || best === null ? null : round2(contractedUsd - best.usd),
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

  const contractedId = columns.find((c) => c.contracted)?.vendor.id;
  const contractedUsd = contractedId ? perVendorUsd[contractedId] ?? null : null;
  const qualifiedTotals = columns
    .filter((c) => c.qualified && !c.contracted)
    .map((c) => perVendorUsd[c.vendor.id])
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const bestQualifiedUsd = qualifiedTotals[0] ?? null;

  return {
    actualUsd: round2(lines.reduce((sum, l) => sum + l.actualUsd, 0)),
    rentalMonthlyUsd: round2(
      lines.filter((l) => l.kind === 'rental').reduce((sum, l) => sum + l.actualUsd, 0),
    ),
    purchaseUsd: round2(
      lines.filter((l) => l.kind === 'purchase').reduce((sum, l) => sum + l.actualUsd, 0),
    ),
    perVendorUsd,
    contractedUsd,
    bestQualifiedUsd,
    qualifiedDeltaUsd:
      contractedUsd === null || bestQualifiedUsd === null
        ? null
        : round2(contractedUsd - bestQualifiedUsd),
  };
}

export function spendTrend(
  lines: BasketLine[],
  period: CostPeriod,
  columns: VendorColumn[],
  hospiceId: string,
): TrendBucket[] {
  const contractedId = columns.find((c) => c.contracted)?.vendor.id;
  const qualifiedId = columns.find((c) => c.qualified && !c.contracted)?.vendor.id;
  const lastOrderDate = newestOrderDate(hospiceId);

  return period.buckets.map((bucket, index) => {
    let actual = 0;
    let contracted = 0;
    let qualified = 0;
    for (const line of lines) {
      const unitsThisBucket = line.weeklyUnits[index] ?? 0;
      const share = line.units === 0 ? 0 : unitsThisBucket / line.units;
      actual += line.weeklyActualUsd[index] ?? 0;
      const contractedCell = line.prices.find((p) => p.vendorId === contractedId)?.extendedUsd;
      const qualifiedCell = line.prices.find((p) => p.vendorId === qualifiedId)?.extendedUsd;
      contracted += (contractedCell ?? 0) * share;
      qualified += (qualifiedCell ?? 0) * share;
    }
    return {
      label: bucket.label,
      actualUsd: round2(actual),
      contractedUsd: round2(contracted),
      qualifiedUsd: round2(qualified),
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
