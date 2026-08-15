import type { ReactNode } from 'react';
import { moneyLabel, type CatalogFilterState, type CategoryOption, type SpeedFilter, type VendorFilterOption } from '../../lib/catalog';

export type { CategoryOption } from '../../lib/catalog';

const SPEED_OPTIONS: { key: SpeedFilter; label: string }[] = [
  { key: 'any', label: 'Any lead time' },
  { key: '1', label: 'Next day' },
  { key: '3', label: 'Within 3 days' },
  { key: '7', label: 'Within a week' },
];

type CatalogFiltersProps = {
  filters: CatalogFilterState;
  categories: CategoryOption[];
  vendors: VendorFilterOption[];
  priceMax: number;
  onChange: (patch: Partial<CatalogFilterState>) => void;
  onReset: () => void;
};

/** Desktop sticky sidebar. Hidden below lg, where the same controls open in a mobile sheet. */
export function CatalogFilters(props: CatalogFiltersProps) {
  return (
    <aside className="sticky top-[57px] hidden min-h-[calc(100vh-57px)] border-r border-line px-5.5 py-7.5 pb-15 lg:block">
      <CatalogFilterControls {...props} />
    </aside>
  );
}

/** The filter controls themselves, layout-agnostic so the desktop sidebar and the mobile
 *  filter sheet render exactly the same thing. */
export function CatalogFilterControls({
  filters,
  categories,
  vendors,
  priceMax,
  onChange,
  onReset,
}: CatalogFiltersProps) {
  const toggleVendor = (id: string) => {
    const on = filters.vendorIds.includes(id);
    onChange({ vendorIds: on ? filters.vendorIds.filter((v) => v !== id) : [...filters.vendorIds, id] });
  };

  return (
    <>
      <FilterGroup label="Category" first>
        <div className="grid gap-0.5">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange({ category: c.key })}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-hover hover:text-ink ${
                filters.category === c.key ? 'bg-hover text-ink' : c.count === 0 ? 'text-ink-3' : 'text-ink-2'
              }`}
            >
              <span className="min-w-0 truncate">{c.label}</span>
              <span className="flex-none pl-2 font-mono text-xs tabular-nums text-ink-3">{c.count}</span>
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
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-hover"
              >
                <span
                  className={`grid h-3 w-3 flex-none place-items-center rounded-[3px] border transition-colors ${
                    on ? 'border-solid-bg bg-solid-bg' : 'border-line-strong'
                  }`}
                >
                  <span className={`text-[8px] leading-none text-solid-ink ${on ? 'scale-100' : 'scale-0'} transition-transform`}>
                    ✓
                  </span>
                </span>
                <span
                  title={v.displayName}
                  className={`min-w-0 flex-1 truncate ${on ? 'text-ink' : v.count === 0 ? 'text-ink-3' : 'text-ink-2'}`}
                >
                  {v.displayName}
                </span>
                <span className="flex-none font-mono text-xs tabular-nums text-ink-3">{v.count}</span>
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
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-hover"
              >
                <span
                  className={`grid h-3 w-3 flex-none place-items-center rounded-full border transition-colors ${
                    on ? 'border-ink' : 'border-line-strong'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full bg-ink ${on ? 'scale-100' : 'scale-0'} transition-transform`} />
                </span>
                <span className={on ? 'text-ink' : 'text-ink-2'}>{s.label}</span>
              </button>
            );
          })}
        </div>
      </FilterGroup>

      <div className="mb-3 mt-6.5 flex items-center gap-2 border-b border-line pb-2">
        <span className="text-[11px] uppercase tracking-[0.1em] text-ink-2">Max price</span>
        <span className="ml-auto font-mono text-xs tabular-nums">{moneyLabel(filters.maxPrice)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={priceMax}
        step={5}
        value={filters.maxPrice}
        onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
        className="w-full accent-ink"
      />

      <button
        type="button"
        onClick={onReset}
        className="mt-7.5 w-full rounded-lg border border-line-strong bg-surface py-2.5 text-xs text-ink transition-colors hover:border-ink hover:bg-solid-bg hover:text-solid-ink"
      >
        Clear all
      </button>
    </>
  );
}

function FilterGroup({ label, children, first }: { label: string; children: ReactNode; first?: boolean }) {
  return (
    <div className={first ? undefined : 'mt-6.5'}>
      <div className="mb-2.5 border-b border-line pb-2 text-[11px] uppercase tracking-[0.1em] text-ink-2">
        {label}
      </div>
      {children}
    </div>
  );
}
