import type { ReactNode } from 'react';
import type { OrderFilterState } from '../../lib/orders';
import type { CategoryOption } from '../catalog/CatalogFilters';

export interface PatientFilterOption {
  id: string;
  name: string;
  count: number;
}

export function OrderFilters({
  filters,
  categories,
  patients,
  onChange,
  onReset,
}: {
  filters: OrderFilterState;
  categories: CategoryOption[];
  patients: PatientFilterOption[];
  onChange: (patch: Partial<OrderFilterState>) => void;
  onReset: () => void;
}) {
  const togglePatient = (id: string) => {
    const on = filters.patientIds.includes(id);
    onChange({ patientIds: on ? filters.patientIds.filter((p) => p !== id) : [...filters.patientIds, id] });
  };

  return (
    <aside className="sticky top-[57px] min-h-[calc(100vh-57px)] border-r border-line px-5.5 py-7.5 pb-15">
      <FilterGroup label="Category" first>
        <div className="grid gap-0.5">
          {categories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange({ category: c.key })}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-hover hover:text-ink ${
                filters.category === c.key ? 'bg-hover text-ink' : 'text-ink-2'
              }`}
            >
              <span>{c.label}</span>
              <span className="font-mono text-xs tabular-nums text-ink-3">{c.count}</span>
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Patient">
        <div className="grid gap-0.5">
          {patients.length === 0 ? (
            <p className="px-2 py-1.5 text-[13px] text-ink-3">No patients with orders.</p>
          ) : (
            patients.map((p) => {
              const on = filters.patientIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePatient(p.id)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-hover"
                >
                  <span
                    className={`grid h-3 w-3 flex-none place-items-center rounded-[3px] border transition-colors ${
                      on ? 'border-solid-bg bg-solid-bg' : 'border-line-strong'
                    }`}
                  >
                    <span
                      className={`text-[8px] leading-none text-solid-ink ${on ? 'scale-100' : 'scale-0'} transition-transform`}
                    >
                      ✓
                    </span>
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${on ? 'text-ink' : 'text-ink-2'}`}>{p.name}</span>
                  <span className="font-mono text-xs tabular-nums text-ink-3">{p.count}</span>
                </button>
              );
            })
          )}
        </div>
      </FilterGroup>

      <button
        type="button"
        onClick={onReset}
        className="mt-7.5 w-full rounded-lg border border-line-strong bg-surface py-2.5 text-xs text-ink transition-colors hover:border-ink hover:bg-solid-bg hover:text-solid-ink"
      >
        Clear all
      </button>
    </aside>
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
