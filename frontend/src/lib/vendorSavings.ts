/**
 * Per-product vendor recommendations for the "Potential Savings" card — for every HCPCS code this
 * hospice actually ordered this period, which non-contracted vendor is the best value, and what
 * switching to it on that code alone would have cost or saved.
 *
 * Only the hospice's contracted (current) vendor is excluded from being "the suggestion" — every
 * other vendor priced on that code is a real option, scored and surfaced, never silently dropped.
 *
 * The value score is price against reviews and delivery reliability, each normalized to 0-100:
 *   Price (40%)    — how much cheaper (or pricier) the vendor's unit price is than what was
 *                     actually paid for this code, scaled so a 25%-of-price swing moves the term
 *                     the full 50 points off center.
 *   Reviews (30%)  — vendor.overallRating, 1-5 stars mapped onto 0-100.
 *   Delivery (30%) — trailing 30-day on-time delivery percentage, already 0-100.
 * ZIP coverage is NOT part of this score — it's a hospice-vendor fact that doesn't vary product to
 * product, so it's carried on every option for display (a vendor that can't reach these patients
 * should never look silently indistinguishable from one that can) but doesn't move the ranking the
 * way it does on the whole-basket comparison. This is BestRx's own scoring methodology, not a fact
 * about the vendor — every consumer must label it "Value score," never present it as something the
 * vendor reports about itself.
 */

import type { BasketLine, VendorColumn } from './costLedger';
import type { Vendor } from '../types/domain';

export const PRICE_WEIGHT = 0.4;
export const REVIEW_WEIGHT = 0.3;
export const DELIVERY_WEIGHT = 0.3;

export interface ProductVendorOption {
  vendor: Vendor;
  unitUsd: number;
  extendedUsd: number;
  /** paidUsd - extendedUsd for this code. Positive = cheaper than what was paid, negative = a premium. */
  savingsUsd: number;
  qualified: boolean;
  onTimePct: number;
  onTimePickupPct: number;
  rating: number;
  ratingCount: number;
  zipCoveragePct: number;
  servedZipCount: number;
  patientZipCount: number;
  /** 0-100, BestRx's own weighted score (price/reviews/delivery only) — see module doc comment. */
  valueScore: number;
}

export interface ProductSavingsRow {
  hcpcs: string;
  name: string;
  categoryLabel: string;
  units: number;
  kind: 'rental' | 'purchase';
  paidUsd: number;
  paidUnitUsd: number;
  /** The best-value non-contracted vendor for this code, or null if none prices it. */
  suggested: ProductVendorOption | null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

function scoreOption(paidUsd: number, unitUsd: number, extendedUsd: number, column: VendorColumn) {
  const savingsUsd = round2(paidUsd - extendedUsd);
  const savingsShare = paidUsd === 0 ? 0 : savingsUsd / paidUsd;

  const priceScore = clamp100(50 + savingsShare * 200);
  const reviewScore = clamp100(((column.vendor.overallRating - 1) / 4) * 100);
  const deliveryScore = clamp100(column.onTimePct);

  const valueScore = Math.round(
    priceScore * PRICE_WEIGHT + reviewScore * REVIEW_WEIGHT + deliveryScore * DELIVERY_WEIGHT,
  );

  const option: ProductVendorOption = {
    vendor: column.vendor,
    unitUsd,
    extendedUsd,
    savingsUsd,
    qualified: column.qualified,
    onTimePct: column.onTimePct,
    onTimePickupPct: column.onTimePickupPct,
    rating: column.vendor.overallRating,
    ratingCount: column.vendor.overallRatingCount,
    zipCoveragePct: column.zipCoveragePct,
    servedZipCount: column.servedZipCount,
    patientZipCount: column.patientZipCount,
    valueScore,
  };
  return option;
}

/** Every non-contracted vendor priced on this one code, scored and ranked best-value first. */
export function productVendorOptions(line: BasketLine, columns: VendorColumn[]): ProductVendorOption[] {
  const options: ProductVendorOption[] = [];
  for (const column of columns) {
    if (column.contracted) continue;
    const cell = line.prices.find((p) => p.vendorId === column.vendor.id);
    if (!cell || cell.unitUsd === null || cell.extendedUsd === null) continue;
    options.push(scoreOption(line.actualUsd, cell.unitUsd, cell.extendedUsd, column));
  }
  return options.sort((a, b) => b.valueScore - a.valueScore);
}

/** One row per ordered product this period, each with its own best-value alternative (if any). */
export function buildProductSavings(lines: BasketLine[], columns: VendorColumn[]): ProductSavingsRow[] {
  return lines
    .map((line) => {
      const options = productVendorOptions(line, columns);
      return {
        hcpcs: line.hcpcs,
        name: line.name,
        categoryLabel: line.categoryLabel,
        units: line.units,
        kind: line.kind,
        paidUsd: line.actualUsd,
        paidUnitUsd: line.units === 0 ? 0 : round2(line.actualUsd / line.units),
        suggested: options[0] ?? null,
      };
    })
    .sort((a, b) => (b.suggested?.savingsUsd ?? -Infinity) - (a.suggested?.savingsUsd ?? -Infinity));
}

/**
 * Total $ actually recoverable this period: only counts products where the suggested vendor beats
 * what was paid, never nets a premium on one product against a saving on another — the same rule
 * that keeps a single product's tile from calling a premium a saving applies to the sum of them.
 */
export function totalPotentialSavingsUsd(rows: ProductSavingsRow[]): number {
  return round2(rows.reduce((sum, row) => sum + Math.max(0, row.suggested?.savingsUsd ?? 0), 0));
}

/** How many products actually have a cheaper, real alternative — the tile's "N of M" detail. */
export function countGenuineSavings(rows: ProductSavingsRow[]): number {
  return rows.filter((row) => (row.suggested?.savingsUsd ?? 0) > 0).length;
}
