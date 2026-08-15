import { useMemo, useState, type ReactNode } from 'react';
import { moneyCents, moneyLabel } from '../../lib/catalog';
import { aiUsageTotals, formatTokenCount } from '../../lib/aiUsage';
import { accountOverageBreakdown, overBudgetProductBreakdown } from '../../lib/budgetBreakdown';
import type { AccountBudgetRow, AccountTotals } from '../../lib/budgetLedger';
import type { BasketLine, BasketTotals, VendorColumn } from '../../lib/costLedger';
import { spendSummaryForRange } from '../../lib/costLedger';
import type { CostPeriod } from '../../lib/costPeriod';
import { getRangeMeta, type TrendRange } from '../../lib/trendRange';
import { buildProductSavings, countGenuineSavings, totalPotentialSavingsUsd } from '../../lib/vendorSavings';
import { AiTokenRangePanel } from './AiTokenRangePanel';
import { BudgetBreakdownPanel } from './BudgetBreakdownPanel';
import { CodeDrawer } from './CodeDrawer';
import { LedgerControls } from './LedgerControls';
import { ProductSavingsPanel } from './ProductSavingsPanel';
import { SpendRangePanel } from './SpendRangePanel';
import { StatTiles, type StatTileVM } from './StatTiles';
import { VendorPriceMatrix } from './VendorPriceMatrix';

const DEFAULT_TREND_RANGE: TrendRange = '1m';

type TileKey = 'spend' | 'ai' | 'delta' | 'budget';

export function CostLedgerPanel({
  hospiceId,
  period,
  lines,
  totals,
  columns,
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
  budgetTotals: AccountTotals;
  accountRows: AccountBudgetRow[];
  openHcpcs: string | null;
  onOpenRow: (hcpcs: string) => void;
  onCloseRow: () => void;
  onAction: (message: string) => void;
}) {
  const openLine = lines.find((l) => l.hcpcs === openHcpcs) ?? null;

  const [selectedMetric, setSelectedMetric] = useState<TileKey | null>('spend');
  const [spendRange, setSpendRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);
  const [aiRange, setAiRange] = useState<TrendRange>(DEFAULT_TREND_RANGE);

  const productSavings = useMemo(() => buildProductSavings(lines, columns), [lines, columns]);
  const totalSavingsUsd = useMemo(() => totalPotentialSavingsUsd(productSavings), [productSavings]);
  const savingsProductCount = useMemo(() => countGenuineSavings(productSavings), [productSavings]);
  const budgetUserIds = useMemo(() => accountRows.map((row) => row.user.id), [accountRows]);
  const aiTotals = useMemo(
    () => aiUsageTotals(hospiceId, period, budgetUserIds),
    [hospiceId, period, budgetUserIds],
  );
  const spendRangeSummary = useMemo(
    () => spendSummaryForRange(hospiceId, period, lines, spendRange),
    [hospiceId, period, lines, spendRange],
  );
  const spendRangeLabel = getRangeMeta(spendRange).label;
  const budgetOverPct =
    budgetTotals.utilizationPct === null ? null : Math.max(0, budgetTotals.utilizationPct - 100);

  const tiles: StatTileVM[] = [
    {
      key: 'spend',
      label: 'Total Spend',
      value: spendRangeSummary === null ? 'No data' : moneyLabel(spendRangeSummary.actualUsd),
      detail:
        spendRangeSummary === null
          ? `${spendRangeLabel} spend unavailable`
          : `${spendRangeLabel} total${spendRangeSummary.partial ? ' · partial' : ''}`,
      tone: 'plain',
    },
    {
      key: 'ai',
      label: 'AI token spend',
      value: moneyCents(aiTotals.costUsd),
      detail: `${formatTokenCount(aiTotals.tokenCount)} tokens · ${aiTotals.requestCount} requests`,
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
      value:
        budgetTotals.utilizationPct === null
          ? '—'
          : `${budgetOverPct}%`,
      detail:
        budgetTotals.utilizationPct === null
          ? 'No DME budget cap to measure'
          : budgetTotals.overageUsd > 0
            ? `${budgetTotals.utilizationPct}% used · ${moneyLabel(budgetTotals.overageUsd)} cutback`
            : `${budgetTotals.utilizationPct}% used · no cutback needed`,
      tone: budgetTotals.overageUsd > 0 ? 'alert' : 'plain',
      chartable: budgetTotals.utilizationPct !== null,
    },
  ];

  const selectMetric = (key: string) => {
    if (!['spend', 'ai', 'delta', 'budget'].includes(key)) return;
    setSelectedMetric((current) => (current === key ? null : (key as TileKey)));
  };

  const productSlices = useMemo(
    () => overBudgetProductBreakdown(hospiceId, period, accountRows),
    [hospiceId, period, accountRows],
  );
  const accountOverageSlices = useMemo(() => accountOverageBreakdown(accountRows), [accountRows]);

  let panel: ReactNode = null;
  if (selectedMetric === 'budget') {
    panel = (
      <BudgetBreakdownPanel
        productSlices={productSlices}
        accountOverageSlices={accountOverageSlices}
        accountRows={accountRows}
        overageUsd={budgetTotals.overageUsd}
        capUsd={budgetTotals.capUsd}
        utilizationPct={budgetTotals.utilizationPct}
      />
    );
  } else if (selectedMetric === 'delta') {
    panel = <ProductSavingsPanel rows={productSavings} />;
  } else if (selectedMetric === 'spend') {
    panel = (
      <SpendRangePanel
        hospiceId={hospiceId}
        period={period}
        lines={lines}
        range={spendRange}
        onRangeChange={setSpendRange}
      />
    );
  } else if (selectedMetric === 'ai') {
    panel = (
      <AiTokenRangePanel
        hospiceId={hospiceId}
        period={period}
        userIds={budgetUserIds}
        range={aiRange}
        onRangeChange={setAiRange}
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
        AI-suggested vendor on every product ordered this period, or select{' '}
        <strong className="font-medium text-ink-2">Total Spend</strong> to see it broken out over
        time.
      </p>
    </div>
  );
}
