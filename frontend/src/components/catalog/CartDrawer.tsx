import type { CartGroupVM, CartTotals } from '../../lib/catalog';
import { moneyLabel } from '../../lib/catalog';

export function CartDrawer({
  open,
  groups,
  totals,
  onQtyChange,
  onRemove,
  onClose,
  onPlaceOrder,
}: {
  open: boolean;
  groups: CartGroupVM[];
  totals: CartTotals;
  onQtyChange: (hcpcs: string, patientId: string, qty: number) => void;
  onRemove: (hcpcs: string, patientId: string) => void;
  onClose: () => void;
  onPlaceOrder: () => void;
}) {
  const unitCount = groups.reduce((n, g) => n + g.lines.reduce((m, l) => m + l.qty, 0), 0);
  const empty = groups.length === 0;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/18 transition-opacity duration-450 ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      <section
        className={`fixed inset-y-0 right-0 z-50 flex w-98 max-w-[92vw] flex-col border-l border-[var(--color-line)] bg-white shadow-2xl transition-transform duration-500 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5.5 pb-4 pt-5.5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-3)]">Cart</div>
            <div className="mt-1.5 text-lg tracking-tight">{unitCount ? `${unitCount} item${unitCount > 1 ? 's' : ''}` : 'Empty'}</div>
            <div className="mt-1 text-xs text-[var(--color-ink-2)]">
              {groups.length
                ? `${groups.length} patient${groups.length > 1 ? 's' : ''} in this order`
                : 'Equipment is assigned per patient as you add it.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="p-1 text-[15px] leading-none text-[var(--color-ink-3)] transition-transform hover:rotate-90 hover:text-[var(--color-ink)]"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5.5 py-4">
          <div className="grid gap-5.5">
            {groups.map((g) => (
              <div key={g.patientId} className="animate-[chipIn_0.35s_cubic-bezier(0.2,0.7,0.2,1)_both]">
                <div className="flex items-baseline justify-between gap-2.5 border-b border-[var(--color-ink)] pb-1.5">
                  <span className="font-mono text-[12.5px] tabular-nums">{g.patientName}</span>
                  <span className="text-[11px] text-[var(--color-ink-3)]">{g.patientMetaLine}</span>
                </div>
                <div className="mt-3 grid gap-3">
                  {g.lines.map((l) => (
                    <div key={l.hcpcs} className="grid grid-cols-[46px_1fr_auto] items-center gap-2.5">
                      <img
                        src={l.imagePath}
                        alt=""
                        className="aspect-[3/4] w-full border border-[var(--color-line)] bg-neutral-50 object-cover"
                      />
                      <div className="min-w-0">
                        <div className="text-[12.5px]">{l.name}</div>
                        <div className="text-[11px] text-[var(--color-ink-3)]">{l.metaLine}</div>
                        {l.dupe && (
                          <div className="mt-0.5 text-[11px] text-[var(--color-ink)]">{g.patientName} already has this item</div>
                        )}
                        <div className="mt-2 flex items-center gap-2.5">
                          <span className="flex items-center overflow-hidden border border-[var(--color-line-strong)] transition-colors hover:border-[var(--color-ink)]">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => onQtyChange(l.hcpcs, l.patientId, l.qty - 1)}
                              className="h-6.5 w-6.5 leading-none transition-colors hover:bg-[var(--color-ink)] hover:text-white"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={l.qty}
                              onChange={(e) => onQtyChange(l.hcpcs, l.patientId, Math.max(1, parseInt(e.target.value, 10) || 1))}
                              aria-label="Quantity"
                              className="quantity-input w-7 border-0 bg-transparent text-center font-mono text-xs tabular-nums focus:bg-neutral-100 focus:outline-none"
                            />
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => onQtyChange(l.hcpcs, l.patientId, l.qty + 1)}
                              className="h-6.5 w-6.5 leading-none transition-colors hover:bg-[var(--color-ink)] hover:text-white"
                            >
                              +
                            </button>
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemove(l.hcpcs, l.patientId)}
                            className="text-[11px] text-[var(--color-ink-3)] underline decoration-1 underline-offset-2 transition-colors hover:text-[var(--color-ink)]"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="font-mono text-[12.5px] tabular-nums">
                        {moneyLabel(l.lineTotal)}
                        {l.priceUnit === '/mo' ? '/mo' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {empty && (
            <div className="py-10 text-center text-[13px] text-[var(--color-ink-3)]">
              Cart is empty. Add to cart, then choose the patients it is for.
            </div>
          )}
        </div>

        <div className="grid gap-2.5 border-t border-[var(--color-line)] px-5.5 pb-5.5 pt-4">
          {totals.monthly > 0 && (
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-[var(--color-ink-2)]">Monthly (rentals)</span>
              <span className="font-mono tabular-nums">{moneyLabel(totals.monthly)}/mo</span>
            </div>
          )}
          {totals.oneTime > 0 && (
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-[var(--color-ink-2)]">One-time (purchases)</span>
              <span className="font-mono tabular-nums">{moneyLabel(totals.oneTime)}</span>
            </div>
          )}
          <div className="text-[11.5px] text-[var(--color-ink-3)]">
            {unitCount
              ? totals.slowestKnownLeadDays !== null
                ? `Longest known vendor lead time ${totals.slowestKnownLeadDays === 1 ? 'next day' : `${totals.slowestKnownLeadDays} days`}${totals.hasUnknownVendor ? ' · vendor pending on some items' : ''} · billed to hospice contract`
                : 'Vendor to be assigned at dispatch · billed to hospice contract'
              : 'Add equipment to start an order.'}
          </div>
          <button
            type="button"
            onClick={onPlaceOrder}
            className="mt-1 w-full border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-3.5 text-[11px] uppercase tracking-[0.1em] text-white transition-opacity hover:opacity-85"
          >
            Place order
          </button>
        </div>
      </section>
    </>
  );
}
