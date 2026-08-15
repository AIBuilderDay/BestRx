import { useMemo } from 'react';
import { aiUsageTrendForRange, formatTokenCount } from '../../lib/aiUsage';
import { moneyCents } from '../../lib/catalog';
import type { CostPeriod } from '../../lib/costPeriod';
import { TREND_RANGES, type TrendRange } from '../../lib/trendRange';
import { SimpleTrendChart } from './SimpleTrendChart';

export function AiTokenRangePanel({
  hospiceId,
  period,
  userIds,
  range,
  onRangeChange,
}: {
  hospiceId: string;
  period: CostPeriod;
  userIds: string[];
  range: TrendRange;
  onRangeChange: (range: TrendRange) => void;
}) {
  const points = useMemo(
    () => aiUsageTrendForRange(hospiceId, period, range, userIds),
    [hospiceId, period, range, userIds],
  );
  const totalTokens = points?.reduce((sum, point) => sum + point.tokenCount, 0) ?? 0;
  const totalRequests = points?.reduce((sum, point) => sum + point.requestCount, 0) ?? 0;

  return (
    <section className="mt-4 rounded-card border border-ink bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] text-ink">AI token spend over time</h2>
          <p className="mt-1 max-w-[62ch] text-[12px] text-ink-3">
            {points
              ? `${formatTokenCount(totalTokens)} tokens across ${totalRequests} AI request${totalRequests === 1 ? '' : 's'} in this range.`
              : "Not enough AI usage history for this range yet — real data is available under 1wk and 1mo."}
          </p>
        </div>

        <div role="tablist" aria-label="AI spend range" className="flex flex-wrap gap-1.5">
          {TREND_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={r.key === range}
              onClick={() => onRangeChange(r.key)}
              title={r.hasRealData ? undefined : 'No AI usage history before Aug 2026 yet'}
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

      <div key={range} className="animate-[sheetIn_0.3s_cubic-bezier(0.2,0.7,0.2,1)_both] motion-reduce:animate-none">
        {points ? (
          <SimpleTrendChart points={points} formatValue={moneyCents} />
        ) : (
          <p className="mt-6 py-8 text-center text-[13px] text-ink-3">
            * No real AI usage history behind this range yet.
          </p>
        )}
      </div>
    </section>
  );
}
