import {
  generateTrendSeries,
  partitionsCurrentValue,
  TREND_RANGES,
  type MetricKey,
  type TrendRange,
} from '../../lib/costTrendMock';
import { SimpleTrendChart } from './SimpleTrendChart';

export interface TrendMetricVM {
  key: MetricKey;
  label: string;
  currentValue: number;
  formatValue: (value: number) => string;
}

/**
 * Shared chart panel below the stat tiles. Selecting a tile swaps the metric shown here; the range
 * pills pick how far back the (placeholder) history reaches. See costTrendMock.ts for why this
 * data is synthetic rather than derived.
 */
export function MetricTrendPanel({
  metric,
  range,
  onRangeChange,
}: {
  metric: TrendMetricVM;
  range: TrendRange;
  onRangeChange: (range: TrendRange) => void;
}) {
  const series = generateTrendSeries(metric.key, range, metric.currentValue);
  const partitioned = partitionsCurrentValue(metric.key, range);

  return (
    <section className="mt-4 rounded-card border border-ink bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] text-ink">{metric.label} over time</h2>
          <p className="mt-1 text-[12px] text-ink-3">
            Illustrative history — the dataset covers Aug 1–22, 2026 only, so everything on this
            chart before the real figure is placeholder trend data standing in until historical
            figures exist.{' '}
            {partitioned
              ? "These points are split so they sum to the real total on the tile above."
              : 'The most recent point matches the real value on the tile above exactly.'}
          </p>
        </div>

        <div role="tablist" aria-label="Trend range" className="flex flex-wrap gap-1.5">
          {TREND_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={r.key === range}
              onClick={() => onRangeChange(r.key)}
              title={r.hasRealData ? undefined : 'No history before Aug 2026 — showing placeholder data'}
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

      <SimpleTrendChart points={series} formatValue={metric.formatValue} />

      <p className="mt-2 text-[11px] text-ink-3">* No real order history behind this range yet.</p>
    </section>
  );
}
