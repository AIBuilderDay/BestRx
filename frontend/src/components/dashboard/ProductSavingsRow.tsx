import { moneyCents, moneyLabel } from '../../lib/catalog';
import { SERVICE_FLOOR_PCT } from '../../lib/costLedger';
import type { ProductSavingsRow as ProductSavingsRowData } from '../../lib/vendorSavings';

const BADGE = 'rounded-full border px-2 py-0.5 text-[11px]';
const BADGE_NEUTRAL = `${BADGE} border-line-strong bg-bg-subtle text-ink-2`;
const BADGE_MUTED = `${BADGE} border-line bg-bg-subtle text-ink-3`;
const BADGE_WARN = `${BADGE} border-warn bg-warn-bg text-warn`;

/** One ordered product: what was paid, the AI-suggested alternative, and the per-unit + total delta. */
export function ProductSavingsRow({ row }: { row: ProductSavingsRowData }) {
  const suggested = row.suggested;
  const saves = suggested !== null && suggested.savingsUsd > 0;
  const noCoverage = suggested !== null && suggested.servedZipCount === 0;
  const perUnitDeltaUsd = suggested === null ? null : row.paidUnitUsd - suggested.unitUsd;

  return (
    <li className="rounded-card border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] text-ink-3">{row.hcpcs}</span>
            <span className="text-[13px] font-medium text-ink">{row.name}</span>
          </div>
          <div className="mt-0.5 text-[12px] text-ink-3">
            {row.units} ordered this period · paid {moneyCents(row.paidUnitUsd)}/unit ·{' '}
            {moneyLabel(row.paidUsd)} total
          </div>
        </div>
        {suggested ? (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Value</div>
            <div className="text-[17px] font-semibold tabular-nums text-ink">{suggested.valueScore}</div>
          </div>
        ) : null}
      </div>

      {suggested === null ? (
        <p className="mt-2 text-[12px] text-ink-3">No other vendor prices this product.</p>
      ) : (
        <>
          <div className="mt-2.5 rounded-control bg-bg-subtle px-3 py-2">
            <div className="text-[12px] text-ink-2">
              AI suggests <strong className="font-medium text-ink">{suggested.vendor.displayName}</strong>{' '}
              at {moneyCents(suggested.unitUsd)}/unit, vs {moneyCents(row.paidUnitUsd)}/unit paid
            </div>
            <div className={`mt-1 text-[15px] font-semibold tabular-nums ${saves ? 'text-good' : 'text-ink'}`}>
              {saves
                ? `↓ ${moneyCents(Math.abs(perUnitDeltaUsd ?? 0))}/unit · ${moneyLabel(suggested.savingsUsd)} saved on this basket`
                : `+${moneyCents(Math.abs(perUnitDeltaUsd ?? 0))}/unit · ${moneyLabel(Math.abs(suggested.savingsUsd))} more for this basket`}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className={BADGE_NEUTRAL}>
              ★ {suggested.rating.toFixed(1)} ({suggested.ratingCount})
            </span>
            <span className={BADGE_NEUTRAL}>{suggested.onTimePct}% on-time</span>
            {noCoverage ? (
              <span className={BADGE_WARN}>
                Doesn't serve your patients (0/{suggested.patientZipCount} ZIPs)
              </span>
            ) : (
              <span className={BADGE_NEUTRAL}>
                serves {suggested.servedZipCount}/{suggested.patientZipCount} ZIPs
              </span>
            )}
            {!suggested.qualified ? (
              <span className={BADGE_MUTED}>below {SERVICE_FLOOR_PCT}% service floor</span>
            ) : null}
          </div>
        </>
      )}
    </li>
  );
}
