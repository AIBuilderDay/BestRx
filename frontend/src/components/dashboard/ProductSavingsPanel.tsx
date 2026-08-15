import { moneyLabel } from '../../lib/catalog';
import {
  countGenuineSavings,
  totalPotentialSavingsUsd,
  type ProductSavingsRow as ProductSavingsRowData,
} from '../../lib/vendorSavings';
import { ProductSavingsRow } from './ProductSavingsRow';

/** Per-product vendor recommendations for the Potential Savings tile. Sorted biggest opportunity first. */
export function ProductSavingsPanel({ rows }: { rows: ProductSavingsRowData[] }) {
  const total = totalPotentialSavingsUsd(rows);
  const genuineCount = countGenuineSavings(rows);

  return (
    <section className="mt-4 rounded-card border border-ink bg-surface p-4">
      <h2 className="text-[15px] text-ink">Potential savings by product</h2>
      <p className="mt-1 max-w-[80ch] text-[13px] text-ink-2">
        For every product ordered this period, the non-contracted vendor that best balances price,
        reviews, and on-time delivery — not always the cheapest. Service-area coverage is shown on
        each option for context but isn't part of this ranking; check it before switching.
        {total > 0
          ? ` ${moneyLabel(total)} identified across ${genuineCount} of ${rows.length} products.`
          : ' No product this period has a cheaper, real alternative once quality is weighed in.'}
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-3">No products ordered this period.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <ProductSavingsRow key={row.hcpcs} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}
