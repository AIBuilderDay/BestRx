import { useEffect, useState } from 'react';
import { moneyLabel, type CatalogProductVM } from '../../lib/catalog';

/**
 * Family-facing add-to-cart modal. Unlike the staff PatientAssignSheet there is no patient to pick —
 * a family member only ever orders for their own loved one — so it is just a quantity step. Whether
 * the cart is sent to the hospice as a request or bought directly is chosen later, in the cart.
 */
export function FamilyPurchaseSheet({
  product,
  patientName,
  onClose,
  onAddToCart,
}: {
  product: CatalogProductVM | null;
  patientName: string;
  onClose: () => void;
  onAddToCart: (qty: number) => void;
}) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (product) setQty(1);
  }, [product?.offer.id]);

  if (!product) return null;

  const unit = product.price.unit === '/mo' ? '/mo' : '';
  const step = (delta: number) => setQty((v) => Math.max(1, Math.min(99, v + delta)));

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/20 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] animate-sheet-in motion-reduce:animate-none border border-ink bg-surface p-5.5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-ink-3">For {patientName}</div>
            <div className="mt-1.5 text-[17px] tracking-tight">{product.offer.productName}</div>
            <div className="mt-0.5 text-xs text-ink-2">
              {product.offer.hcpcs} · {product.vendor.displayName} · {moneyLabel(product.price.amount)}
              {unit}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-[15px] leading-none text-ink-3 transition-transform hover:rotate-90 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="my-6 flex items-center justify-center gap-4">
          <div className="inline-flex items-center overflow-hidden border border-line-strong bg-surface">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => step(-1)}
              className="h-10 w-10 text-lg leading-none transition-colors hover:bg-solid-bg hover:text-solid-ink"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={99}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
              aria-label="Quantity"
              className="quantity-input w-12 border-0 bg-transparent text-center font-mono text-base tabular-nums focus:bg-surface focus:outline-none"
            />
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => step(1)}
              className="h-10 w-10 text-lg leading-none transition-colors hover:bg-solid-bg hover:text-solid-ink"
            >
              +
            </button>
          </div>
          <div className="text-sm">
            <span className="font-mono tabular-nums">{moneyLabel(product.price.amount * qty)}</span>
            {unit} total
          </div>
        </div>

        <button
          type="button"
          onClick={() => onAddToCart(qty)}
          className="w-full border border-solid-bg bg-solid-bg py-3.5 text-[11px] uppercase tracking-[0.1em] text-solid-ink transition-opacity hover:opacity-85"
        >
          Add to cart
        </button>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
          Choose to request it from the hospice or buy it yourself when you check out.
        </p>
      </div>
    </div>
  );
}
