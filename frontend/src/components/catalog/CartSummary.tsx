import type { CartPpdImpact, CartTotals } from '../../lib/catalog';
import { moneyCents } from '../../lib/catalog';

export interface CartBudgetVM {
  label: string;
  capUsd: number;
  projectedSpent: number;
  remaining: number;
  pct: number;
  derived: string | null;
}

/** Sticky order summary for the cart page: money split, derived budget + PPD, and the one primary action. */
export function CartSummary({
  totals,
  firstMonthTotal,
  lineCount,
  patientCount,
  atRiskCount,
  budget,
  ppd,
  orderCount,
  placing = false,
  onPlaceOrder,
}: {
  totals: CartTotals;
  firstMonthTotal: number;
  lineCount: number;
  patientCount: number;
  atRiskCount: number;
  budget: CartBudgetVM | null;
  ppd: CartPpdImpact;
  /** Orders this cart will become — one per patient and vendor, matching the backend's split. */
  orderCount: number;
  placing?: boolean;
  onPlaceOrder: () => void;
}) {
  const meterWidth = budget ? Math.min(100, Math.max(0, budget.pct)) : 0;
  const meterColor = budget && budget.pct > 100 ? 'bg-risk' : budget && budget.pct >= 85 ? 'bg-warn' : 'bg-ink';

  return (
    <aside className="border border-line bg-surface p-5 lg:sticky lg:top-24">
      <h2 className="text-base font-semibold">Summary</h2>

      <div className="mt-3.5 flex items-baseline justify-between py-1.5 text-[13px] text-ink-2">
        <span>Monthly rentals</span>
        <span className="font-mono tabular-nums text-ink">
          {moneyCents(totals.monthly)}<span className="text-ink-3">/mo</span>
        </span>
      </div>
      {totals.oneTime > 0 && (
        <div className="flex items-baseline justify-between py-1.5 text-[13px] text-ink-2">
          <span>One-time purchases</span>
          <span className="font-mono tabular-nums text-ink">{moneyCents(totals.oneTime)}</span>
        </div>
      )}
      <div className="flex items-baseline justify-between py-1.5 text-[13px] text-ink-2">
        <span>Shipping</span>
        <span className="text-ink">Billed to contract</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between border-t border-line-strong py-3 text-[15px] font-semibold">
        <span>First-month total</span>
        <span className="font-mono tabular-nums">{moneyCents(firstMonthTotal)}</span>
      </div>

      {budget && (
        <div className="mt-1 border border-line bg-bg-subtle p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] uppercase tracking-[0.07em] text-ink-3">{budget.label}</span>
            <span className="font-mono text-xs tabular-nums text-ink-2">{Math.round(budget.pct)}% used</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-track">
            <div className={`h-full ${meterColor}`} style={{ width: `${meterWidth}%` }} />
          </div>
          <div className="mt-2 font-mono text-[11px] tabular-nums text-ink-3">
            {moneyCents(budget.projectedSpent)} of {moneyCents(budget.capUsd)} after this order ·{' '}
            {moneyCents(budget.remaining)} left
          </div>
          {budget.derived && <div className="mt-1 text-[10.5px] text-ink-3">{budget.derived}</div>}
        </div>
      )}

      <div className="mt-3 text-[11px] leading-relaxed text-ink-3">
        Adds ≈ <span className="font-medium text-ink">{moneyCents(ppd.ppdContribution)}</span> to hospice DME PPD
        ({moneyCents(ppd.perDay)}/day rental across {ppd.census}-patient census). PPD derived from synthetic data.
      </div>

      {atRiskCount > 0 && (
        <div className="mt-3 border border-risk bg-risk-bg px-3 py-2 text-[11.5px] leading-snug text-risk">
          {atRiskCount} item{atRiskCount > 1 ? 's' : ''} arrive after a patient discharge — review before ordering.
        </div>
      )}

      <button
        type="button"
        onClick={onPlaceOrder}
        disabled={placing}
        className="mt-4 w-full border border-solid-bg bg-solid-bg px-4 py-3.5 text-[11px] uppercase tracking-[0.1em] text-solid-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {placing ? 'Placing order…' : 'Place order'}
      </button>
      <div className="mt-3 text-[11px] leading-relaxed text-ink-3">
        {orderCount > 1
          ? `${orderCount} orders will be created — one per patient and vendor.`
          : 'One order will be created.'}{' '}
        {lineCount} line{lineCount > 1 ? 's' : ''} total across {patientCount} patient
        {patientCount > 1 ? 's' : ''}.
      </div>
    </aside>
  );
}
