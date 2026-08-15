import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { budgetCapUsd, getBudgetsForHospice, getHospice, getPatient } from '../data/db';
import { isFamilyMember } from '../lib/auth';
import { familyCardLabel } from '../lib/family';
import { addPurchaseRequest } from '../lib/purchaseRequests';
import { cartLineTiming, cartPpdImpact, totalUnitsInCart } from '../lib/catalog';
import type { User, UserRole } from '../types/domain';
import { TopNav } from '../components/layout/TopNav';
import { CartLineRow } from '../components/catalog/CartLineRow';
import { CartSummary, type CartBudgetVM } from '../components/catalog/CartSummary';
import { CartDrawer } from '../components/catalog/CartDrawer';
import { Toast } from '../components/ui/Toast';
import { useCart } from '../context/CartContext';

const ROLE_BUDGET_LABEL: Partial<Record<UserRole, string>> = {
  admissions_nurse: 'Admissions budget',
  case_manager: 'Case-manager budget',
  director_of_nursing: 'Director budget',
};

const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'long' });

export default function Cart({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const hospice = getHospice(user.orgId);
  const family = isFamilyMember(user);
  const { lines, cartGroups, cartTotals: totals, setCartLineQty, clearCart, cartOpen, setCartOpen } = useCart();
  const navigate = useNavigate();

  // Family only: ask the hospice to send it, or buy it themselves. Chosen here at checkout.
  const [fulfillment, setFulfillment] = useState<'request' | 'buy'>('request');

  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const say = (message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

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

  const placeOrder = () => {
    if (lines.length === 0) {
      say('Cart is empty');
      return;
    }

    // Family "Request from hospice": each line becomes a request on the patient chart, not an order.
    if (family && fulfillment === 'request') {
      let n = 0;
      for (const g of cartGroups) {
        for (const l of g.lines) {
          addPurchaseRequest({
            patientId: l.patientId,
            familyMemberId: user.id,
            familyMemberName: user.name,
            offerId: l.offerId,
            productName: l.name,
            qty: l.qty,
          });
          n += 1;
        }
      }
      clearCart();
      setCartOpen(false);
      say(`Request sent to ${hospice?.name ?? 'your hospice'} — ${n} item${n > 1 ? 's' : ''}`);
      navigate('/family');
      return;
    }

    const lineCount = lines.length;
    const patientCount = cartGroups.length;
    clearCart();
    setCartOpen(false);
    say(
      family
        ? `Order placed — charged to ${familyCardLabel}`
        : `Order placed — ${lineCount} line${lineCount > 1 ? 's' : ''} across ${patientCount} patient${patientCount > 1 ? 's' : ''}`,
    );
    navigate(family ? '/family' : '/catalog');
  };

  const unitCount = totalUnitsInCart(lines);
  const empty = cartGroups.length === 0;

  return (
    <div className="min-h-screen bg-bg">
      <TopNav user={user} cartCount={unitCount} activeSection="catalog" onOpenCart={() => setCartOpen(true)} onSignOut={onSignOut} />

      <div className="mx-auto max-w-[1120px] px-6 pb-24 pt-8 sm:px-8">
        <div className="text-xs text-ink-3">{hospice?.name ?? 'Hospice'} / Catalog / Cart</div>
        <h1 className="mt-1.5 text-3xl font-normal tracking-tight">Your cart</h1>
        <div className="mt-1.5 text-[13px] text-ink-2">
          {empty
            ? 'No equipment in this order yet.'
            : family
              ? `${unitCount} item${unitCount > 1 ? 's' : ''} · ${
                  fulfillment === 'request' ? `requesting from ${hospice?.name ?? 'your hospice'}` : 'charged to your card'
                }`
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
                <section key={g.patientId} className="mb-2">
                  <div className="flex items-baseline justify-between gap-3 border-b border-ink pb-2.5 pt-3">
                    <span className="text-sm font-semibold">{g.patientName}</span>
                    <span className="text-[11px] text-ink-3">{g.patientMetaLine}</span>
                  </div>
                  {g.lines.map((l) => (
                    <CartLineRow
                      key={`${l.hcpcs}-${l.patientId}`}
                      line={l}
                      patient={getPatient(g.patientId)}
                      onQtyChange={(q) => setCartLineQty(l.hcpcs, l.patientId, q)}
                      onRemove={() => setCartLineQty(l.hcpcs, l.patientId, 0)}
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
              budget={family ? null : budget}
              ppd={ppd}
              onPlaceOrder={placeOrder}
              payWithCard={family && fulfillment === 'buy' ? familyCardLabel : undefined}
              fulfillment={family ? fulfillment : undefined}
              onFulfillmentChange={family ? setFulfillment : undefined}
              placeOrderLabel={
                family
                  ? fulfillment === 'request'
                    ? 'Send request to hospice'
                    : `Buy now · ${familyCardLabel}`
                  : 'Place order'
              }
            />
          </div>
        )}
      </div>

      <CartDrawer
        open={cartOpen}
        groups={cartGroups}
        totals={totals}
        onQtyChange={(hcpcs, patientId, qty) => setCartLineQty(hcpcs, patientId, qty)}
        onRemove={(hcpcs, patientId) => setCartLineQty(hcpcs, patientId, 0)}
        onClose={() => setCartOpen(false)}
        onViewCart={() => setCartOpen(false)}
        onPlaceOrder={placeOrder}
      />

      <Toast message={toast} />
    </div>
  );
}
