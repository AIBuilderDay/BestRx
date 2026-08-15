import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogProductVM, PriceUnit } from '../../lib/catalog';
import { moneyLabel, offerPriceFor } from '../../lib/catalog';
import { ItemStarRating } from './ItemStarRating';

export function ProductCard({
  item,
  unit,
  onUnitChange,
  onOrderNow,
  aiReason,
}: {
  item: CatalogProductVM;
  /** The arrangement this card is showing — the page mode, or its own override. */
  unit: PriceUnit;
  onUnitChange: (next: PriceUnit) => void;
  onOrderNow: () => void;
  /** One short model-written line on why this ranked here (AI search only). */
  aiReason?: string;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const { offer, vendor, rating } = item;

  return (
    <article className="h-full min-w-0">
      {/* One border around the whole card, so the meta block is enclosed rather than
          trailing off below the image. Segments inside use dividers, not their own boxes. */}
      <div className="group relative flex h-full flex-col overflow-hidden border border-line transition-colors hover:border-line-strong">
        <div className="relative">
          <Link
            to={`/catalog/${offer.id}`}
            className="relative block aspect-[3/4] w-full cursor-pointer overflow-hidden bg-bg-subtle text-left"
          >
            {!imgBroken && (
              <img
                src={offer.imagePath}
                alt={offer.productName}
                // Off-screen cards wait their turn: a full grid of product photos otherwise
                // competes for bandwidth and leaves visible cards on the fallback for seconds.
                loading="lazy"
                decoding="async"
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
            className="absolute bottom-3 right-3 cursor-pointer bg-solid-bg px-3.5 py-2 text-[10px] uppercase tracking-[0.1em] text-solid-ink opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:opacity-100"
          >
            Add to cart
          </button>
        </div>

        {/* Both arrangements priced side by side, so the rental/purchase comparison needs no
            interaction. The filled cell is the one the card is currently pricing at. */}
        <PriceSplitBar item={item} unit={unit} onUnitChange={onUnitChange} />

        {/* Fixed row heights keep every card the same total height regardless of how
            long the product name or vendor name is. */}
        <div className={`product-card-meta px-3.5 pb-3.5${aiReason ? ' has-ai' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <Link
              to={`/catalog/${offer.id}`}
              className="product-card-name min-w-0 text-[15px] font-medium tracking-tight transition-colors hover:text-ink-2"
            >
              {offer.productName}
            </Link>
            <ItemStarRating rating={rating} variant="compact" />
          </div>

          <div className="text-xs text-ink-3">
            <span className="text-sm font-semibold text-ink">{offer.deliveryLeadDays}</span>{' '}
            {offer.deliveryLeadDays === 1 ? 'day' : 'days'} to deliver
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

const UNIT_LABEL: Record<PriceUnit, string> = { month: 'Rental', purchase: 'Purchase' };

/**
 * The rent-versus-buy bar under the image: one cell per arrangement the vendor actually offers,
 * each showing its own price. Picking a cell repoints the card (and its add-to-cart) at that unit.
 * An offer with only one arrangement renders a single full-width cell that is not a button —
 * there is nothing to choose between.
 */
function PriceSplitBar({
  item,
  unit,
  onUnitChange,
}: {
  item: CatalogProductVM;
  unit: PriceUnit;
  onUnitChange: (next: PriceUnit) => void;
}) {
  const units = item.availableUnits;
  const single = units.length < 2;

  return (
    <div
      className="grid divide-x divide-line border-y border-line"
      style={{ gridTemplateColumns: `repeat(${Math.max(units.length, 1)}, minmax(0, 1fr))` }}
      role={single ? undefined : 'group'}
      aria-label={single ? undefined : 'Rental or purchase'}
    >
      {units.map((u) => {
        const price = offerPriceFor(item.offer, u);
        if (!price) return null;
        const active = u === unit;

        const body = (
          <>
            <span className="text-[11px] uppercase tracking-[0.12em] opacity-70">{UNIT_LABEL[u]}</span>
            <span className="font-mono text-[19px] font-semibold tabular-nums">
              {moneyLabel(price.amount)}
              {price.unit === '/mo' && <span className="text-[15px] font-normal opacity-60">/mo</span>}
            </span>
          </>
        );

        const tone = active ? 'bg-solid-bg text-solid-ink' : 'bg-surface text-ink-3';
        const cell = 'flex flex-col gap-0.5 px-3.5 py-2.5 text-left';

        if (single) {
          return (
            <div key={u} className={`${cell} ${tone}`}>
              {body}
            </div>
          );
        }

        return (
          <button
            key={u}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onUnitChange(u);
            }}
            aria-pressed={active}
            className={`${cell} ${tone} cursor-pointer transition-colors ${active ? '' : 'hover:bg-hover hover:text-ink-2'}`}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
