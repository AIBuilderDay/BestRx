import { describe, expect, it } from 'vitest';
import { sortReviews } from './reviews';
import type { ProductReview } from '../types/domain';

const review = (id: string, reviewedAt: string, rating: number): ProductReview => ({
  id,
  offerId: 'OFR-001',
  rating,
  reviewedAt,
  reviewerId: 'USR-002',
  comment: 'Arrived as scheduled.',
});

const reviews: ProductReview[] = [
  review('a', '2026-06-01T10:00:00-06:00', 3),
  review('c', '2026-06-03T10:00:00-06:00', 5),
  review('b', '2026-06-02T10:00:00-06:00', 5),
];

const ids = (rows: ProductReview[]) => rows.map((r) => r.id);

describe('sortReviews', () => {
  it('puts the newest review first by default order', () => {
    expect(ids(sortReviews(reviews, 'recent'))).toEqual(['c', 'b', 'a']);
  });

  it('reverses to oldest first', () => {
    expect(ids(sortReviews(reviews, 'oldest'))).toEqual(['a', 'b', 'c']);
  });

  it('breaks rating ties on the newer review', () => {
    expect(ids(sortReviews(reviews, 'highest'))).toEqual(['c', 'b', 'a']);
    expect(ids(sortReviews(reviews, 'lowest'))).toEqual(['a', 'c', 'b']);
  });

  it('leaves the caller’s array untouched', () => {
    sortReviews(reviews, 'lowest');
    expect(ids(reviews)).toEqual(['a', 'c', 'b']);
  });
});
