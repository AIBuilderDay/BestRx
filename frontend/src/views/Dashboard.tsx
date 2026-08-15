import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TopNav } from '../components/layout/TopNav';
import { BudgetPanel } from '../components/dashboard/BudgetPanel';
import { CostLedgerPanel } from '../components/dashboard/CostLedgerPanel';
import { DashboardTabs, type DashboardTab } from '../components/dashboard/DashboardTabs';
import { Toast } from '../components/ui/Toast';
import { useCart } from '../context/CartContext';
import {
  accountTotals,
  buildAccountRows,
  effectivePpdFor,
  NO_OVERRIDES,
  roleRates,
  setAccountOverride,
  setRoleOverride,
  sortAccountRows,
  type AccountSortKey,
  type PpdOverrides,
} from '../lib/budgetLedger';
import { basketTotals, buildBasket, vendorColumns } from '../lib/costLedger';
import { getPeriod } from '../lib/costPeriod';
import type { User, UserRole } from '../types/domain';

const isDashboardTab = (value: string | null): value is DashboardTab =>
  value === 'cost' || value === 'budgets';

/**
 * Cost dashboard for the roles that hold `reporting` — the hospice owner and the director of
 * nursing. The active view lives in the query string so the browser back button steps between the
 * two panels the way it steps between routes.
 *
 * PPD overrides are owned here rather than in BudgetPanel: editing a rate moves the account caps,
 * which move the budget-utilization tile on the cost panel. Split ownership would leave it stale.
 */
export default function Dashboard({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { cartCount, setCartOpen } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const [openHcpcs, setOpenHcpcs] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: AccountSortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [overrides, setOverrides] = useState<PpdOverrides>(NO_OVERRIDES);
  const [toast, setToast] = useState('');

  const viewParam = searchParams.get('view');
  const activeTab: DashboardTab = isDashboardTab(viewParam) ? viewParam : 'cost';
  const hospiceId = user.orgId;
  const period = getPeriod('aug-2026');

  const columns = useMemo(() => vendorColumns(hospiceId), [hospiceId]);
  const lines = useMemo(() => buildBasket(hospiceId, period), [hospiceId, period]);
  const totals = useMemo(() => basketTotals(lines, columns), [lines, columns]);

  const accountRows = useMemo(
    () => buildAccountRows(hospiceId, period, overrides, user.role),
    [hospiceId, period, overrides, user.role],
  );
  const sortedRows = useMemo(
    () => sortAccountRows(accountRows, sort.key, sort.dir),
    [accountRows, sort],
  );
  const budgetTotals = useMemo(() => accountTotals(accountRows), [accountRows]);
  const roleCards = useMemo(
    () => roleRates(hospiceId, overrides, user.role),
    [hospiceId, overrides, user.role],
  );

  const selectTab = (tab: DashboardTab) => setSearchParams({ view: tab });

  const changeRoleRate = (role: UserRole, next: number | null) => {
    setOverrides((current) => setRoleOverride(current, role, next));
  };

  const changeAccountRate = (userId: string, next: number | null) => {
    const account = accountRows.find((r) => r.user.id === userId);
    if (!account) return;
    const roleDefault = effectivePpdFor(hospiceId, account.user, {
      roles: overrides.roles,
      accounts: {},
    }).ppdUsd;
    setOverrides((current) => setAccountOverride(current, userId, next, roleDefault));
  };

  const sortBy = (key: AccountSortKey) =>
    setSort((current) => (current.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        user={user}
        cartCount={cartCount}
        activeSection="dashboard"
        onOpenCart={() => setCartOpen(true)}
        onSignOut={onSignOut}
      />

      <main className="mx-auto max-w-[1220px] px-8 pb-20 pt-6.5">
        <div className="mb-5">
          <h1 className="text-3xl font-normal tracking-tight">Dashboard</h1>
        </div>

        <DashboardTabs activeTab={activeTab} onSelectTab={selectTab} />

        {activeTab === 'cost' ? (
          <CostLedgerPanel
            hospiceId={hospiceId}
            period={period}
            lines={lines}
            totals={totals}
            columns={columns}
            budgetTotals={budgetTotals}
            accountRows={accountRows}
            openHcpcs={openHcpcs}
            onOpenRow={(hcpcs) => setOpenHcpcs((current) => (current === hcpcs ? null : hcpcs))}
            onCloseRow={() => setOpenHcpcs(null)}
            onAction={setToast}
          />
        ) : (
          <BudgetPanel
            period={period}
            roleCards={roleCards}
            rows={sortedRows}
            totals={budgetTotals}
            sortKey={sort.key}
            sortDir={sort.dir}
            onSort={sortBy}
            onRoleRateChange={changeRoleRate}
            onAccountRateChange={changeAccountRate}
          />
        )}
      </main>

      <Toast message={toast} />
    </div>
  );
}
