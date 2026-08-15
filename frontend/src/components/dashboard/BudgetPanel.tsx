import type {
  AccountBudgetRow,
  AccountSortKey,
  AccountTotals,
  RoleRateVM,
} from '../../lib/budgetLedger';
import type { UserRole } from '../../types/domain';
import type { CostPeriod } from '../../lib/costPeriod';
import { AccountsBudgetTable } from './AccountsBudgetTable';
import { PpdRateInput } from './PpdRateInput';

export function BudgetPanel({
  period,
  roleCards,
  rows,
  totals,
  sortKey,
  sortDir,
  onSort,
  onRoleRateChange,
  onAccountRateChange,
}: {
  period: CostPeriod;
  roleCards: RoleRateVM[];
  rows: AccountBudgetRow[];
  totals: AccountTotals;
  sortKey: AccountSortKey;
  sortDir: 1 | -1;
  onSort: (key: AccountSortKey) => void;
  onRoleRateChange: (role: UserRole, next: number | null) => void;
  onAccountRateChange: (userId: string, next: number | null) => void;
}) {
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-bg-subtle px-4 py-3 text-[13px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink-2">Monthly cap =</span>
          <span className="rounded-control border border-line-strong bg-surface px-2 py-1 text-ink">
            PPD allowance
          </span>
          <span className="text-ink-3">×</span>
          <span className="rounded-control border border-line-strong bg-surface px-2 py-1 text-ink">
            assigned patients
          </span>
          <span className="text-ink-3">×</span>
          <span className="rounded-control border border-line-strong bg-surface px-2 py-1 text-ink">
            days in period
          </span>
        </div>
        <div className="text-[12px] text-ink-3">
          Period: {period.label} · {period.days} days · caps recompute live
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {roleCards.map((card) => (
          <div key={card.role} className="rounded-card border border-line bg-surface px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] text-ink">{card.label} — default PPD</div>
              {card.overridden ? (
                <span
                  title="Session override — not saved."
                  className="rounded-full border border-line bg-bg-subtle px-1.5 py-0.5 text-[10px] text-ink-3"
                >
                  session
                </span>
              ) : null}
            </div>

            <div className="mt-2">
              {card.defaultPpdUsd === null ? (
                <span className="text-[13px] text-ink-3">
                  No budget row on file for this role — no cap is derived.
                </span>
              ) : (
                <PpdRateInput
                  value={card.effectivePpdUsd}
                  ariaLabel={`Default PPD rate for ${card.label}`}
                  onCommit={(next) => onRoleRateChange(card.role, next)}
                />
              )}
            </div>

            <div className="mt-2 text-[12px] text-ink-3">
              per patient · per day · {card.accountCount} account
              {card.accountCount === 1 ? '' : 's'} · {card.assignedPatients} patients counted
              {card.accountOverrideCount > 0
                ? ` · ${card.accountOverrideCount} override${card.accountOverrideCount === 1 ? '' : 's'}`
                : ''}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <AccountsBudgetTable
          rows={rows}
          totals={totals}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          onRateChange={onAccountRateChange}
        />
      </div>
    </div>
  );
}
