import { moneyLabel } from '../../lib/catalog';
import type { BasketLine, BasketTotals, VendorColumn } from '../../lib/costLedger';
import { TableWrap } from '../ui/TableWrap';
import { VendorPriceRow } from './VendorPriceRow';

const HEAD = 'px-3 py-2.5 text-right text-[11px] uppercase tracking-[0.06em] text-ink-3';

export function VendorPriceMatrix({
  lines,
  totals,
  columns,
  compareEnabled,
  openHcpcs,
  onOpenRow,
  periodLabel,
}: {
  lines: BasketLine[];
  totals: BasketTotals;
  columns: VendorColumn[];
  compareEnabled: boolean;
  openHcpcs: string | null;
  onOpenRow: (hcpcs: string) => void;
  periodLabel: string;
}) {
  const visibleColumns = compareEnabled ? columns : columns.filter((c) => c.contracted);

  return (
    <TableWrap>
      <table className="w-full min-w-[760px] border-collapse text-[13px]">
        <caption className="sr-only">
          Unit price by HCPCS code and vendor, with extended totals for {periodLabel}. Vendor columns
          other than the amount paid are a counterfactual re-pricing of the same basket.
        </caption>
        <thead>
          <tr>
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">Code</th>
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">Equipment</th>
            <th className={HEAD}>Units</th>
            <th className={HEAD}>Paid</th>
            {visibleColumns.map((column) => (
              <th
                key={column.vendor.id}
                className={`${HEAD} ${column.contracted ? 'bg-bg-subtle border-x border-ink' : ''}`}
              >
                <div className="text-ink normal-case tracking-normal">{column.vendor.displayName}</div>
                <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-ink-3">
                  {column.contracted ? 'contracted · ' : ''}
                  {column.onTimePct}% on-time
                  {column.qualified ? '' : ' · below floor'}
                </div>
                <div className="text-[10px] font-normal normal-case tracking-normal text-ink-3">
                  serves {column.servedZipCount}/{column.patientZipCount} of your ZIPs
                </div>
              </th>
            ))}
            <th className={HEAD}>Trend</th>
            {compareEnabled ? <th className={HEAD}>Δ if switched</th> : null}
          </tr>
        </thead>

        <tbody>
          {lines.map((line) => (
            <VendorPriceRow
              key={line.hcpcs}
              line={line}
              columns={columns}
              compareEnabled={compareEnabled}
              isOpen={openHcpcs === line.hcpcs}
              onOpen={() => onOpenRow(line.hcpcs)}
            />
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t border-line-strong font-medium">
            <td className="px-3 py-2.5" colSpan={3}>
              Basket total · {periodLabel}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">{moneyLabel(totals.actualUsd)}</td>
            {visibleColumns.map((column) => (
              <td
                key={column.vendor.id}
                className={`px-3 py-2.5 text-right tabular-nums ${
                  column.contracted ? 'bg-bg-subtle border-x border-ink' : ''
                }`}
              >
                {totals.perVendorUsd[column.vendor.id] === null
                  ? '—'
                  : moneyLabel(totals.perVendorUsd[column.vendor.id] ?? 0)}
              </td>
            ))}
            <td />
            {compareEnabled ? (
              <td className="px-3 py-2.5 text-right tabular-nums">
                {totals.qualifiedDeltaUsd === null
                  ? '—'
                  : totals.qualifiedDeltaUsd > 0
                    ? `↓ ${moneyLabel(totals.qualifiedDeltaUsd)}`
                    : `+${moneyLabel(Math.abs(totals.qualifiedDeltaUsd))}`}
              </td>
            ) : null}
          </tr>
        </tfoot>
      </table>
    </TableWrap>
  );
}
