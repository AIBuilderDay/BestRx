import { moneyLabel, patientFullName, type CatalogProductVM } from '../../lib/catalog';
import type { Patient } from '../../types/domain';

export interface PlacedOrderDetails {
  product: CatalogProductVM;
  patients: Patient[];
  qty: number;
}

/** Confirmation after a direct catalog order — not routed through the cart. */
export function OrderPlacedDialog({
  order,
  onClose,
}: {
  order: PlacedOrderDetails | null;
  onClose: () => void;
}) {
  if (!order) return null;

  const { product, patients: orderPatients, qty } = order;
  const patientLabel =
    orderPatients.length === 1
      ? patientFullName(orderPatients[0])
      : `${orderPatients.length} patients`;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/20 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] animate-[sheetIn_0.45s_cubic-bezier(0.2,0.7,0.2,1)_both] border border-ink bg-surface p-5.5"
        role="dialog"
        aria-labelledby="order-placed-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-ink-3">Order confirmed</div>
            <h2 id="order-placed-title" className="mt-1.5 text-[17px] tracking-tight">
              Your order has been placed for
            </h2>
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

        <dl className="mt-4 grid gap-2 border border-line bg-bg-subtle p-3.5 text-[13px]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            <dt className="text-ink-3">Item</dt>
            <dd className="text-right font-medium">{product.offer.productName}</dd>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            <dt className="text-ink-3">Vendor</dt>
            <dd className="text-right">{product.vendor.displayName}</dd>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            <dt className="text-ink-3">Patient</dt>
            <dd className="text-right">{patientLabel}</dd>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            <dt className="text-ink-3">Quantity</dt>
            <dd className="text-right font-mono tabular-nums">{qty}</dd>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            <dt className="text-ink-3">Lead time</dt>
            <dd className="text-right">
              {product.offer.deliveryLeadDays} {product.offer.deliveryLeadDays === 1 ? 'day' : 'days'}
            </dd>
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            <dt className="text-ink-3">Price</dt>
            <dd className="text-right font-mono tabular-nums">
              {moneyLabel(product.price.amount * qty)}
              {product.price.unit === '/mo' ? '/mo' : ''}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full border border-solid-bg bg-solid-bg py-3.5 text-[11px] uppercase tracking-[0.1em] text-solid-ink transition-opacity hover:opacity-85"
        >
          Done
        </button>
      </div>
    </div>
  );
}
