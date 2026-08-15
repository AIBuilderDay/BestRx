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
  onPlaceOrder,
  payWithCard,
  fulfillment,
  onFulfillmentChange,
  placeOrderLabel = 'Place order',
}: {
  totals: CartTotals;
  firstMonthTotal: number;
  lineCount: number;
  patientCount: number;
  atRiskCount: number;
  budget: CartBudgetVM | null;
  ppd: CartPpdImpact;
  onPlaceOrder: () => void;
  /**
   * Set for a family member paying themselves (the card label, e.g. "Visa ···· 4242"). Swaps the
   * hospice budget/PPD/contract framing for a personal-payment one — none of that applies to them.
   */
  payWithCard?: string;
  /** Family only: whether they're asking the hospice to send it, or buying it. Shows a toggle. */
  fulfillment?: 'request' | 'buy';
  onFulfillmentChange?: (mode: 'request' | 'buy') => void;
  placeOrderLabel?: string;
}) {
  // A request costs the family nothing, so we hide every dollar figure in that mode.
  const requestMode = fulfillment === 'request';
  const meterWidth = budget ? Math.min(100, Math.max(0, budget.pct)) : 0;
  const meterColor = budget && budget.pct > 100 ? 'bg-risk' : budget && budget.pct >= 85 ? 'bg-warn' : 'bg-ink';

  return (
    <aside className="border border-line bg-surface p-5 lg:sticky lg:top-24">
      <h2 className="text-base font-semibold">Summary</h2>

      {fulfillment && onFulfillmentChange && (
        <div className="mt-3.5">
          <div className="grid grid-cols-2 gap-0 rounded-control border border-line-strong p-0.5">
            {(['request', 'buy'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onFulfillmentChange(mode)}
                className={`rounded-[6px] px-2 py-1.5 text-[12px] font-medium transition-colors ${
                  fulfillment === mode ? 'bg-solid-bg text-solid-ink' : 'text-ink-2 hover:text-ink'
                }`}
              >
                {mode === 'request' ? 'Request from hospice' : 'Buy myself'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            {fulfillment === 'request'
              ? 'The hospice reviews your request and sends it at no cost to you.'
              : 'You pay and it ships straight to the home.'}
          </p>
        </div>
      )}

      {requestMode ? (
        <div className="mt-3.5 flex items-baseline justify-between border-t border-line-strong py-3 text-[13px] text-ink-2">
          <span>To request</span>
          <span className="text-ink">{lineCount} item{lineCount === 1 ? '' : 's'}</span>
        </div>
      ) : (
        <>
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
            <span className="text-ink">{payWithCard ? 'Ships to the home' : 'Billed to contract'}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t border-line-strong py-3 text-[15px] font-semibold">
            <span>First-month total</span>
            <span className="font-mono tabular-nums">{moneyCents(firstMonthTotal)}</span>
          </div>
        </>
      )}

      {payWithCard && (
        <div className="mt-1 flex items-center justify-between border border-line bg-bg-subtle px-3 py-2.5 text-[13px]">
          <span className="text-ink-2">Payment method</span>
          <span className="font-mono text-[12px] tabular-nums text-ink">{payWithCard}</span>
        </div>
      )}

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

      {!fulfillment && (
        <div className="mt-3 text-[11px] leading-relaxed text-ink-3">
          Adds ≈ <span className="font-medium text-ink">{moneyCents(ppd.ppdContribution)}</span> to hospice DME PPD
          ({moneyCents(ppd.perDay)}/day rental across {ppd.census}-patient census). PPD derived from synthetic data.
        </div>
      )}

      {atRiskCount > 0 && (
        <div className="mt-3 border border-risk bg-risk-bg px-3 py-2 text-[11.5px] leading-snug text-risk">
          {atRiskCount} item{atRiskCount > 1 ? 's' : ''} arrive after a patient discharge — review before ordering.
        </div>
      )}

      <button
        type="button"
        onClick={onPlaceOrder}
        className="mt-4 w-full border border-solid-bg bg-solid-bg px-4 py-3.5 text-[11px] uppercase tracking-[0.1em] text-solid-ink transition-opacity hover:opacity-85"
      >
        {placeOrderLabel}
      </button>
      <div className="mt-3 text-[11px] leading-relaxed text-ink-3">
        {fulfillment === 'request' ? (
          <>Your request goes to the hospice team to review — they&rsquo;ll follow up with you.</>
        ) : payWithCard ? (
          <>Charged to {payWithCard}. Ships to the home; vendors are confirmed at dispatch.</>
        ) : (
          <>
            {patientCount > 1
              ? `${patientCount} orders will be created — one per patient.`
              : 'One order will be created.'}{' '}
            Vendors are confirmed at dispatch. {lineCount} line{lineCount > 1 ? 's' : ''} total.
          </>
        )}
      </div>
    </aside>
  );
}
