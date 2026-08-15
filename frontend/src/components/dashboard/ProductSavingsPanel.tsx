import { moneyLabel } from '../../lib/catalog';
import {
  countGenuineSavings,
  totalPotentialSavingsUsd,
  type ProductSavingsRow as ProductSavingsRowData,
} from '../../lib/vendorSavings';
import { TableWrap } from '../ui/TableWrap';
import { ProductSavingsRow } from './ProductSavingsRow';

const HEAD = 'px-3 py-2.5 text-right text-[11px] uppercase tracking-[0.06em] text-ink-3';

/** Per-product vendor recommendations for the Potential Savings tile. Sorted biggest opportunity first. */
export function ProductSavingsPanel({ rows }: { rows: ProductSavingsRowData[] }) {
  const total = totalPotentialSavingsUsd(rows);
  const genuineCount = countGenuineSavings(rows);

  return (
    <section className="mt-4 rounded-card border border-ink bg-surface p-4">
      <h2 className="text-[15px] text-ink">Potential savings by product</h2>
      <p className="mt-1 max-w-[80ch] text-[13px] text-ink-2">
        For every product ordered this period, the non-contracted vendor that best balances savings,
        vendor rating, and local service fit — not always the cheapest.
        {total > 0
          ? ` ${moneyLabel(total)} identified across ${genuineCount} of ${rows.length} products.`
          : ' No product this period has a cheaper, real alternative once quality is weighed in.'}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-3">No products ordered this period.</p>
      ) : (
        <TableWrap>
          <table className="mt-3 w-full min-w-[720px] border-collapse text-[13px]">
            <caption className="sr-only">
              Suggested vendor per product ordered this period, with rating, unit price, and total
              savings versus what was paid.
            </caption>
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                  Product
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] uppercase tracking-[0.06em] text-ink-3">
                  Suggested vendor
                </th>
                <th className={HEAD}>Vendor rating</th>
                <th className={HEAD}>Unit price</th>
                <th className={HEAD}>Savings</th>
                <th className={HEAD}>Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ProductSavingsRow key={row.hcpcs} row={row} />
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </section>
  );
}
