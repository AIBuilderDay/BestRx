import { useState } from 'react';
import type { CatalogProductVM } from '../../lib/catalog';
import { moneyLabel } from '../../lib/catalog';

export function ProductCard({
  item,
  qty,
  onQtyChange,
  inCartQty,
  onAddToCart,
  onBuyNow,
}: {
  item: CatalogProductVM;
  qty: number;
  onQtyChange: (n: number) => void;
  inCartQty: number;
  onAddToCart: () => void;
  onBuyNow: () => void;
}) {
  const [imgBroken, setImgBroken] = useState(false);
  const { entry, price, vendors, leadDays } = item;

  const step = (delta: number) => onQtyChange(Math.max(1, Math.min(99, qty + delta)));

  return (
    <article className="h-full min-w-0">
      <div className="group relative flex h-full flex-col">
        <div className="relative aspect-[3/4] overflow-hidden border border-[var(--color-line)] bg-bg-subtle transition-colors group-hover:border-[var(--color-line-strong)]">
          {!imgBroken && (
            <img
              src={entry.imagePath}
              alt={entry.name}
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
              <div className="pointer-events-none absolute inset-x-2.5 top-2.5 grid gap-1 font-mono text-[11px] leading-tight text-[var(--color-ink-3)]">
                <span>{entry.hcpcs}</span>
                <span className="max-w-[80%]">{entry.description}</span>
              </div>
            </>
          )}
          <div className="absolute bottom-2.5 left-2.5 flex items-center overflow-hidden border border-[var(--color-line-strong)] bg-surface/94 backdrop-blur-sm transition-colors group-hover:border-[var(--color-ink)]">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => step(-1)}
              className="h-7 w-7 leading-none transition-colors hover:bg-solid-bg hover:text-solid-ink"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={99}
              value={qty}
              onChange={(e) => onQtyChange(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
              aria-label="Quantity"
              className="quantity-input w-7.5 border-0 bg-transparent text-center font-mono text-[12.5px] tabular-nums focus:bg-surface focus:outline-none"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => step(1)}
              className="h-7 w-7 leading-none transition-colors hover:bg-solid-bg hover:text-solid-ink"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid h-[112px] content-start gap-2.5 pt-3.5">
          <div className="flex min-h-10 items-start justify-between gap-3">
            <div className="line-clamp-2 text-[13.5px] font-medium leading-5 tracking-tight">{entry.name}</div>
            <div className="shrink-0 font-mono text-[13.5px] tabular-nums">
              {moneyLabel(price.amount)}
              {price.unit === '/mo' && <span className="text-[var(--color-ink-3)]">/mo</span>}
            </div>
          </div>
          <div className="truncate text-xs text-[var(--color-ink-2)]">
            {vendors.length > 0 ? vendors.map((v) => v.name.replace('Sample ', '')).join(', ') : 'Vendor assigned at dispatch'}
          </div>
          <div className="flex items-baseline gap-1 text-xs text-[var(--color-ink-3)]">
            {leadDays !== null ? (
              <>
                <span className="font-mono font-medium tabular-nums text-[var(--color-ink)]">{leadDays}</span>
                <span>{leadDays === 1 ? 'day to deliver' : 'days to deliver'}</span>
              </>
            ) : (
              <span>Delivery time unavailable</span>
            )}
          </div>
        </div>

        <div className="mt-auto grid grid-cols-[1fr_auto] gap-1.5 pt-3">
          <button
            type="button"
            onClick={onAddToCart}
            className="border border-solid-bg bg-solid-bg px-3 py-2.5 text-[11px] uppercase tracking-[0.09em] text-solid-ink transition-opacity hover:opacity-85"
          >
            {inCartQty > 0 ? `In cart · ${inCartQty}` : 'Add to cart'}
          </button>
          <button
            type="button"
            onClick={onBuyNow}
            title="Order now"
            className="border border-[var(--color-line-strong)] bg-surface px-3 py-2.5 text-[11px] uppercase tracking-[0.09em] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink)] hover:bg-solid-bg hover:text-solid-ink"
          >
            Order now
          </button>
        </div>
      </div>
    </article>
  );
}
