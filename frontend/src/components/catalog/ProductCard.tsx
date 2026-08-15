import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogProductVM } from '../../lib/catalog';
import { moneyLabel } from '../../lib/catalog';
import { ItemStarRating } from './ItemStarRating';

export function ProductCard({
  item,
  onOrderNow,
  aiReason,
}: {
  item: CatalogProductVM;
  onOrderNow: () => void;
  /** One short model-written line on why this ranked here (AI search only). */
  aiReason?: string;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const { offer, price, vendor, rating } = item;

  return (
    <article className="h-full min-w-0">
      <div className="group relative flex h-full flex-col">
        <div className="relative">
          <Link
            to={`/catalog/${offer.id}`}
            className="relative block aspect-square w-full cursor-pointer overflow-hidden border border-line bg-bg-subtle text-left transition-colors hover:border-line-strong lg:aspect-[3/4]"
          >
            {!imgBroken && (
              <img
                src={offer.imagePath}
                alt={offer.productName}
                onError={() => setImgBroken(true)}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
              />
            )}
            {imgBroken && (
              <>
                <div
                  className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.06]"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(135deg, var(--track) 0 8px, var(--bg-subtle) 8px 16px)',
                  }}
                />
                <div className="pointer-events-none absolute inset-x-2.5 top-2.5 grid gap-1 font-mono text-[11px] leading-tight text-ink-3">
                  <span>{offer.hcpcs}</span>
                  <span className="max-w-[80%]">{offer.description}</span>
                </div>
              </>
            )}
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onOrderNow();
            }}
            className="absolute bottom-2.5 right-2.5 border border-solid-bg bg-solid-bg px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-solid-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:opacity-100"
          >
            Add to cart
          </button>
        </div>

        {/* Fixed row heights keep every card the same total height regardless of how
            long the product name or vendor name is. */}
        <div className={`product-card-meta${aiReason ? ' has-ai' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <Link
              to={`/catalog/${offer.id}`}
              className="product-card-name min-w-0 text-[13.5px] font-medium tracking-tight transition-colors hover:text-ink-2"
            >
              {offer.productName}
            </Link>
            <div className="shrink-0 font-mono text-[13.5px] tabular-nums">
              {moneyLabel(price.amount)}
              {price.unit === '/mo' && <span className="text-ink-3">/mo</span>}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-3">
              <span className="text-sm font-semibold text-ink">{offer.deliveryLeadDays}</span>{' '}
              {offer.deliveryLeadDays === 1 ? 'day' : 'days'} to deliver
            </span>
            <ItemStarRating rating={rating} variant="compact" />
          </div>

          <div className="truncate text-xs text-ink-2">{vendor.displayName}</div>

          {aiReason && (
            <div className="flex min-w-0 items-center gap-1 text-[11px] text-ai-ink" data-testid="ai-reason">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
                <path d="M12 4l1.7 4.7L18.5 10l-4.8 1.6L12 16.5l-1.7-4.9L5.5 10l4.8-1.3L12 4Z" />
              </svg>
              <span className="min-w-0 truncate">{aiReason}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
