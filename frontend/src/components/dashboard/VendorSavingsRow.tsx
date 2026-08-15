import { moneyLabel } from '../../lib/catalog';
import { SERVICE_FLOOR_PCT } from '../../lib/costLedger';
import type { VendorSavingsOption } from '../../lib/vendorSavings';

const BADGE = 'rounded-full border px-2 py-0.5 text-[11px]';
const BADGE_NEUTRAL = `${BADGE} border-line-strong bg-bg-subtle text-ink-2`;
const BADGE_MUTED = `${BADGE} border-line bg-bg-subtle text-ink-3`;
const BADGE_WARN = `${BADGE} border-warn bg-warn-bg text-warn`;

/** One vendor option: what it would cost, why it scores the way it does, and by how much. */
export function VendorSavingsRow({
  option,
  isBestValue,
}: {
  option: VendorSavingsOption;
  isBestValue: boolean;
}) {
  const saves = option.savingsUsd > 0;
  const noCoverage = option.servedZipCount === 0;

  return (
    <li className="rounded-card border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-ink">{option.vendor.displayName}</span>
            {isBestValue ? (
              <span className="rounded-full border border-good bg-good-bg px-1.5 py-0.5 text-[10px] text-good">
                Best value
              </span>
            ) : null}
          </div>
          <div className={`mt-1 text-[15px] font-semibold tabular-nums ${saves ? 'text-good' : 'text-ink'}`}>
            {saves
              ? `↓ ${moneyLabel(option.savingsUsd)} cheaper`
              : `+${moneyLabel(Math.abs(option.savingsUsd))} more than paid`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.06em] text-ink-3">Value</div>
          <div className="text-[17px] font-semibold tabular-nums text-ink">{option.valueScore}</div>
        </div>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-[3px] bg-track">
        <div className="h-full bg-ink" style={{ width: `${option.valueScore}%` }} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className={BADGE_NEUTRAL}>
          ★ {option.rating.toFixed(1)} ({option.ratingCount})
        </span>
        <span className={BADGE_NEUTRAL}>{option.onTimePct}% on-time</span>
        {noCoverage ? (
          <span className={BADGE_WARN}>
            Doesn't serve your patients (0/{option.patientZipCount} ZIPs)
          </span>
        ) : (
          <span className={BADGE_NEUTRAL}>
            serves {option.servedZipCount}/{option.patientZipCount} ZIPs
          </span>
        )}
        {!option.qualified ? (
          <span className={BADGE_MUTED}>below {SERVICE_FLOOR_PCT}% service floor</span>
        ) : null}
      </div>
    </li>
  );
}
