import { useState } from 'react';
import { moneyLabel } from '../../lib/catalog';
import { niceScale, toPoints, TREND_BOX } from '../../lib/chartScale';
import type { TrendBucket } from '../../lib/costLedger';
import { SpendTrendChart } from './SpendTrendChart';

/**
 * Chart chrome plus the hover state. The tooltip is positioned in percentages of the chart box, so
 * it tracks its point at any width without measuring anything.
 */
export function SpendTrendCard({ buckets }: { buckets: TrendBucket[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const actual = buckets.map((b) => b.actualUsd);
  const scale = niceScale(Math.max(...actual, 0));
  const points = toPoints(TREND_BOX, actual, scale.top);
  const hovered = hoverIndex === null ? null : buckets[hoverIndex];
  const partialLabel = buckets.find((b) => b.partial)?.label;

  return (
    <section className="mt-8 rounded-card border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] text-ink">Spend over time</h2>
          <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2">
            Spend committed per week, by order date — each order priced at the vendor that took it.
            {partialLabel ? ` ${partialLabel} is partial; the dataset's last order is Aug 22.` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-ink-3">
          <span className="h-0.5 w-4 bg-ink" />
          Paid
        </div>
      </div>

      <div className="relative mt-3">
        <SpendTrendChart buckets={buckets} hoverIndex={hoverIndex} onHoverIndex={setHoverIndex} />

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
    </section>
  );
}
