import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { budgetCapUsd, getBudgetsForHospice, getHospice, getPatient } from '../data/db';
import { cartLineTiming, cartPpdImpact, totalUnitsInCart } from '../lib/catalog';
import type { User, UserRole } from '../types/domain';
import { TopNav } from '../components/layout/TopNav';
import { CartLineRow } from '../components/catalog/CartLineRow';
import { CartSummary, type CartBudgetVM } from '../components/catalog/CartSummary';
import { useCart } from '../context/CartContext';

const ROLE_BUDGET_LABEL: Partial<Record<UserRole, string>> = {
  admissions_nurse: 'Admissions budget',
  case_manager: 'Case-manager budget',
  director_of_nursing: 'Director budget',
};

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long' });

/** Patient headers and their lines trickle in one after another; capped so a long cart is not slow to settle. */
const staggerMs = (n: number) => Math.min(n, 12) * 60;

export default function Cart({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const hospice = getHospice(user.orgId);
  const { lines, cartGroups, cartTotals: totals, orderCount, placing, setCartLineQty, setCartOpen, placeOrder } = useCart();
  const navigate = useNavigate();

  const firstMonthTotal = totals.monthly + totals.oneTime;

  const roleBudget = useMemo(
    () => getBudgetsForHospice(user.orgId).find((b) => b.scope === 'role' && b.scopeRef === user.role),
    [user.orgId, user.role],
  );

  const budget: CartBudgetVM | null = roleBudget
    ? (() => {
        const capUsd = budgetCapUsd(roleBudget);
        const projectedSpent = roleBudget.spentUsd + firstMonthTotal;
        const [y, m] = roleBudget.period.split('-').map(Number);
        const month = MONTH_FMT.format(new Date(y, (m || 1) - 1, 1));
        const d = roleBudget.derivedFrom;
        return {
          label: `${ROLE_BUDGET_LABEL[user.role] ?? 'Budget'} · ${month}`,
          capUsd,
          projectedSpent,
          remaining: capUsd - projectedSpent,
          pct: capUsd > 0 ? (projectedSpent / capUsd) * 100 : 0,
          derived: d ? `Cap derived: ${d.ppdUsd.toFixed(2)} PPD × ${d.assignedPatients} patients × ${d.days} days` : null,
        };
      })()
    : null;

  const ppd = cartPpdImpact(totals.monthly, hospice?.activeCensus ?? 0, roleBudget?.derivedFrom?.days ?? 31);

  const atRiskCount = useMemo(() => {
    let n = 0;
    for (const g of cartGroups) {
      const p = getPatient(g.patientId);
      if (!p) continue;
      for (const l of g.lines) if (cartLineTiming(p, l.leadDays, l.priceUnit).missesDischarge) n += 1;
    }
    return n;
  }, [cartGroups]);

  /** The cart page has nothing left to show once the order is placed, so it returns to the catalog.
   *  Navigating only after checkout resolves means a failed order leaves the cart intact to retry. */
  const placeOrderAndLeave = async () => {
    if (await placeOrder()) navigate('/orders');
  };

  const unitCount = totalUnitsInCart(lines);
  const empty = cartGroups.length === 0;

  // Running position through the flattened header/line sequence, consumed as the list renders.
  let step = 0;

  return (
    <div className="min-h-screen bg-bg">
      <TopNav user={user} cartCount={unitCount} activeSection="catalog" onOpenCart={() => setCartOpen(true)} onSignOut={onSignOut} />

      <div className="mx-auto max-w-[1120px] px-6 pb-24 pt-8 sm:px-8">
        <div className="text-xs text-ink-3">{hospice?.name ?? 'Hospice'} / Catalog / Cart</div>
        <h1 className="mt-1.5 text-3xl font-normal tracking-tight">Your cart</h1>
        <div className="mt-1.5 text-[13px] text-ink-2">
          {empty
            ? 'No equipment in this order yet.'
            : `${unitCount} item${unitCount > 1 ? 's' : ''} for ${cartGroups.length} patient${cartGroups.length > 1 ? 's' : ''} · ordering as ${user.name} · billed to hospice contract`}
        </div>

        {empty ? (
          <div className="mt-10 border border-line bg-surface px-6 py-16 text-center">
            <div className="text-[13px] text-ink-3">Add equipment from the catalog, then choose the patients it is for.</div>
            <Link
              to="/catalog"
              className="mt-5 inline-block border border-solid-bg bg-solid-bg px-4 py-3 text-[11px] uppercase tracking-[0.1em] text-solid-ink transition-opacity hover:opacity-85"
            >
              Browse catalog
            </Link>
          </div>
        ) : (
          <div className="mt-7 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div className="min-w-0">
              {cartGroups.map((g) => (
                <section
                  key={g.patientId}
                  style={{ animationDelay: `${staggerMs(step++)}ms` }}
                  className="mb-2 animate-[chipIn_0.35s_cubic-bezier(0.2,0.7,0.2,1)_both]"
                >
                  <div className="border-b border-ink pb-2.5 pt-3">
                    <div className="text-sm font-semibold">{g.patientName}</div>
                    <div className="mt-1 text-[11px] text-ink-3">{g.patientMetaLine}</div>
                  </div>
                  {g.lines.map((l) => (
                    <CartLineRow
                      key={`${l.offerId}-${l.patientId}`}
                      line={l}
                      delayMs={staggerMs(step++)}
                      patient={getPatient(g.patientId)}
                      onQtyChange={(q) => setCartLineQty(l.offerId, l.patientId, q)}
                      onRemove={() => setCartLineQty(l.offerId, l.patientId, 0)}
                    />
                  ))}
                </section>
              ))}
              <Link to="/catalog" className="mt-5 inline-block text-xs text-ink-3 underline underline-offset-2 hover:text-ink">
                Continue on the catalog
              </Link>
            </div>

            <CartSummary
              totals={totals}
              firstMonthTotal={firstMonthTotal}
              lineCount={lines.length}
              patientCount={cartGroups.length}
              atRiskCount={atRiskCount}
              budget={budget}
              ppd={ppd}
              orderCount={orderCount}
              placing={placing}
              onPlaceOrder={placeOrderAndLeave}
            />
          </div>
        )}
      </div>
    </div>
  );
}
