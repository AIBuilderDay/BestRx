import { useMemo, useState } from 'react';
import { moneyLabel } from '../../lib/catalog';
import { niceScale, toPoints, TREND_BOX } from '../../lib/chartScale';
import { spendTrendForRange, type BasketLine, type TrendBucket } from '../../lib/costLedger';
import type { CostPeriod } from '../../lib/costPeriod';
import { TREND_RANGES, type TrendRange } from '../../lib/trendRange';
import { SpendTrendChart } from './SpendTrendChart';

/**
 * Total Spend's range picker. Unlike Cost per patient-day, this is real: 1wk is the last 7 real
 * days on file, 1mo is the real weekly split across August, both from lib/costLedger.ts. 3mo/6mo/
 * 1yr have no order history behind them yet — rather than fabricate a placeholder like the PPD
 * tile does, this shows an honest "not enough history" message and no chart.
 */
export function SpendRangePanel({
  hospiceId,
  period,
  lines,
  range,
  onRangeChange,
}: {
  hospiceId: string;
  period: CostPeriod;
  lines: BasketLine[];
  range: TrendRange;
  onRangeChange: (range: TrendRange) => void;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const buckets = useMemo(
    () => spendTrendForRange(hospiceId, period, lines, range),
    [hospiceId, period, lines, range],
  );

  return (
    <section className="mt-4 rounded-card border border-ink bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] text-ink">Total Spend over time</h2>
          <p className="mt-1 max-w-[60ch] text-[12px] text-ink-3">
            {buckets
              ? 'Real spend, by order date — each order priced at the vendor that took it.'
              : "Not enough order history for this range yet — the dataset covers Aug 1–22, 2026. Real data is available under 1wk and 1mo."}
          </p>
        </div>

        <div role="tablist" aria-label="Trend range" className="flex flex-wrap gap-1.5">
          {TREND_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={r.key === range}
              onClick={() => {
                onRangeChange(r.key);
                setHoverIndex(null);
              }}
              title={r.hasRealData ? undefined : 'No history before Aug 2026 yet'}
              className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                r.key === range
                  ? 'border-solid-bg bg-solid-bg text-solid-ink'
                  : 'border-line-strong bg-surface text-ink-2 hover:border-ink hover:text-ink'
              }`}
            >
              {r.label}
              {r.hasRealData ? null : <span className="ml-1 text-[10px] opacity-70">*</span>}
            </button>
          ))}
        </div>
      </div>

      {buckets ? (
        <SpendRangeChart buckets={buckets} hoverIndex={hoverIndex} onHoverIndex={setHoverIndex} />
      ) : (
        <p className="mt-6 py-8 text-center text-[13px] text-ink-3">
          * No real order history behind this range yet.
        </p>
      )}
    </section>
  );
}

function SpendRangeChart({
  buckets,
  hoverIndex,
  onHoverIndex,
}: {
  buckets: TrendBucket[];
  hoverIndex: number | null;
  onHoverIndex: (index: number | null) => void;
}) {
  const actual = buckets.map((b) => b.actualUsd);
  const scale = niceScale(Math.max(...actual, 0));
  const points = toPoints(TREND_BOX, actual, scale.top);
  const hovered = hoverIndex === null ? null : buckets[hoverIndex];
  const partialLabel = buckets.find((b) => b.partial)?.label;

  return (
    <>
      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-3">
        <span className="h-0.5 w-4 bg-ink" />
        Paid
        {partialLabel ? <span>· {partialLabel} is partial, the dataset's last order is Aug 22</span> : null}
      </div>

      <div className="relative mt-2">
        <SpendTrendChart buckets={buckets} hoverIndex={hoverIndex} onHoverIndex={onHoverIndex} />

        {hovered && hoverIndex !== null ? (
          <div
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-[120%] rounded-control border border-line-strong bg-surface px-2.5 py-1.5 text-[12px] shadow-sm motion-reduce:transition-none"
            style={{
              left: `${(points[hoverIndex].x / TREND_BOX.width) * 100}%`,
              top: `${(points[hoverIndex].y / TREND_BOX.height) * 100}%`,
            }}
          >
            <div className="text-ink-3">
              {hovered.label}
              {hovered.partial ? ' · partial' : ''}
            </div>
            <div className="font-medium text-ink tabular-nums">{moneyLabel(hovered.actualUsd)}</div>
          </div>
        ) : null}
      </div>
    </>
  );
}
