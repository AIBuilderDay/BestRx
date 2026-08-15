import { moneyLabel } from '../../lib/catalog';
import type { HospiceBudgetUsage } from '../../lib/budgetLedger';
import { BudgetFieldInput } from './BudgetFieldInput';

/** Fill color by usage band: under the near-cap floor is good, near cap is a warning, over cap is risk. */
function fillTone(pct: number): string {
  if (pct > 100) return 'bg-risk';
  if (pct >= 90) return 'bg-warn';
  return 'bg-good';
}

function textTone(pct: number): string {
  if (pct > 100) return 'text-risk';
  if (pct >= 90) return 'text-warn';
  return 'text-ink-2';
}

/** Big top-of-tab usage bar for the hospice's whole monthly budget, plus the control to adjust it. */
export function TotalBudgetUsageMeter({
  usage,
  periodLabel,
  editMode,
  onTotalBudgetChange,
}: {
  usage: HospiceBudgetUsage;
  periodLabel: string;
  editMode: boolean;
  onTotalBudgetChange: (next: number | null) => void;
}) {
  const { monthlyBudgetUsd, monthlyBudgetOverridden, spentUsd, utilizationPct, overageUsd } = usage;

  return (
    <div className="rounded-card border border-ink bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] text-ink">Total budget usage</h2>
          <p className="mt-1 text-[12px] text-ink-3">
            {periodLabel} · {moneyLabel(spentUsd)} of {moneyLabel(monthlyBudgetUsd)} spent
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[12px] text-ink-3">Total monthly budget</span>
          <BudgetFieldInput
            value={monthlyBudgetUsd}
            unit="usd"
            ariaLabel="Total monthly budget"
            onCommit={onTotalBudgetChange}
            readOnly={!editMode}
          />
          {monthlyBudgetOverridden ? (
            <span
              title="Session override — not saved."
              className="rounded-full border border-line bg-bg-subtle px-1.5 py-0.5 text-[10px] text-ink-3"
            >
              session
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-track">
        {utilizationPct === null ? null : (
          <div
            className={`h-full ${fillTone(utilizationPct)}`}
            style={{ width: `${Math.min(utilizationPct, 100)}%` }}
          />
        )}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[12px]">
        {utilizationPct === null ? (
          <span className="text-ink-3">No monthly budget set — usage can't be measured.</span>
        ) : (
          <span className={`font-medium tabular-nums ${textTone(utilizationPct)}`}>
            {utilizationPct}% used
            {utilizationPct > 100 ? ` · ${moneyLabel(overageUsd)} over budget` : ''}
          </span>
        )}
        {utilizationPct !== null && utilizationPct <= 100 ? (
          <span className="text-ink-3">{moneyLabel(Math.max(0, monthlyBudgetUsd - spentUsd))} remaining</span>
        ) : null}
      </div>
    </div>
  );
}
