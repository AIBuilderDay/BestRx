import { moneyCents, moneyLabel } from '../../lib/catalog';
import { SERVICE_FLOOR_PCT } from '../../lib/costLedger';
import type { ProductSavingsRow as ProductSavingsRowData } from '../../lib/vendorSavings';

const CELL = 'px-3 py-2.5 text-right tabular-nums';
const BADGE = 'rounded-full border px-2 py-0.5 text-[11px]';
const BADGE_NEUTRAL = `${BADGE} border-line-strong bg-bg-subtle text-ink-2`;
const BADGE_MUTED = `${BADGE} border-line bg-bg-subtle text-ink-3`;
const BADGE_WARN = `${BADGE} border-warn bg-warn-bg text-warn`;
const SCORE_BADGE = 'inline-flex min-w-9 justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums';

const valueScoreColor = (score: number): string =>
  score > 75
    ? 'border-score-good bg-score-good text-score-good-ink'
    : score > 50
      ? 'border-score-warn bg-score-warn text-score-warn-ink'
      : 'border-score-risk bg-score-risk text-score-risk-ink';

const formatSavingsDelta = (savingsUsd: number): string => {
  if (savingsUsd > 0) return `${moneyLabel(savingsUsd)} less than paid`;
  if (savingsUsd < 0) return `${moneyLabel(Math.abs(savingsUsd))} more than paid`;
  return 'same as paid';
};

const serviceAreaSummary = (suggested: ProductSavingsRowData['suggested']): string => {
  if (suggested === null) return '';
  if (suggested.unservedLocations.length === 0) {
    return `Yes - serves ${suggested.servedLocations.join(', ')}`;
  }
  return `Partial - serves ${suggested.servedLocations.join(', ')}; misses ${suggested.unservedLocations.join(', ')}`;
};

const lossPenaltyLabel = (penalty: number): string =>
  penalty > 0 ? `, ${penalty} point loss penalty` : '';

/** One ordered product: the AI-suggested alternative vendor, its rating, unit price, and savings vs. what was paid. */
export function ProductSavingsRow({
  row,
  isPreferred,
  onUseVendor,
}: {
  row: ProductSavingsRowData;
  isPreferred: boolean;
  onUseVendor: (hcpcs: string, vendorId: string) => void;
}) {
  const suggested = row.suggested;
  const saves = suggested !== null && suggested.savingsUsd > 0;

  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2.5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[11px] text-ink-3">{row.hcpcs}</span>
          <span className="text-[13px] font-medium text-ink">{row.name}</span>
        </div>
        <div className="mt-0.5 text-[12px] text-ink-3">
          {row.units} ordered · paid {moneyCents(row.paidUnitUsd)}/unit
        </div>
      </td>

      {suggested === null ? (
        <td className="px-3 py-2.5 text-[12px] text-ink-3" colSpan={6}>
          No other vendor prices this product.
        </td>
      ) : (
        <>
          <td className="px-3 py-2.5">
            <div className="text-ink">{suggested.vendor.displayName}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {suggested.unservedLocations.length === 0 ? (
                <span className={BADGE_NEUTRAL}>serves {suggested.servedLocations.join(', ')}</span>
              ) : (
                <span className={BADGE_WARN}>
                  doesn't serve {suggested.unservedLocations.join(', ')}
                </span>
              )}
              {!suggested.qualified ? (
                <span className={BADGE_MUTED}>below {SERVICE_FLOOR_PCT}% floor</span>
              ) : null}
            </div>
          </td>
          <td className={CELL}>
            ★ {suggested.rating.toFixed(1)}
            <span className="ml-1 text-[11px] text-ink-3">({suggested.ratingCount})</span>
          </td>
          <td className={CELL}>{moneyCents(suggested.unitUsd)}</td>
          <td className={`${CELL} font-semibold ${saves ? 'bg-good-bg text-good' : 'text-ink'}`}>
            {saves
              ? moneyLabel(suggested.savingsUsd)
              : `-${moneyLabel(Math.abs(suggested.savingsUsd))}`}
          </td>
          <td className={CELL}>
            <span
              className="group relative inline-flex align-middle outline-none"
              tabIndex={0}
              aria-label={`Value score ${suggested.valueScore}. Savings ${suggested.valueCriteria.savingsScore} of 5, ${formatSavingsDelta(suggested.savingsUsd)}${lossPenaltyLabel(suggested.valueCriteria.lossPenalty)}. Vendor rating ${suggested.valueCriteria.ratingScore} of 5. Local service ${suggested.valueCriteria.localServiceScore} of 5, ${serviceAreaSummary(suggested)}.`}
              title={`Savings: ${suggested.valueCriteria.savingsScore}/5 - ${formatSavingsDelta(suggested.savingsUsd)}${lossPenaltyLabel(suggested.valueCriteria.lossPenalty)}
Vendor rating: ${suggested.valueCriteria.ratingScore}/5
Local service: ${suggested.valueCriteria.localServiceScore}/5 - ${serviceAreaSummary(suggested)}`}
            >
              <span className={`${SCORE_BADGE} ${valueScoreColor(suggested.valueScore)}`}>
                {suggested.valueScore}
              </span>
              <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-2 hidden w-72 rounded-control border border-line-strong bg-solid-bg p-3 text-left text-[12px] leading-snug text-solid-ink shadow-lg group-hover:block group-focus:block">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] opacity-70">
                  Value score criteria
                </span>
                <span className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  <span className="opacity-70">Savings</span>
                  <span>
                    {suggested.valueCriteria.savingsScore}/5 - {formatSavingsDelta(suggested.savingsUsd)}
                    {lossPenaltyLabel(suggested.valueCriteria.lossPenalty)}
                  </span>
                  <span className="opacity-70">Vendor rating</span>
                  <span>{suggested.valueCriteria.ratingScore}/5</span>
                  <span className="opacity-70">Local service</span>
                  <span>
                    {suggested.valueCriteria.localServiceScore}/5 - {serviceAreaSummary(suggested)}
                  </span>
                </span>
              </span>
            </span>
          </td>
          <td className="px-3 py-2.5 text-right">
            <button
              type="button"
              disabled={isPreferred}
              onClick={() => onUseVendor(row.hcpcs, suggested.vendor.id)}
              className={
                isPreferred
                  ? 'rounded-control border border-good bg-good-bg px-2.5 py-1 text-[11px] font-medium text-good'
                  : 'rounded-control border border-line-strong px-2.5 py-1 text-[11px] text-ink-2 transition-colors hover:border-ink hover:text-ink'
              }
            >
              {isPreferred ? '✓ Preferred' : 'Use this vendor'}
            </button>
          </td>
        </>
      )}
    </tr>
  );
}
