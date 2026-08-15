import { moneyLabel } from '../../lib/catalog';
import type { BasketLine, BasketTotals } from '../../lib/costLedger';
import { TableWrap } from '../ui/TableWrap';
import { VendorPriceRow } from './VendorPriceRow';

const HEAD = 'px-4 py-2.5 text-right text-[11px] uppercase tracking-[0.06em] text-ink-3';

/**
 * What was actually paid for each code. Vendor comparisons live in the Potential Savings card and
 * row drawer, where price sits next to reviews and delivery instead of standing alone.
 */
export function VendorPriceMatrix({
  lines,
  totals,
  openHcpcs,
  onOpenRow,
  periodLabel,
}: {
  lines: BasketLine[];
  totals: BasketTotals;
  openHcpcs: string | null;
  onOpenRow: (hcpcs: string) => void;
  periodLabel: string;
}) {
  return (
    <TableWrap>
      <table className="w-full min-w-[760px] table-fixed border-collapse text-[13px]">
        <caption className="sr-only">
          Paid spend by HCPCS code, with extended totals for {periodLabel}. Click a row for that
          code's vendor options; see Potential Savings above for the AI-suggested vendor per product.
        </caption>
        <colgroup>
          <col className="w-[13%]" />
          <col className="w-[39%]" />
          <col className="w-[10%]" />
          <col className="w-[16%]" />
          <col className="w-[22%]" />
        </colgroup>
        <thead>
          <tr>
            <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">Code</th>
            <th className="px-4 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">Equipment</th>
            <th className={HEAD}>Units</th>
            <th className={HEAD}>Paid</th>
            <th className="px-4 py-2.5 text-center text-[11px] uppercase tracking-[0.06em] text-ink-3">
              Order trend
            </th>
          </tr>
        </thead>

        <tbody>
          {lines.map((line) => (
            <VendorPriceRow
              key={line.hcpcs}
              line={line}
              isOpen={openHcpcs === line.hcpcs}
              onOpen={() => onOpenRow(line.hcpcs)}
            />
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t border-line-strong font-medium">
            <td className="px-4 py-2.5" colSpan={3}>
              Basket total · {periodLabel}
            </td>
            <td className="px-4 py-2.5 text-right tabular-nums">{moneyLabel(totals.actualUsd)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </TableWrap>
  );
}
