import { useState } from 'react';
import { moneyLabel } from '../../lib/catalog';
import type { BreakdownSlice } from '../../lib/budgetBreakdown';
import { DonutChart } from './DonutChart';

type BreakdownView = 'product' | 'nurse';

/**
 * Budget-utilization breakdown: real spend, not the placeholder trend the other three tiles use.
 * Two views over the same total — which products are driving spend, and which accounts are
 * actually placing the orders — toggled rather than shown side by side.
 */
export function BudgetBreakdownPanel({
  productSlices,
  accountSlices,
  totalUsd,
}: {
  productSlices: BreakdownSlice[];
  accountSlices: BreakdownSlice[];
  totalUsd: number;
}) {
  const [view, setView] = useState<BreakdownView>('product');
  const slices = view === 'product' ? productSlices : accountSlices;
  const totalLabel = moneyLabel(totalUsd);

  return (
    <section className="mt-4 rounded-card border border-ink bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] text-ink">Where the budget went</h2>
          <p className="mt-1 text-[12px] text-ink-3">
            Real spend for {totalLabel} this period — every account's cap can't be judged without
            knowing what and who is actually spending against it.
          </p>
        </div>

        <div role="tablist" aria-label="Breakdown view" className="flex gap-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'product'}
            onClick={() => setView('product')}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
              view === 'product'
                ? 'border-solid-bg bg-solid-bg text-solid-ink'
                : 'border-line-strong bg-surface text-ink-2 hover:border-ink hover:text-ink'
            }`}
          >
            By product
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'nurse'}
            onClick={() => setView('nurse')}
            className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
              view === 'nurse'
                ? 'border-solid-bg bg-solid-bg text-solid-ink'
                : 'border-line-strong bg-surface text-ink-2 hover:border-ink hover:text-ink'
            }`}
          >
            By nurse
          </button>
        </div>
      </div>

      <DonutChart slices={slices} totalLabel={totalLabel} />
    </section>
  );
}
