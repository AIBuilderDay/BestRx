import { useEffect } from 'react';
import { moneyLabel } from '../../lib/catalog';
import type { BasketLine } from '../../lib/costLedger';
import { orderHistoryForCode } from '../../lib/costLedger';
import type { CostPeriod } from '../../lib/costPeriod';

const formatOrderDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/** Every order behind one basket line: who bought how many, when, and at what price. */
export function CodeDrawer({
  hospiceId,
  period,
  line,
  onClose,
}: {
  hospiceId: string;
  period: CostPeriod;
  line: BasketLine;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const history = orderHistoryForCode(hospiceId, period, line.hcpcs);

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-black/20 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="code-drawer-title"
        className="max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-panel border border-ink bg-surface p-5 animate-[sheetIn_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="code-drawer-title" className="text-[15px] text-ink">
              {line.hcpcs} · {line.name}
            </h3>
            <p className="mt-1 text-[13px] text-ink-2">
              Order history · {line.units} unit{line.units === 1 ? '' : 's'} this period
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded-control border border-line-strong px-2 py-1 text-[13px] text-ink-2 hover:border-ink hover:text-ink"
          >
            ✕
          </button>
        </div>

        {history.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-3">No individual orders on file for this period.</p>
        ) : (
          <div className="mt-4 overflow-hidden rounded-card border border-line">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-bg-subtle">
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                    Patient
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                    Ordered by
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                    Vendor
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] uppercase tracking-[0.06em] text-ink-3">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] uppercase tracking-[0.06em] text-ink-3">
                    Paid
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.orderId} className="border-t border-line">
                    <td className="px-3 py-2 tabular-nums text-ink-2">{formatOrderDate(entry.orderedAt)}</td>
                    <td className="px-3 py-2 text-ink">{entry.patientName}</td>
                    <td className="px-3 py-2 text-ink-2">{entry.orderedByName}</td>
                    <td className="px-3 py-2 text-ink-2">{entry.vendorName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{moneyLabel(entry.extendedUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
