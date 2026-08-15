import { useState } from 'react';
import { moneyLabel } from '../../lib/catalog';
import type { BreakdownSlice } from '../../lib/budgetBreakdown';
import type { AccountBudgetRow } from '../../lib/budgetLedger';
import { DonutChart } from './DonutChart';

const HEAD = 'px-3 py-2.5 text-right text-[11px] uppercase tracking-[0.06em] text-ink-3';
type BreakdownView = 'product' | 'nurse';

export function BudgetBreakdownPanel({
  productSlices,
  accountOverageSlices,
  accountRows,
  overageUsd,
  capUsd,
  utilizationPct,
}: {
  productSlices: BreakdownSlice[];
  accountOverageSlices: BreakdownSlice[];
  accountRows: AccountBudgetRow[];
  overageUsd: number;
  capUsd: number;
  utilizationPct: number | null;
}) {
  const [view, setView] = useState<BreakdownView>('product');
  const overAccounts = accountRows
    .filter((row) => row.overageUsd > 0)
    .sort((a, b) => b.overageUsd - a.overageUsd);
  const hasOverage = overageUsd > 0;
  const productSpendUsd = productSlices.reduce((sum, slice) => sum + slice.valueUsd, 0);
  const chartSlices = view === 'product' ? productSlices : accountOverageSlices;
  const chartTotal = view === 'product' ? productSpendUsd : overageUsd;
  const cutbackLabel = moneyLabel(overageUsd);

  return (
    <section className="mt-4 rounded-card border border-ink bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] text-ink">Budget overage drivers</h2>
          <p className="mt-1 max-w-[78ch] text-[12px] text-ink-3">
            {hasOverage
              ? `${moneyLabel(overageUsd)} is over the allotted budget. The costs below show who is over budget and which purchased products are the largest places to reduce.`
              : `No cutback needed this period. Utilization is ${utilizationPct ?? 0}% of the ${moneyLabel(capUsd)} allotted budget.`}
          </p>
        </div>
        <div className={`text-right ${hasOverage ? 'text-risk' : 'text-good'}`}>
          <div className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Cutback needed</div>
          <div className="mt-1 text-[22px] font-semibold tabular-nums">{moneyLabel(overageUsd)}</div>
        </div>
      </div>

      {hasOverage ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              {view === 'product' ? 'Product overage spending' : 'Nurses over spending'}
            </h3>
            <div role="tablist" aria-label="Budget utilization breakdown" className="flex gap-1.5">
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

          <div key={view} className="animate-[sheetIn_0.3s_cubic-bezier(0.2,0.7,0.2,1)_both] motion-reduce:animate-none">
            {chartSlices.length > 0 ? (
              <DonutChart
                slices={chartSlices}
                totalLabel={moneyLabel(chartTotal)}
                centerLabel="Cutback"
                centerValue={cutbackLabel}
              />
            ) : (
              <div className="mt-3 rounded-card border border-line bg-bg-subtle px-3 py-3 text-[13px] text-ink-2">
                No nurse overage to chart for this period.
              </div>
            )}
          </div>

          {view === 'nurse' ? (
            <div>
              <div className="mt-2 overflow-hidden rounded-card border border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-bg-subtle">
                      <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                        Account
                      </th>
                      <th className={HEAD}>Purchased</th>
                      <th className={HEAD}>Allotted</th>
                      <th className={HEAD}>Overage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overAccounts.map((account) => (
                      <tr key={account.user.id} className="border-t border-line">
                        <td className="px-3 py-2.5">
                          <div className="text-ink">{account.user.name}</div>
                          <div className="text-[11px] text-ink-3">
                            {account.roleLabel} · {account.assignedPatients} patients · {account.utilizationPct}%
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{moneyLabel(account.spentUsd)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {account.capUsd === null ? '—' : moneyLabel(account.capUsd)}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-risk">
                          {moneyLabel(account.overageUsd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-4 rounded-card border border-good bg-bg-subtle px-4 py-5 text-center">
          <p className="text-[14px] font-medium text-good">Nice work — this hospice is under budget.</p>
          <p className="mt-1 text-[12px] text-ink-3">
            {utilizationPct ?? 0}% of the {moneyLabel(capUsd)} allotted budget used. No cutback needed this
            period.
          </p>
        </div>
      )}
    </section>
  );
}
