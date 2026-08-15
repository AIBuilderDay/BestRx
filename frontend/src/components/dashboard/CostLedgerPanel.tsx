import { moneyCents, moneyLabel } from '../../lib/catalog';
import type { AccountTotals } from '../../lib/budgetLedger';
import type { BasketLine, BasketTotals, TrendBucket, VendorColumn } from '../../lib/costLedger';
import { ledgerPpd, SERVICE_FLOOR_PCT } from '../../lib/costLedger';
import type { CostPeriod } from '../../lib/costPeriod';
import { CodeDrawer } from './CodeDrawer';
import { LedgerControls } from './LedgerControls';
import { SpendTrendCard } from './SpendTrendCard';
import { StatTiles, type StatTileVM } from './StatTiles';
import { VendorPriceMatrix } from './VendorPriceMatrix';

export function CostLedgerPanel({
  hospiceId,
  period,
  lines,
  totals,
  columns,
  trend,
  budgetTotals,
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

  const tiles: StatTileVM[] = [
    {
      key: 'spend',
      label: 'Total DME spend',
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
    },
    {
      key: 'budget',
      label: 'Budget utilization',
      value: budgetTotals.utilizationPct === null ? '—' : `${budgetTotals.utilizationPct}%`,
      detail: `of ${moneyLabel(budgetTotals.capUsd)} across ${
        budgetTotals.assignedPatients
      } assigned patients`,
      tone: (budgetTotals.utilizationPct ?? 0) >= 90 ? 'alert' : 'plain',
    },
  ];

  return (
    <div className="mt-5">
      <StatTiles tiles={tiles} />

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
