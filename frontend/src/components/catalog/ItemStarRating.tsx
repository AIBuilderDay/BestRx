import type { OfferRatingSummary } from '../../types/domain';

/** Per-item star rating — always tied to the product, never the vendor. */
export function ItemStarRating({
  rating,
  size = 'sm',
  variant = 'full',
}: {
  rating: OfferRatingSummary | null;
  size?: 'sm' | 'md';
  /** `compact` matches the catalog card: score then star, no review count. */
  variant?: 'full' | 'compact';
}) {
  if (!rating) return null;

  const text = size === 'md' ? 'text-sm' : 'text-xs';
  const label = `${rating.average.toFixed(1)} out of 5 stars from ${rating.count} reviews for this item`;

  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-baseline gap-1 font-mono tabular-nums ${text} text-ink`} aria-label={label}>
        {rating.average.toFixed(1)}
        <span aria-hidden>★</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-baseline gap-1 ${text} text-ink-2`} aria-label={label}>
      <span className="text-ink">★ {rating.average.toFixed(1)}</span>
      <span className="text-ink-3">({rating.count})</span>
    </span>
  );
}
