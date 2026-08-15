import type { CostPeriod } from '../../lib/costPeriod';

/**
 * Period label. The mockup offered 1mo/3mo/6mo/1yr tabs; the dataset holds one month of orders,
 * so the period reads as a stated fact rather than a choice between three dead tabs. Vendor
 * comparison used to live here as a table-wide toggle — it now lives in the Potential Savings
 * card above, where a vendor's price sits next to its reviews and delivery record instead of
 * alone.
 */
export function LedgerControls({ period }: { period: CostPeriod }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Period</span>
      <span className="rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[13px] text-ink">
        {period.label} · {period.days} days
      </span>
      <span className="text-[12px] text-ink-3">The dataset holds one month of orders.</span>
    </div>
  );
}
