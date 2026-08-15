/**
 * Per-product vendor recommendations for the "Potential Savings" card — for every HCPCS code this
 * hospice actually ordered this period, which non-contracted vendor is the best value, and what
 * switching to it on that code alone would have cost or saved.
 *
 * The hospice's contracted (current) vendor is never "the suggestion." Beyond that, a vendor whose
 * service area reaches none of the hospice's patient locations is dropped before scoring — an
 * unreachable vendor isn't a real alternative, whatever its price. Every remaining vendor priced on
 * that code is scored and surfaced, never silently dropped.
 *
 * The value score is a weighted blend of three 1-5 criteria, remapped to 0-100 for display:
 *   Savings (60%)       — the heaviest factor. No savings is 1/5; $100 total savings is 3.5/5;
 *                         $200+ total savings reaches 5/5. Cost premiums then subtract up to 30
 *                         points: about $5 extra stays near 50, while $1,000 extra lands near 20.
 *   Vendor rating (30%) — vendor.overallRating, already a 1-5 scale.
 *   Local service (10%) — 5/5 if every patient location is served, 3/5 if only some are served.
 * Vendors that reach none of the hospice's locations are still excluded before scoring — an
 * unreachable vendor isn't a real alternative. This is BestRx's own scoring methodology, not a
 * fact about the vendor — every consumer must label it "Value score," never present it as something
 * the vendor reports about itself.
 */

import type { BasketLine, VendorColumn } from './costLedger';
import type { PreferredVendorMap } from './preferredVendors';
import type { Vendor } from '../types/domain';

export const SAVINGS_WEIGHT = 0.6;
export const RATING_WEIGHT = 0.3;
export const LOCAL_SERVICE_WEIGHT = 0.1;
export const LOSS_FREE_PREMIUM_USD = 5;
export const FULL_LOSS_PENALTY_USD = 1000;
export const MAX_LOSS_VALUE_PENALTY = 30;

export interface ValueScoreCriteria {
  savingsScore: number;
  ratingScore: number;
  localServiceScore: number;
  lossPenalty: number;
}

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
  /** "City, ST" patient locations this vendor reaches. Always non-empty — see productVendorOptions. */
  servedLocations: string[];
  /** "City, ST" patient locations this vendor does NOT reach. */
  unservedLocations: string[];
  /** 0-100, BestRx's own weighted score — see module doc comment. */
  valueScore: number;
  valueCriteria: ValueScoreCriteria;
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
const clamp5 = (n: number): number => Math.max(1, Math.min(5, n));
const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

function savingsScoreFor(paidUsd: number, savingsUsd: number): number {
  if (paidUsd === 0 || savingsUsd <= 0) return 1;
  return round2(clamp5(2 + (savingsUsd / 200) * 3));
}

function lossPenaltyFor(savingsUsd: number): number {
  if (savingsUsd >= -LOSS_FREE_PREMIUM_USD) return 0;
  const lossUsd = Math.abs(savingsUsd);
  const penaltySpan = FULL_LOSS_PENALTY_USD - LOSS_FREE_PREMIUM_USD;
  return round2(
    clamp100(((lossUsd - LOSS_FREE_PREMIUM_USD) / penaltySpan) * MAX_LOSS_VALUE_PENALTY),
  );
}

function scoreOption(paidUsd: number, unitUsd: number, extendedUsd: number, column: VendorColumn) {
  const savingsUsd = round2(paidUsd - extendedUsd);

  const valueCriteria: ValueScoreCriteria = {
    savingsScore: savingsScoreFor(paidUsd, savingsUsd),
    ratingScore: round2(clamp5(column.vendor.overallRating)),
    localServiceScore: column.unservedLocations.length === 0 ? 5 : 3,
    lossPenalty: lossPenaltyFor(savingsUsd),
  };

  const unpenalizedScore =
    ((valueCriteria.savingsScore * SAVINGS_WEIGHT +
      valueCriteria.ratingScore * RATING_WEIGHT +
      valueCriteria.localServiceScore * LOCAL_SERVICE_WEIGHT) /
      5) *
    100;
  const valueScore = Math.round(clamp100(unpenalizedScore - valueCriteria.lossPenalty));

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
    servedLocations: column.servedLocations,
    unservedLocations: column.unservedLocations,
    valueScore,
    valueCriteria,
  };
  return option;
}

/**
 * Every non-contracted vendor priced on this one code that can actually reach the hospice's
 * patients, scored and ranked best-value first. A vendor reaching none of them is excluded
 * entirely, however it would have scored — it isn't a usable alternative.
 */
export function productVendorOptions(line: BasketLine, columns: VendorColumn[]): ProductVendorOption[] {
  const options: ProductVendorOption[] = [];
  for (const column of columns) {
    if (column.contracted) continue;
    if (column.servedLocations.length === 0) continue;
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

function hasAcceptedSuggestion(row: ProductSavingsRow, preferredVendors: PreferredVendorMap): boolean {
  return row.suggested !== null && preferredVendors[row.hcpcs] === row.suggested.vendor.id;
}

/**
 * Total $ actually recoverable this period: only counts products where the suggested vendor beats
 * what was paid, never nets a premium on one product against a saving on another — the same rule
 * that keeps a single product's tile from calling a premium a saving applies to the sum of them.
 * Suggestions already accepted via "Use this vendor" are no longer potential savings.
 */
export function totalPotentialSavingsUsd(rows: ProductSavingsRow[], preferredVendors: PreferredVendorMap = {}): number {
  return round2(
    rows.reduce((sum, row) => {
      if (hasAcceptedSuggestion(row, preferredVendors)) return sum;
      return sum + Math.max(0, row.suggested?.savingsUsd ?? 0);
    }, 0),
  );
}

/** How many products actually have a cheaper, real alternative — the tile's "N of M" detail. */
export function countGenuineSavings(rows: ProductSavingsRow[], preferredVendors: PreferredVendorMap = {}): number {
  return rows.filter(
    (row) => (row.suggested?.savingsUsd ?? 0) > 0 && !hasAcceptedSuggestion(row, preferredVendors),
  ).length;
}
