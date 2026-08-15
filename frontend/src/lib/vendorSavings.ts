/**
 * Vendor-level savings ranking for the "Potential Savings" card — replaces a single price delta
 * against the cheapest floor-clearing vendor with a weighted value score across price, reviews,
 * delivery reliability, and how much of this hospice's patient area the vendor can actually reach.
 *
 * Only the hospice's contracted (current) vendor is excluded — every other vendor priced against
 * the same basket is a real option, listed and scored, never hard-filtered out. A vendor that
 * can't currently serve any of this hospice's patients (0% ZIP coverage) still appears, but the
 * coverage term in its score pulls it down hard, because a price nobody can act on isn't a value.
 *
 * The four terms, each normalized to 0-100 before combining:
 *   Price (30%)     — how much cheaper (or pricier) the vendor's basket total is than what was
 *                      actually paid, scaled so a 25%-of-spend swing moves the term the full 50
 *                      points off center.
 *   Reviews (25%)   — vendor.overallRating, 1-5 stars mapped onto 0-100.
 *   Delivery (20%)  — trailing 30-day on-time delivery percentage, already 0-100.
 *   Coverage (25%)  — share of this hospice's patient ZIP codes the vendor's service area reaches.
 * This is BestRx's own scoring methodology, not a fact about the vendor — every consumer must
 * label it "Value score," never present it as something the vendor reports about itself.
 */

import type { BasketTotals, VendorColumn } from './costLedger';
import type { Vendor } from '../types/domain';

export type SavingsSortMode = 'value' | 'price-asc' | 'price-desc';

export const PRICE_WEIGHT = 0.3;
export const REVIEW_WEIGHT = 0.25;
export const DELIVERY_WEIGHT = 0.2;
export const COVERAGE_WEIGHT = 0.25;

export interface VendorSavingsOption {
  vendor: Vendor;
  basketTotalUsd: number;
  /** actualPaidUsd - basketTotalUsd. Positive = cheaper than what was paid, negative = a premium. */
  savingsUsd: number;
  qualified: boolean;
  onTimePct: number;
  onTimePickupPct: number;
  avgDeliveryHours: number;
  rating: number;
  ratingCount: number;
  zipCoveragePct: number;
  servedZipCount: number;
  patientZipCount: number;
  /** 0-100, BestRx's own weighted score — see module doc comment. */
  valueScore: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

/** Every non-contracted vendor that can price the whole basket, scored and ready to sort. */
export function vendorSavingsOptions(
  totals: BasketTotals,
  columns: VendorColumn[],
): VendorSavingsOption[] {
  const options: VendorSavingsOption[] = [];

  for (const column of columns) {
    if (column.contracted) continue;
    const basketTotalUsd = totals.perVendorUsd[column.vendor.id] ?? null;
    if (basketTotalUsd === null) continue;

    const savingsUsd = round2(totals.actualUsd - basketTotalUsd);
    const savingsShare = totals.actualUsd === 0 ? 0 : savingsUsd / totals.actualUsd;

    const priceScore = clamp100(50 + savingsShare * 200);
    const reviewScore = clamp100(((column.vendor.overallRating - 1) / 4) * 100);
    const deliveryScore = clamp100(column.onTimePct);
    const coverageScore = clamp100(column.zipCoveragePct);

    const valueScore = Math.round(
      priceScore * PRICE_WEIGHT +
        reviewScore * REVIEW_WEIGHT +
        deliveryScore * DELIVERY_WEIGHT +
        coverageScore * COVERAGE_WEIGHT,
    );

    options.push({
      vendor: column.vendor,
      basketTotalUsd,
      savingsUsd,
      qualified: column.qualified,
      onTimePct: column.onTimePct,
      onTimePickupPct: column.onTimePickupPct,
      avgDeliveryHours: column.vendor.performance30d.avgDeliveryHours,
      rating: column.vendor.overallRating,
      ratingCount: column.vendor.overallRatingCount,
      zipCoveragePct: column.zipCoveragePct,
      servedZipCount: column.servedZipCount,
      patientZipCount: column.patientZipCount,
      valueScore,
    });
  }

  return options;
}

export function sortVendorSavings(
  options: VendorSavingsOption[],
  mode: SavingsSortMode,
): VendorSavingsOption[] {
  const sorted = [...options];
  if (mode === 'price-asc') return sorted.sort((a, b) => a.basketTotalUsd - b.basketTotalUsd);
  if (mode === 'price-desc') return sorted.sort((a, b) => b.basketTotalUsd - a.basketTotalUsd);
  return sorted.sort((a, b) => b.valueScore - a.valueScore);
}
