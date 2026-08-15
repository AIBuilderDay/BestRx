import { moneyCents, moneyLabel } from '../../lib/catalog';
import type {
  AccountBudgetRow,
  AccountBudgetStatus,
  AccountSortKey,
  AccountTotals,
} from '../../lib/budgetLedger';
import { pillClasses, type PillTone } from '../../lib/patients';
import { TableWrap } from '../ui/TableWrap';
import { PpdRateInput } from './PpdRateInput';
import { UtilizationMeter } from './UtilizationMeter';

const COLUMNS: { key: AccountSortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Account', numeric: false },
  { key: 'role', label: 'Role', numeric: false },
  { key: 'patients', label: 'Patients', numeric: true },
  { key: 'ppd', label: 'PPD rate', numeric: true },
  { key: 'cap', label: 'Period cap', numeric: true },
  { key: 'spent', label: 'Spent', numeric: true },
  { key: 'utilization', label: 'Utilization', numeric: true },
  { key: 'status', label: 'Status', numeric: false },
];

const STATUS: Record<AccountBudgetStatus, { label: string; tone: PillTone }> = {
  over: { label: '▲ Over cap', tone: 'alert' },
  near: { label: '▲ Near cap', tone: 'alert' },
  under: { label: '✓ Under', tone: 'good' },
  no_caseload: { label: 'No caseload', tone: 'muted' },
  no_rate: { label: 'No role budget', tone: 'muted' },
};

export function AccountsBudgetTable({
  rows,
  totals,
  sortKey,
  sortDir,
  onSort,
  onRateChange,
}: {
  rows: AccountBudgetRow[];
  totals: AccountTotals;
  sortKey: AccountSortKey;
  sortDir: 1 | -1;
  onSort: (key: AccountSortKey) => void;
  onRateChange: (userId: string, next: number | null) => void;
}) {
  return (
    <>
      <TableWrap>
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <caption className="sr-only">
            DME budget by account. Caps are derived from PPD rate, counted caseload, and days in the
            period. Edit a rate to recompute that account's cap for this session.
          </caption>
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  role="button"
                  tabIndex={0}
                  aria-sort={
                    sortKey === column.key
                      ? sortDir === 1
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  onClick={() => onSort(column.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSort(column.key);
                    }
                  }}
                  className={`cursor-pointer px-3 py-2.5 text-[11px] uppercase tracking-[0.06em] text-ink-3 hover:text-ink ${
                    column.numeric ? 'text-right' : 'text-left'
                  }`}
                >
                  {column.label}
                  {sortKey === column.key ? <span aria-hidden="true"> {sortDir === 1 ? '↑' : '↓'}</span> : null}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const status = STATUS[row.status];
              return (
                <tr key={row.user.id} className="border-t border-line hover:bg-hover">
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-ink">{row.user.name}</span>
                      {row.ppdSource === 'account-override' ? (
                        <span
                          title="Session override — not saved. Refreshing restores the role default."
                          className="rounded-full border border-line bg-bg-subtle px-1.5 py-0.5 text-[10px] text-ink-3"
                        >
                          session
                        </span>
                      ) : null}
                    </div>
                    {row.note ? <div className="text-[11px] text-ink-3">{row.note}</div> : null}
                  </td>
                  <td className="px-3 py-2.5 text-ink-2">{row.roleLabel}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{row.assignedPatients}</td>
                  <td className="px-3 py-2.5 text-right">
                    {row.ppdUsd === null ? (
                      <span className="text-ink-3">—</span>
                    ) : (
                      <PpdRateInput
                        value={row.ppdUsd}
                        ariaLabel={`PPD rate for ${row.user.name}`}
                        onCommit={(next) => onRateChange(row.user.id, next)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.capUsd === null ? <span className="text-ink-3">—</span> : moneyLabel(row.capUsd)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{moneyCents(row.spentUsd)}</td>
                  <td className="px-3 py-2.5">
                    <UtilizationMeter pct={row.utilizationPct} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${pillClasses(status.tone)}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t border-line-strong font-medium">
              <td className="px-3 py-2.5" colSpan={2}>
                All accounts
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{totals.assignedPatients}</td>
              <td className="px-3 py-2.5 text-right text-ink-3">—</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{moneyLabel(totals.capUsd)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{moneyCents(totals.spentUsd)}</td>
              <td className="px-3 py-2.5">
                <UtilizationMeter pct={totals.utilizationPct} />
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </TableWrap>

      <p className="mt-3 max-w-[92ch] text-[12px] text-ink-3">
        Caps cover the patients currently assigned to an account. Rate edits apply to this session
        only — nothing is saved, and refreshing restores the role default.
        {totals.excludedReason ? ` ${totals.excludedReason}` : ''}
      </p>
    </>
  );
}
