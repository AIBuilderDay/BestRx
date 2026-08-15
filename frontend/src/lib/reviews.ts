/**
 * Rating helpers derived from product_reviews.json. Individual reviews are the source of truth;
 * averages are computed here for display only. Session reviews (added in the UI) merge in at read time.
 */

import { getOffersForVendor, getReviewsForOffer, getReviewsForVendor, getUser } from '../data/db';
import type { OfferRatingSummary, ProductReview } from '../types/domain';

export function reviewsForOffer(offerId: string, sessionReviews: ProductReview[] = []): ProductReview[] {
  const session = sessionReviews.filter((r) => r.offerId === offerId);
  return [...getReviewsForOffer(offerId), ...session];
}

export function ratingSummaryFromReviews(reviews: ProductReview[]): OfferRatingSummary | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((total, review) => total + normalizeStarRating(review.rating), 0);
  return {
    average: Math.round((sum / reviews.length) * 10) / 10,
    count: reviews.length,
  };
}

/** Coerce stored ratings to whole stars 1–5 (guards bad JSON). */
export function normalizeStarRating(rating: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(rating);
  return Math.max(1, Math.min(5, rounded)) as 1 | 2 | 3 | 4 | 5;
}

export function offerRatingSummary(offerId: string, sessionReviews: ProductReview[] = []): OfferRatingSummary | null {
  return ratingSummaryFromReviews(reviewsForOffer(offerId, sessionReviews));
}

/** Vendor-wide average across every review on that vendor's offers. For DON/admin scorecards only. */
export function vendorRatingSummary(vendorId: string, sessionReviews: ProductReview[] = []): OfferRatingSummary | null {
  const offerIds = new Set(getOffersForVendor(vendorId).map((o) => o.id));
  const sessionForVendor = sessionReviews.filter((r) => offerIds.has(r.offerId));
  const reviews = [...getReviewsForVendor(vendorId), ...sessionForVendor];
  return ratingSummaryFromReviews(reviews);
}

export function formatReviewDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function reviewerLabel(reviewerId: string): string {
  const user = getUser(reviewerId);
  if (!user) return 'Hospice staff';
  return user.name.split(' ')[0];
}

export function createSessionReview(
  offerId: string,
  reviewerId: string,
  rating: number,
  comment: string,
): ProductReview {
  const reviewedAt = new Date().toISOString().slice(0, 19) + '-06:00';
  return {
    id: `REV-S-${Date.now()}`,
    offerId,
    rating,
    reviewedAt,
    reviewerId,
    comment: comment.trim(),
  };
}

export type ReviewStarFilter = 'all' | 1 | 2 | 3 | 4 | 5;

export function reviewCountsByStar(reviews: ProductReview[]): Record<1 | 2 | 3 | 4 | 5, number> {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of reviews) {
    counts[normalizeStarRating(review.rating)]++;
  }
  return counts;
}

export function filterReviewsByStar(reviews: ProductReview[], filter: ReviewStarFilter): ProductReview[] {
  if (filter === 'all') return reviews;
  return reviews.filter((r) => normalizeStarRating(r.rating) === filter);
}
