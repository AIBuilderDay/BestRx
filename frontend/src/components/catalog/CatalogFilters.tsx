import type { ReactNode } from 'react';
import type { EquipmentCategory, Vendor } from '../../types/domain';
import { moneyLabel, type CatalogFilterState, type SpeedFilter } from '../../lib/catalog';

const SPEED_OPTIONS: { key: SpeedFilter; label: string }[] = [
  { key: 'any', label: 'Any lead time' },
  { key: '1', label: 'Next day' },
  { key: '3', label: 'Within 3 days' },
  { key: '7', label: 'Within a week' },
];

export interface CategoryOption {
  key: 'All' | EquipmentCategory;
  label: string;
  count: number;
}

export function CatalogFilters({
  filters,
  categories,
  vendors,
  priceMax,
  onChange,
  onReset,
}: {
  filters: CatalogFilterState;
  categories: CategoryOption[];
  vendors: Vendor[];
  priceMax: number;
  onChange: (patch: Partial<CatalogFilterState>) => void;
  onReset: () => void;
}) {
  const toggleVendor = (id: string) => {
    const on = filters.vendorIds.includes(id);
    onChange({ vendorIds: on ? filters.vendorIds.filter((v) => v !== id) : [...filters.vendorIds, id] });
  };

  return (
    <aside className="sticky top-[57px] min-h-[calc(100vh-57px)] border-r border-[var(--color-line)] px-5.5 py-7.5 pb-15">
      <div className="border-b border-[var(--color-ink)] pb-2.5 text-xs uppercase tracking-[0.12em]">
        Filters
      </div>

      <FilterGroup label="Category">
        <div className="grid gap-0.5">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange({ category: c.key })}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-neutral-100 hover:text-[var(--color-ink)] ${
                filters.category === c.key ? 'bg-neutral-100 text-[var(--color-ink)]' : 'text-[var(--color-ink-2)]'
              }`}
            >
              <span>{c.label}</span>
              <span className="font-mono text-xs tabular-nums text-[var(--color-ink-3)]">{c.count}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Vendor">
        <div className="grid gap-0.5">
          {vendors.map((v) => {
            const on = filters.vendorIds.includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => toggleVendor(v.id)}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-neutral-100"
              >
                <span
                  className={`grid h-3 w-3 flex-none place-items-center rounded-[3px] border transition-colors ${
                    on ? 'border-[var(--color-ink)] bg-[var(--color-ink)]' : 'border-[var(--color-line-strong)]'
                  }`}
                >
                  <span className={`text-[8px] leading-none text-white ${on ? 'scale-100' : 'scale-0'} transition-transform`}>
                    ✓
                  </span>
                </span>
                <span className={on ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-2)]'}>
                  {v.name.replace('Sample ', '')}
                </span>
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <FilterGroup label="Delivery">
        <div className="grid gap-0.5">
          {SPEED_OPTIONS.map((s) => {
            const on = filters.speed === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onChange({ speed: s.key })}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-neutral-100"
              >
                <span
                  className={`grid h-3 w-3 flex-none place-items-center rounded-full border transition-colors ${
                    on ? 'border-[var(--color-ink)]' : 'border-[var(--color-line-strong)]'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full bg-[var(--color-ink)] ${on ? 'scale-100' : 'scale-0'} transition-transform`} />
                </span>
                <span className={on ? 'text-[var(--color-ink)]' : 'text-[var(--color-ink-2)]'}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <div className="mb-3 mt-6.5 flex items-center gap-2 border-b border-[var(--color-line)] pb-2">
        <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-2)]">Max price</span>
        <span className="ml-auto font-mono text-xs tabular-nums">{moneyLabel(filters.maxPrice)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={priceMax}
        step={5}
        value={filters.maxPrice}
        onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
        className="w-full accent-[var(--color-ink)]"
      />

      <button
        type="button"
        onClick={onReset}
        className="mt-7.5 w-full rounded-lg border border-[var(--color-line-strong)] bg-white py-2.5 text-xs text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-white"
      >
        Clear all
      </button>
    </aside>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-6.5">
      <div className="mb-2.5 border-b border-[var(--color-line)] pb-2 text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-2)]">
        {label}
      </div>
      {children}
    </div>
  );
}
