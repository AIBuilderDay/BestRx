import { useEffect } from 'react';
import { moneyCents, moneyLabel } from '../../lib/catalog';
import type { BasketLine, VendorColumn } from '../../lib/costLedger';
import { priceLadder } from '../../lib/costLedger';

const TONE_BAR: Record<string, string> = {
  contracted: 'bg-ink',
  best: 'bg-good',
  alt: 'bg-s3',
  risk: 'ladder-bar-risk',
};

const TONE_PILL: Record<string, string> = {
  contracted: 'border-line-strong bg-surface text-ink-2',
  best: 'border-good bg-good-bg text-good',
  alt: 'border-line bg-bg-subtle text-ink-3',
  risk: 'border-warn bg-warn-bg text-warn',
};

const TONE_LABEL: Record<string, string> = {
  contracted: 'contracted',
  best: 'best qualified',
  alt: 'alternative',
  risk: 'below service floor',
};

/** Why one code is priced the way it is, and what switching it would actually trade. */
export function CodeDrawer({
  line,
  columns,
  onClose,
  onAction,
}: {
  line: BasketLine;
  columns: VendorColumn[];
  onClose: () => void;
  onAction: (message: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = priceLadder(line, columns);
  const best = columns.find((c) => c.vendor.id === line.bestQualifiedVendorId);
  const delta = line.qualifiedDeltaUsd;

  const why =
    delta === null || best === undefined
      ? 'No qualified alternative sells this code, so there is nothing to compare against.'
      : delta > 0
        ? `${line.units} units this period, ${moneyLabel(line.actualUsd)} as bought. Moving this code to ${best.vendor.displayName} saves ${moneyLabel(delta)} and lifts on-time delivery to ${best.onTimePct}%.`
        : `${line.units} units this period, ${moneyLabel(line.actualUsd)} as bought. ${best.vendor.displayName} is the only vendor clearing the service floor and costs ${moneyLabel(Math.abs(delta))} more — that is the price of ${best.onTimePct}% on-time delivery, not a saving.`;

  return (
    <div className="mt-3 rounded-panel border border-ink bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] text-ink">
            {line.hcpcs} · {line.name}
          </h3>
          <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2">{why}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded-control border border-line-strong px-2 py-1 text-[13px] text-ink-2 hover:border-ink hover:text-ink"
        >
          ✕
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((row) => (
          <li
            key={row.vendor.id}
            className="grid grid-cols-[minmax(150px,auto)_1fr_96px] items-center gap-3"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[13px] text-ink">{row.vendor.displayName}</span>
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[10px] ${TONE_PILL[row.tone]}`}
              >
                {TONE_LABEL[row.tone]}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-[3px] bg-track">
              <div className={`h-full ${TONE_BAR[row.tone]}`} style={{ width: `${row.widthPct}%` }} />
            </div>
            <div className="text-right text-[13px] tabular-nums">
              <div>{row.extendedUsd === null ? '—' : moneyLabel(row.extendedUsd)}</div>
              <div className="text-[11px] text-ink-3">
                {row.unitUsd === null ? '—' : moneyCents(row.unitUsd)} · {row.onTimePct}/
                {row.onTimePickupPct}%
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-[12px] text-ink-3">
        Right column: extended cost, then unit price and on-time delivery / on-time pickup over the
        trailing 30 days.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            onAction('Nothing was changed — vendor switching is not wired up in this demo.')
          }
          className="rounded-control border border-ink bg-solid-bg px-3 py-1.5 text-[13px] text-solid-ink"
        >
          Model this switch
        </button>
        <button
          type="button"
          onClick={() => onAction('Nothing was sent — vendor messaging is not wired up in this demo.')}
          className="rounded-control border border-line-strong bg-surface px-3 py-1.5 text-[13px] text-ink-2 hover:border-ink hover:text-ink"
        >
          Request re-quote
        </button>
      </div>
    </div>
  );
}
