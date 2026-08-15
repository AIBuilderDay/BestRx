import type { CostPeriod } from '../../lib/costPeriod';

/**
 * Period label and the compare toggle.
 *
 * The mockup offered 1mo/3mo/6mo/1yr tabs. The dataset holds one month of orders, so the period
 * reads as a stated fact rather than a choice between three dead tabs.
 */
export function LedgerControls({
  period,
  compareEnabled,
  onToggleCompare,
}: {
  period: CostPeriod;
  compareEnabled: boolean;
  onToggleCompare: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Period</span>
        <span className="rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[13px] text-ink">
          {period.label} · {period.days} days
        </span>
        <span className="text-[12px] text-ink-3">The dataset holds one month of orders.</span>
      </div>

      <button
        type="button"
        onClick={onToggleCompare}
        aria-pressed={compareEnabled}
        className="flex items-center gap-2.5 rounded-full border border-line-strong bg-surface px-3.5 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-ink hover:text-ink"
      >
        <span
          className={`flex h-4 w-7 items-center rounded-full px-0.5 transition-colors motion-reduce:transition-none ${
            compareEnabled ? 'bg-solid-bg' : 'bg-track'
          }`}
        >
          <span
            className={`h-3 w-3 rounded-full bg-surface transition-transform motion-reduce:transition-none ${
              compareEnabled ? 'translate-x-3' : 'translate-x-0'
            }`}
          />
        </span>
        Competing vendor pricing
      </button>
    </div>
  );
}
