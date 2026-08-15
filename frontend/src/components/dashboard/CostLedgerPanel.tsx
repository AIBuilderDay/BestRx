import { useMemo, useState } from 'react';
import { moneyCents, moneyLabel } from '../../lib/catalog';
import { accountBreakdown, productBreakdown } from '../../lib/budgetBreakdown';
import type { AccountBudgetRow, AccountTotals } from '../../lib/budgetLedger';
import type { BasketLine, BasketTotals, TrendBucket, VendorColumn } from '../../lib/costLedger';
import { ledgerPpd, SERVICE_FLOOR_PCT } from '../../lib/costLedger';
import type { CostPeriod } from '../../lib/costPeriod';
import type { MetricKey, TrendRange } from '../../lib/costTrendMock';
import { BudgetBreakdownPanel } from './BudgetBreakdownPanel';
import { CodeDrawer } from './CodeDrawer';
import { LedgerControls } from './LedgerControls';
import { MetricTrendPanel, type TrendMetricVM } from './MetricTrendPanel';
import { SpendTrendCard } from './SpendTrendCard';
import { StatTiles, type StatTileVM } from './StatTiles';
import { VendorPriceMatrix } from './VendorPriceMatrix';

const DEFAULT_TREND_RANGE: TrendRange = '1m';

const percentLabel = (value: number): string => `${Math.round(value)}%`;

export function CostLedgerPanel({
  hospiceId,
  period,
  lines,
  totals,
  columns,
  trend,
  budgetTotals,
  accountRows,
  compareEnabled,
  onToggleCompare,
  openHcpcs,
  onOpenRow,
  onCloseRow,
  onAction,
}: {
  hospiceId: string;
  period: CostPeriod;
  lines: BasketLine[];
  totals: BasketTotals;
  columns: VendorColumn[];
  trend: TrendBucket[];
  budgetTotals: AccountTotals;
  accountRows: AccountBudgetRow[];
  compareEnabled: boolean;
  onToggleCompare: () => void;
  openHcpcs: string | null;
  onOpenRow: (hcpcs: string) => void;
  onCloseRow: () => void;
  onAction: (message: string) => void;
}) {
  const ppd = ledgerPpd(hospiceId, totals.actualUsd, period);
  const contracted = columns.find((c) => c.contracted);
  const qualified = columns.find((c) => c.qualified && !c.contracted);
  const delta = totals.qualifiedDeltaUsd;
  const openLine = lines.find((l) => l.hcpcs === openHcpcs) ?? null;

  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>('spend');
  const [trendRange, setTrendRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);

  const tiles: StatTileVM[] = [
    {
      key: 'spend',
      label: 'Total Spend',
      value: moneyLabel(totals.actualUsd),
      detail: `${moneyLabel(totals.rentalMonthlyUsd)}/mo rental + ${moneyLabel(totals.purchaseUsd)} one-time`,
      tone: 'plain',
    },
    {
      key: 'ppd',
      label: 'Cost per patient-day',
      value: moneyCents(ppd.ppdUsd),
      detail: `${ppd.census} patients on service × ${ppd.days} days`,
      tone: 'plain',
    },
    {
      key: 'delta',
      // The only vendor clearing the floor is the priciest, so this is usually a premium.
      // It is labelled for what it is rather than dressed up as a saving.
      label: delta !== null && delta < 0 ? 'Cost to qualify' : 'Savings available',
      value:
        delta === null
          ? '—'
          : delta > 0
            ? `↓ ${moneyLabel(delta)}`
            : `+${moneyLabel(Math.abs(delta))}`,
      detail:
        qualified && contracted
          ? `${qualified.vendor.displayName} ${qualified.onTimePct}% on-time vs ${contracted.onTimePct}% contracted`
          : `No vendor clears the ${SERVICE_FLOOR_PCT}% floor`,
      tone: delta !== null && delta > 0 ? 'good' : 'plain',
      chartable: delta !== null,
    },
    {
      key: 'budget',
      label: 'Budget utilization',
      value: budgetTotals.utilizationPct === null ? '—' : `${budgetTotals.utilizationPct}%`,
      detail: `of ${moneyLabel(budgetTotals.capUsd)} across ${
        budgetTotals.assignedPatients
      } assigned patients`,
      tone: (budgetTotals.utilizationPct ?? 0) >= 90 ? 'alert' : 'plain',
      chartable: budgetTotals.utilizationPct !== null,
    },
  ];

  const trendMetrics: Record<MetricKey, TrendMetricVM> = {
    spend: { key: 'spend', label: 'Total Spend', currentValue: totals.actualUsd, formatValue: moneyLabel },
    ppd: { key: 'ppd', label: 'Cost per patient-day', currentValue: ppd.ppdUsd, formatValue: moneyCents },
    delta: {
      key: 'delta',
      label: tiles[2].label,
      currentValue: delta ?? 0,
      formatValue: (v) => (v < 0 ? `-${moneyLabel(Math.abs(v))}` : moneyLabel(v)),
    },
    budget: {
      key: 'budget',
      label: 'Budget utilization',
      currentValue: budgetTotals.utilizationPct ?? 0,
      formatValue: percentLabel,
    },
  };

  const selectMetric = (key: string) => {
    if (!['spend', 'ppd', 'delta', 'budget'].includes(key)) return;
    setSelectedMetric((current) => (current === key ? null : (key as MetricKey)));
  };

  const productSlices = useMemo(() => productBreakdown(lines), [lines]);
  const accountSlices = useMemo(() => accountBreakdown(accountRows), [accountRows]);

  return (
    <div className="mt-5">
      <StatTiles tiles={tiles} selectedKey={selectedMetric} onSelect={selectMetric} />

      {selectedMetric === 'budget' ? (
        <BudgetBreakdownPanel
          productSlices={productSlices}
          accountSlices={accountSlices}
          totalUsd={totals.actualUsd}
        />
      ) : selectedMetric ? (
        <MetricTrendPanel
          metric={trendMetrics[selectedMetric]}
          range={trendRange}
          onRangeChange={setTrendRange}
        />
      ) : null}

      <div className="mt-4">
        <LedgerControls
          period={period}
          compareEnabled={compareEnabled}
          onToggleCompare={onToggleCompare}
        />
      </div>

      <div className="mt-3">
        <VendorPriceMatrix
          lines={lines}
          totals={totals}
          columns={columns}
          compareEnabled={compareEnabled}
          openHcpcs={openHcpcs}
          onOpenRow={onOpenRow}
          periodLabel={period.label}
        />
      </div>

      {openLine ? (
        <CodeDrawer line={openLine} columns={columns} onClose={onCloseRow} onAction={onAction} />
      ) : null}

      <p className="mt-3 max-w-[92ch] text-[12px] text-ink-3">
        {compareEnabled ? (
          <>
            <strong className="font-medium text-ink-2">Qualified</strong> means on-time delivery at or
            above {SERVICE_FLOOR_PCT}%. {columns.find((c) => !c.qualified && !c.contracted)?.vendor
              .displayName ?? 'The cheapest vendor'}{' '}
            is cheaper on most codes but runs below that floor, so its prices are marked rather than
            recommended. Paid is what this hospice actually spent, each order at the vendor that took
            it; the vendor columns re-price that same basket as a counterfactual.
          </>
        ) : (
          <>
            Showing what was paid and your contracted vendor's rate. Turn on{' '}
            <strong className="font-medium text-ink-2">competing vendor pricing</strong> to re-price
            this exact basket against the other vendors in your market.
          </>
        )}
      </p>

      <SpendTrendCard
        buckets={trend}
        compareEnabled={compareEnabled}
        qualifiedVendorName={qualified?.vendor.displayName ?? null}
      />
    </div>
  );
}
