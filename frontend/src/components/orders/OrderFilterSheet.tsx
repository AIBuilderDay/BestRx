import { useState } from 'react';
import type { OrderFilterState } from '../../lib/orders';
import { FilterSheet as SheetFrame } from '../ui/FilterSheet';
import type { CategoryOption } from '../catalog/CatalogFilters';
import { OrderFilterControls, type PatientFilterOption } from './OrderFilters';

/**
 * Mobile order filter sheet. Wraps the shared sheet frame; adds a search box that narrows the
 * category + patient lists and reuses the exact desktop <OrderFilterControls>.
 */
export function OrderFilterSheet({
  open,
  filters,
  categories,
  patients,
  resultCount,
  onChange,
  onReset,
  onClose,
}: {
  open: boolean;
  filters: OrderFilterState;
  categories: CategoryOption[];
  patients: PatientFilterOption[];
  resultCount: number;
  onChange: (patch: Partial<OrderFilterState>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shownCategories = q ? categories.filter((c) => c.label.toLowerCase().includes(q)) : categories;
  const shownPatients = q ? patients.filter((p) => p.name.toLowerCase().includes(q)) : patients;

  return (
    <SheetFrame open={open} resultCount={resultCount} onClose={onClose}>
      <input
        type="search"
        placeholder="Search categories or patients"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full border border-line bg-bg px-3 py-2.5 text-[13px] text-ink focus:border-ink focus:outline-none"
      />
      <OrderFilterControls
        filters={filters}
        categories={shownCategories}
        patients={shownPatients}
        onChange={onChange}
        onReset={onReset}
      />
    </SheetFrame>
  );
}
