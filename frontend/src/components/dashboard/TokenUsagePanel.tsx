import type { AiFeature, AiUsageSummary } from '../../types/ai';

const FEATURE_LABELS: Record<AiFeature, string> = {
  rerank: 'Search re-rank',
  agent_order: 'Agent ordering',
};

/** Sub-cent AI costs round to "$0.00" under the app's normal money formatter — misleading here. */
export function costLabel(usd: number): string {
  return usd === 0 ? '$0.00' : '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/**
 * Real per-feature AI spend, read straight from this browser's token ledger
 * (lib/ai/usage.ts) — every call the AI-enhanced search and agent-ordering
 * features made in this session, nothing modeled or estimated.
 */
export function TokenUsagePanel({ summary }: { summary: AiUsageSummary }) {
  const features = Object.keys(FEATURE_LABELS) as AiFeature[];
  const hasCalls = summary.total.calls > 0;

  return (
    <section className="mt-4 rounded-card border border-ink bg-surface p-4">
      <h2 className="text-[15px] text-ink">AI token usage this session</h2>
      <p className="mt-1 text-[12px] text-ink-3">
        Real calls to Claude Haiku from AI search re-rank and agent ordering, read from this
        browser&apos;s token ledger. Session-scoped — it resets if the ledger is cleared, and it is
        not a billing record.
      </p>

      {!hasCalls ? (
        <p className="mt-6 py-8 text-center text-[13px] text-ink-3">
          No AI calls yet this session — try AI search in the catalog, or ask the agent to place an
          order.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                <th className="py-2 pr-3 font-normal">Feature</th>
                <th className="py-2 pr-3 text-right font-normal">Calls</th>
                <th className="py-2 pr-3 text-right font-normal">Input tokens</th>
                <th className="py-2 pr-3 text-right font-normal">Output tokens</th>
                <th className="py-2 pr-0 text-right font-normal">Cost</th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature) => {
                const t = summary.byFeature[feature];
                return (
                  <tr key={feature} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-ink">{FEATURE_LABELS[feature]}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink-2">{t.calls}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink-2">
                      {t.inputTokens.toLocaleString('en-US')}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-ink-2">
                      {t.outputTokens.toLocaleString('en-US')}
                    </td>
                    <td className="py-2 pr-0 text-right tabular-nums text-ink-2">{costLabel(t.costUsd)}</td>
                  </tr>
                );
              })}
              <tr className="text-ink">
                <td className="py-2 pr-3 font-medium">Total</td>
                <td className="py-2 pr-3 text-right tabular-nums font-medium">{summary.total.calls}</td>
                <td className="py-2 pr-3 text-right tabular-nums font-medium">
                  {summary.total.inputTokens.toLocaleString('en-US')}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums font-medium">
                  {summary.total.outputTokens.toLocaleString('en-US')}
                </td>
                <td className="py-2 pr-0 text-right tabular-nums font-medium">
                  {costLabel(summary.total.costUsd)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
