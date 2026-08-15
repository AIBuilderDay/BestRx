import { useMemo, useState, type ReactNode } from 'react';
import { moneyCents, moneyLabel } from '../../lib/catalog';
import { accountBreakdown, productBreakdown } from '../../lib/budgetBreakdown';
import type { AccountBudgetRow, AccountTotals } from '../../lib/budgetLedger';
import type { BasketLine, BasketTotals, TrendBucket, VendorColumn } from '../../lib/costLedger';
import { ledgerPpd } from '../../lib/costLedger';
import type { CostPeriod } from '../../lib/costPeriod';
import type { TrendRange } from '../../lib/costTrendMock';
import { buildProductSavings, countGenuineSavings, totalPotentialSavingsUsd } from '../../lib/vendorSavings';
import { BudgetBreakdownPanel } from './BudgetBreakdownPanel';
import { CodeDrawer } from './CodeDrawer';
import { LedgerControls } from './LedgerControls';
import { MetricTrendPanel, type TrendMetricVM } from './MetricTrendPanel';
import { ProductSavingsPanel } from './ProductSavingsPanel';
import { SpendTrendCard } from './SpendTrendCard';
import { StatTiles, type StatTileVM } from './StatTiles';
import { VendorPriceMatrix } from './VendorPriceMatrix';

const DEFAULT_TREND_RANGE: TrendRange = '1m';

/** The four selectable stat tiles. Only spend/ppd open a (placeholder) trend chart. */
type TileKey = 'spend' | 'ppd' | 'delta' | 'budget';

export function CostLedgerPanel({
  hospiceId,
  period,
  lines,
  totals,
  columns,
  trend,
  budgetTotals,
  accountRows,
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
  openHcpcs: string | null;
  onOpenRow: (hcpcs: string) => void;
  onCloseRow: () => void;
  onAction: (message: string) => void;
}) {
  const ppd = ledgerPpd(hospiceId, totals.actualUsd, period);
  const openLine = lines.find((l) => l.hcpcs === openHcpcs) ?? null;

  const [selectedMetric, setSelectedMetric] = useState<TileKey | null>('spend');
  const [trendRange, setTrendRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);

  const productSavings = useMemo(() => buildProductSavings(lines, columns), [lines, columns]);
  const totalSavingsUsd = useMemo(() => totalPotentialSavingsUsd(productSavings), [productSavings]);
  const savingsProductCount = useMemo(() => countGenuineSavings(productSavings), [productSavings]);

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
      label: 'Potential Savings',
      // Never nets a premium on one product against a saving on another — see
      // totalPotentialSavingsUsd. Zero means no product this period beats what was paid, not that
      // nothing was checked.
      value: totalSavingsUsd > 0 ? `↓ ${moneyLabel(totalSavingsUsd)}` : '$0',
      detail:
        totalSavingsUsd > 0
          ? `Across ${savingsProductCount} of ${productSavings.length} products`
          : `No cheaper real alternative across ${productSavings.length} products`,
      tone: totalSavingsUsd > 0 ? 'good' : 'plain',
      chartable: productSavings.length > 0,
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

  const trendMetrics: Record<'spend' | 'ppd', TrendMetricVM> = {
    spend: { key: 'spend', label: 'Total Spend', currentValue: totals.actualUsd, formatValue: moneyLabel },
    ppd: { key: 'ppd', label: 'Cost per patient-day', currentValue: ppd.ppdUsd, formatValue: moneyCents },
  };

  const selectMetric = (key: string) => {
    if (!['spend', 'ppd', 'delta', 'budget'].includes(key)) return;
    setSelectedMetric((current) => (current === key ? null : (key as TileKey)));
  };

  const productSlices = useMemo(() => productBreakdown(lines), [lines]);
  const accountSlices = useMemo(() => accountBreakdown(accountRows), [accountRows]);

  let panel: ReactNode = null;
  if (selectedMetric === 'budget') {
    panel = (
      <BudgetBreakdownPanel
        productSlices={productSlices}
        accountSlices={accountSlices}
        totalUsd={totals.actualUsd}
      />
    );
  } else if (selectedMetric === 'delta') {
    panel = <ProductSavingsPanel rows={productSavings} />;
  } else if (selectedMetric === 'spend' || selectedMetric === 'ppd') {
    panel = (
      <MetricTrendPanel
        metric={trendMetrics[selectedMetric]}
        range={trendRange}
        onRangeChange={setTrendRange}
      />
    );
  }

  return (
    <div className="mt-5">
      <StatTiles tiles={tiles} selectedKey={selectedMetric} onSelect={selectMetric} />

      {panel}

      <div className="mt-4">
        <LedgerControls period={period} />
      </div>

      <div className="mt-3">
        <VendorPriceMatrix
          lines={lines}
          totals={totals}
          columns={columns}
          openHcpcs={openHcpcs}
          onOpenRow={onOpenRow}
          periodLabel={period.label}
        />
      </div>

      {openLine ? (
        <CodeDrawer line={openLine} columns={columns} onClose={onCloseRow} onAction={onAction} />
      ) : null}

      <p className="mt-3 max-w-[92ch] text-[12px] text-ink-3">
        Paid is what this hospice actually spent, each order at the vendor that took it. See{' '}
        <strong className="font-medium text-ink-2">Potential Savings</strong> above for an
        AI-suggested vendor on every product ordered this period.
      </p>

      <SpendTrendCard buckets={trend} />
    </div>
  );
}
