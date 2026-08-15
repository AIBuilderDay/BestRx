import { moneyLabel } from '../../lib/catalog';
import type {
  AccountBudgetRow,
  AccountSortKey,
  AccountTotals,
  HospiceBudgetUsage,
  RoleRateVM,
} from '../../lib/budgetLedger';
import type { UserRole } from '../../types/domain';
import type { CostPeriod } from '../../lib/costPeriod';
import { AccountsBudgetTable } from './AccountsBudgetTable';
import { BudgetFieldInput } from './BudgetFieldInput';
import { TotalBudgetUsageMeter } from './TotalBudgetUsageMeter';

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function BudgetPanel({
  period,
  usage,
  roleCards,
  rows,
  totals,
  sortKey,
  sortDir,
  editMode,
  canEdit,
  onSort,
  onStartEdit,
  onSave,
  onCancel,
  onTotalBudgetChange,
  onRolePctChange,
  onAccountAmountChange,
}: {
  period: CostPeriod;
  usage: HospiceBudgetUsage;
  roleCards: RoleRateVM[];
  rows: AccountBudgetRow[];
  totals: AccountTotals;
  sortKey: AccountSortKey;
  sortDir: 1 | -1;
  editMode: boolean;
  /** Only the owner can adjust budgets. Everyone with reporting access can still see all of it. */
  canEdit: boolean;
  onSort: (key: AccountSortKey) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onTotalBudgetChange: (next: number | null) => void;
  onRolePctChange: (role: UserRole, next: number | null) => void;
  onAccountAmountChange: (userId: string, next: number | null) => void;
}) {
  // Defensive: even if editMode were somehow left on, a viewer without budgets:configure never
  // sees an editable field — every input below reads this, not the raw editMode.
  const activeEditMode = editMode && canEdit;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] text-ink">Budget configuration</h2>
        {!canEdit ? (
          <span
            title="Only the owner account can adjust budgets."
            className="rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[11px] text-ink-3"
          >
            View only
          </span>
        ) : activeEditMode ? (
          <span className="rounded-full border border-line bg-bg-subtle px-2 py-0.5 text-[11px] text-ink-3">
            Editing
          </span>
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            aria-label="Edit budgets"
            title="Edit budgets"
            className="inline-flex items-center gap-1.5 rounded-control border border-line-strong px-2.5 py-1.5 text-[12px] text-ink-2 hover:border-ink hover:text-ink"
          >
            <PencilIcon />
            Edit
          </button>
        )}
      </div>

      <div className="mt-3">
        <TotalBudgetUsageMeter
          usage={usage}
          periodLabel={period.label}
          editMode={activeEditMode}
          onTotalBudgetChange={onTotalBudgetChange}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        {roleCards.map((card) => (
          <div key={card.role} className="rounded-card border border-line bg-surface px-3.5 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-[13px] text-ink">{card.label}</div>
              {card.overridden ? (
                <span
                  title="Session override — not saved."
                  className="rounded-full border border-line bg-bg-subtle px-1.5 py-0.5 text-[10px] text-ink-3"
                >
                  session
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex items-center gap-2">
              {card.defaultPctOfBudget === null ? (
                <span className="text-[13px] text-ink-3">
                  No budget row on file for this role — no department budget is derived.
                </span>
              ) : (
                <>
                  <BudgetFieldInput
                    value={card.effectivePctOfBudget}
                    unit="percent"
                    ariaLabel={`Default budget share for ${card.label}`}
                    onCommit={(next) => onRolePctChange(card.role, next)}
                    readOnly={!activeEditMode}
                  />
                  <span className="text-[13px] text-ink-2">
                    = {moneyLabel(card.departmentBudgetUsd ?? 0)} department budget
                  </span>
                </>
              )}
            </div>

            <div className="mt-2 text-[12px] text-ink-3">
              of hospice budget · {card.accountCount} account
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
          editMode={activeEditMode}
          onSort={onSort}
          onAmountChange={onAccountAmountChange}
        />
      </div>

      {activeEditMode ? (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-control border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-medium text-ink hover:bg-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-control border border-solid-bg bg-solid-bg px-3.5 py-2 text-[13px] font-medium text-solid-ink"
          >
            Save
          </button>
        </div>
      ) : null}
    </div>
  );
}
