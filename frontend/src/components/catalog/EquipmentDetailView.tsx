import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '../../types/domain';
import { CATEGORY_LABELS, paginateItems, RESET_CATALOG_FILTERS_STATE, moneyLabel, type CatalogProductVM } from '../../lib/catalog';
import {
  filterReviewsByStar,
  formatReviewDate,
  normalizeStarRating,
  offerRatingSummary,
  reviewCountsByStar,
  reviewerLabel,
  reviewsForOffer,
  type ReviewStarFilter,
} from '../../lib/reviews';
import type { ProductReview } from '../../types/domain';
import { CatalogPagination } from './CatalogPagination';
import { ItemStarRating } from './ItemStarRating';

const REVIEWS_PAGE_SIZE = 5;

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(n)}
          className={`px-0.5 text-lg leading-none transition-opacity hover:opacity-100 ${
            n <= value ? 'text-ink opacity-100' : 'text-ink-3 opacity-50'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

const STAR_FILTERS: { key: ReviewStarFilter; label: string }[] = [
  { key: 'all', label: 'All stars' },
  { key: 5, label: '5 star' },
  { key: 4, label: '4 star' },
  { key: 3, label: '3 star' },
  { key: 2, label: '2 star' },
  { key: 1, label: '1 star' },
];

/** Full catalog main-panel view for one vendor SKU — mirrors the patient detail page layout. */
export function EquipmentDetailView({
  product,
  user,
  sessionReviews,
  onAddReview,
  onAddToCart,
}: {
  product: CatalogProductVM;
  user: User;
  sessionReviews: ProductReview[];
  onAddReview: (rating: number, comment: string) => void;
  onAddToCart: () => void;
}) {
  const [draftRating, setDraftRating] = useState(5);
  const [draftComment, setDraftComment] = useState('');
  const [starFilter, setStarFilter] = useState<ReviewStarFilter>('all');
  const [reviewPage, setReviewPage] = useState(1);
  const [imgBroken, setImgBroken] = useState(false);

  const reviews = useMemo(
    () =>
      reviewsForOffer(product.offer.id, sessionReviews)
        .slice()
        .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)),
    [product.offer.id, sessionReviews],
  );

  const starCounts = useMemo(() => reviewCountsByStar(reviews), [reviews]);
  const filteredReviews = useMemo(
    () => filterReviewsByStar(reviews, starFilter),
    [reviews, starFilter],
  );
  const reviewPageData = useMemo(
    () => paginateItems(filteredReviews, reviewPage, REVIEWS_PAGE_SIZE),
    [filteredReviews, reviewPage],
  );

  useEffect(() => {
    setReviewPage(1);
  }, [starFilter, product.offer.id]);

  const rating = offerRatingSummary(product.offer.id, sessionReviews);
  const { offer, price, vendor } = product;
  const inStockLabel = offer.inStock ? 'In stock' : 'Out of stock — longer lead time';

  const submitReview = () => {
    const comment = draftComment.trim();
    if (!comment) return;
    onAddReview(draftRating, comment);
    setDraftRating(5);
    setDraftComment('');
  };

  const filterCount = (key: ReviewStarFilter) => (key === 'all' ? reviews.length : starCounts[key]);

  const applyStarFilter = (key: ReviewStarFilter) => {
    setStarFilter(key);
  };

  return (
    <>
      <Link
        to="/catalog"
        state={RESET_CATALOG_FILTERS_STATE}
        className="mb-4 inline-flex items-center gap-2 border border-line-strong bg-surface px-3 py-1.5 text-[13px] transition-colors hover:bg-hover"
      >
        <span className="text-sm leading-none">←</span>
        <span>Catalog</span>
      </Link>

      <div className="mb-6 flex gap-5">
        <div className="w-[min(42%,200px)] min-w-[160px] flex-none self-stretch overflow-hidden border border-line bg-bg-subtle">
          {!imgBroken ? (
            <img
              src={offer.imagePath}
              alt={offer.productName}
              onError={() => setImgBroken(true)}
              className="h-full min-h-[200px] w-full object-cover"
            />
          ) : (
            <div
              className="h-full min-h-[200px] w-full"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(135deg, var(--track) 0 6px, var(--hover) 6px 12px)',
              }}
            />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <div className="text-xs text-ink-3">{vendor.displayName}</div>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h1 className="text-[22px] font-semibold tracking-tight">{offer.productName}</h1>
            <ItemStarRating rating={rating} size="md" />
          </div>
          <div className="mt-1 font-mono text-lg tabular-nums">
            {moneyLabel(price.amount)}
            {price.unit === '/mo' ? <span className="text-sm text-ink-3">/mo</span> : null}
          </div>
          <button
            type="button"
            onClick={onAddToCart}
            className="mt-3 w-fit cursor-pointer self-start border border-solid-bg bg-solid-bg px-3 py-1.5 text-[11px] uppercase tracking-[0.09em] text-solid-ink transition-opacity hover:opacity-85"
          >
            Add to cart
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <section className="overflow-hidden border border-line bg-surface">
          <div className="border-b border-line bg-bg-subtle px-4 py-3.5">
            <h2 className="text-[13px] font-semibold tracking-tight">Listing details</h2>
          </div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 p-4 text-[13px]">
            <dt className="text-ink-3">Vendor</dt>
            <dd className="text-right">{vendor.displayName}</dd>
            <dt className="text-ink-3">Code</dt>
            <dd className="text-right font-mono tabular-nums">{offer.hcpcs}</dd>
            <dt className="text-ink-3">Category</dt>
            <dd className="text-right">{CATEGORY_LABELS[offer.category]}</dd>
            <dt className="text-ink-3">Lead time</dt>
            <dd className="text-right">
              {offer.deliveryLeadDays} {offer.deliveryLeadDays === 1 ? 'day' : 'days'}
            </dd>
            <dt className="text-ink-3">Availability</dt>
            <dd className="text-right">{inStockLabel}</dd>
          </dl>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="border border-line bg-surface p-4">
            <h2 className="mb-2.5 text-[13px] font-semibold tracking-tight">Description</h2>
            <p className="text-[13px] leading-relaxed text-ink-2">{offer.description}</p>
          </section>
        </div>
      </div>

      <section className="mt-8 overflow-hidden border border-line bg-surface">
        <div className="border-b border-line bg-bg-subtle px-4 py-3.5">
          <h2 className="text-[13px] font-semibold tracking-tight">Reviews for this item</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            Ratings are for this specific listing from nurses who received it — not the vendor overall.
          </p>
        </div>

        <div className="grid gap-5 p-4 lg:grid-cols-[200px_minmax(0,1fr)]">
          <div className="grid content-start gap-1">
            {STAR_FILTERS.map(({ key, label }) => {
              const count = filterCount(key);
              const active = starFilter === key;
              return (
                <button
                  key={String(key)}
                  type="button"
                  onClick={() => applyStarFilter(key)}
                  disabled={count === 0 && key !== 'all'}
                  className={`flex items-center justify-between border px-2.5 py-2 text-left text-xs transition-colors ${
                    active
                      ? 'border-ink bg-hover text-ink'
                      : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40'
                  }`}
                >
                  <span>{label}</span>
                  <span className="font-mono tabular-nums text-ink-3">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="min-w-0">
            <ul className="grid gap-0">
              {filteredReviews.length === 0 ? (
                <li className="py-4 text-xs text-ink-3">No reviews match this filter.</li>
              ) : (
                reviewPageData.items.map((review) => {
                  const stars = normalizeStarRating(review.rating);
                  return (
                    <li key={review.id} className="border-t border-line py-4 first:border-t-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                        <span className="font-medium text-ink-2">{reviewerLabel(review.reviewerId)}</span>
                        <span className="font-mono text-ink">
                          {'★'.repeat(stars)}
                          {'☆'.repeat(5 - stars)}
                        </span>
                        <span className="tabular-nums text-ink-3">{formatReviewDate(review.reviewedAt)}</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{review.comment}</p>
                    </li>
                  );
                })
              )}
            </ul>

            {filteredReviews.length > REVIEWS_PAGE_SIZE ? (
              <CatalogPagination
                page={reviewPageData.page}
                totalPages={reviewPageData.totalPages}
                firstItem={reviewPageData.firstItem}
                lastItem={reviewPageData.lastItem}
                totalItems={filteredReviews.length}
                onPageChange={setReviewPage}
                ariaLabel="Review pages"
              />
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden border border-line bg-surface">
        <div className="border-b border-line bg-bg-subtle px-4 py-3.5">
          <h2 className="text-[13px] font-semibold tracking-tight">Add your review</h2>
        </div>
        <div className="p-4">
          <StarPicker value={draftRating} onChange={setDraftRating} />
          <textarea
            value={draftComment}
            onChange={(e) => setDraftComment(e.target.value)}
            placeholder="Share what happened with this delivery — timing, setup, family experience."
            rows={3}
            className="mt-2.5 w-full resize-y border border-line bg-surface px-2.5 py-2 text-[13px] text-ink outline-none focus:border-line-strong"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-ink-3">Posting as {user.name.split(' ')[0]}</span>
            <button
              type="button"
              onClick={submitReview}
              disabled={!draftComment.trim()}
              className="cursor-pointer border border-line-strong bg-surface px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-ink-2 transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
