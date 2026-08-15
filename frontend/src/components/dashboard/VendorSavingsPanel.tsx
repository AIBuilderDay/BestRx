import { useState } from 'react';
import { sortVendorSavings, type SavingsSortMode, type VendorSavingsOption } from '../../lib/vendorSavings';
import { VendorSavingsRow } from './VendorSavingsRow';

const SORTS: { key: SavingsSortMode; label: string }[] = [
  { key: 'value', label: 'Best value' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
];

/**
 * Cascading vendor list for the Potential Savings tile. Sorting is local to the panel (view-only,
 * doesn't move the tile's headline number, which always names the best-value pick).
 */
export function VendorSavingsPanel({
  options,
  bestValueOption,
}: {
  options: VendorSavingsOption[];
  bestValueOption: VendorSavingsOption | null;
}) {
  const [sort, setSort] = useState<SavingsSortMode>('value');
  const sorted = sortVendorSavings(options, sort);
  const cheapest = sortVendorSavings(options, 'price-asc')[0] ?? null;
  const cheapestIsNotBest =
    cheapest && bestValueOption && cheapest.vendor.id !== bestValueOption.vendor.id;

  return (
    <section className="mt-4 rounded-card border border-ink bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] text-ink">Vendor options, ranked by value</h2>
          <p className="mt-1 max-w-[70ch] text-[13px] text-ink-2">
            Value weighs price against reviews, on-time delivery, and how much of your patient area
            a vendor actually reaches — not price alone.
            {cheapestIsNotBest
              ? ` ${cheapest.vendor.displayName} is cheaper but ranks lower here — see why below.`
              : ''}
          </p>
        </div>

        <div role="tablist" aria-label="Sort vendor options" className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={s.key === sort}
              onClick={() => setSort(s.key)}
              className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                s.key === sort
                  ? 'border-solid-bg bg-solid-bg text-solid-ink'
                  : 'border-line-strong bg-surface text-ink-2 hover:border-ink hover:text-ink'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-3">No other vendor prices this exact basket.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((option) => (
            <VendorSavingsRow
              key={option.vendor.id}
              option={option}
              isBestValue={option.vendor.id === bestValueOption?.vendor.id}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
