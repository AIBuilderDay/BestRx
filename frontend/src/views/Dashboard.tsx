import { useSearchParams } from 'react-router-dom';
import { TopNav } from '../components/layout/TopNav';
import { DashboardTabs, type DashboardTab } from '../components/dashboard/DashboardTabs';
import { useCart } from '../context/CartContext';
import { getHospice } from '../data/db';
import type { User } from '../types/domain';

const TAB_COPY: Record<DashboardTab, { crumb: string; title: string; blurb: string }> = {
  cost: {
    crumb: 'Cost of care',
    title: 'DME cost ledger',
    blurb: 'Every code you bought, priced against every vendor that could have supplied it.',
  },
  budgets: {
    crumb: 'Budget configuration',
    title: 'Budget configuration',
    blurb:
      "Each account's DME ceiling is derived from the patients they carry — not a flat number someone guessed.",
  },
};

const isDashboardTab = (value: string | null): value is DashboardTab =>
  value === 'cost' || value === 'budgets';

/**
 * Cost dashboard for the roles that hold `reporting` — the hospice owner and the director of
 * nursing. The active view lives in the query string so the browser back button steps between the
 * two panels the way it steps between routes.
 */
export default function Dashboard({ user }: { user: User }) {
  const { cartCount, setCartOpen } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();

  const viewParam = searchParams.get('view');
  const activeTab: DashboardTab = isDashboardTab(viewParam) ? viewParam : 'cost';
  const selectTab = (tab: DashboardTab) => setSearchParams({ view: tab });

  const hospice = getHospice(user.orgId);
  const copy = TAB_COPY[activeTab];

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        user={user}
        cartCount={cartCount}
        activeSection="dashboard"
        onOpenCart={() => setCartOpen(true)}
      />

      <main className="mx-auto max-w-[1220px] px-8 pb-20 pt-6.5">
        <div className="text-[12px] text-ink-3">
          {hospice?.name ?? 'Hospice'} / {copy.crumb}
        </div>

        <div className="mt-2 mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-normal tracking-tight">{copy.title}</h1>
            <p className="mt-1 max-w-[62ch] text-[13px] text-ink-2">{copy.blurb}</p>
          </div>
          {hospice ? (
            <div className="text-right text-[12px] text-ink-3">
              <div>
                {hospice.name} · {hospice.emr}
              </div>
              <div>{hospice.activeCensus} patients on service · August 2026</div>
            </div>
          ) : null}
        </div>

        <DashboardTabs activeTab={activeTab} onSelectTab={selectTab} />

        <section className="mt-5 rounded-card border border-line bg-surface p-8 text-[13px] text-ink-2">
          {activeTab === 'cost'
            ? 'The vendor price matrix and spend trend land in the next change.'
            : 'Role rates and per-account budget caps land in the next change.'}
        </section>
      </main>
    </div>
  );
}
