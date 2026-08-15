import { moneyLabel } from '../../lib/catalog';
import type { BasketLine, BasketTotals, VendorColumn } from '../../lib/costLedger';
import { TableWrap } from '../ui/TableWrap';
import { VendorPriceRow } from './VendorPriceRow';

const HEAD = 'px-3 py-2.5 text-right text-[11px] uppercase tracking-[0.06em] text-ink-3';

/**
 * What was actually paid, next to the contracted vendor's rate for the same code. Comparing
 * against every other vendor now lives in the Potential Savings card, where price sits next to
 * reviews, delivery, and service-area reach instead of standing alone.
 */
export function VendorPriceMatrix({
  lines,
  totals,
  columns,
  openHcpcs,
  onOpenRow,
  periodLabel,
}: {
  lines: BasketLine[];
  totals: BasketTotals;
  columns: VendorColumn[];
  openHcpcs: string | null;
  onOpenRow: (hcpcs: string) => void;
  periodLabel: string;
}) {
  const contracted = columns.find((c) => c.contracted);
  const visibleColumns = contracted ? [contracted] : [];

  return (
    <TableWrap>
      <table className="w-full min-w-[680px] border-collapse text-[13px]">
        <caption className="sr-only">
          Unit price by HCPCS code, with extended totals for {periodLabel}. Click a row for that
          code's vendor options; see Potential Savings above for options across the whole basket.
        </caption>
        <thead>
          <tr>
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">Code</th>
            <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">Equipment</th>
            <th className={HEAD}>Units</th>
            <th className={HEAD}>Paid</th>
            {visibleColumns.map((column) => (
              <th key={column.vendor.id} className={`${HEAD} bg-bg-subtle border-x border-ink`}>
                <div className="text-ink normal-case tracking-normal">{column.vendor.displayName}</div>
                <div className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-ink-3">
                  contracted · {column.onTimePct}% on-time
                  {column.qualified ? '' : ' · below floor'}
                </div>
                <div className="text-[10px] font-normal normal-case tracking-normal text-ink-3">
                  serves {column.servedZipCount}/{column.patientZipCount} of your ZIPs
                </div>
              </th>
            ))}
            <th className={HEAD}>Trend</th>
          </tr>
        </thead>

        <tbody>
          {lines.map((line) => (
            <VendorPriceRow
              key={line.hcpcs}
              line={line}
              columns={columns}
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
                className="px-3 py-2.5 text-right tabular-nums bg-bg-subtle border-x border-ink"
              >
                {totals.perVendorUsd[column.vendor.id] === null
                  ? '—'
                  : moneyLabel(totals.perVendorUsd[column.vendor.id] ?? 0)}
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
    </TableWrap>
  );
}
