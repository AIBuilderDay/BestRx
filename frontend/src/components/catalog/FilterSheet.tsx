import { useState } from 'react';
import type { CatalogFilterState, VendorFilterOption } from '../../lib/catalog';
import { FilterSheet as SheetFrame } from '../ui/FilterSheet';
import { CatalogFilterControls, type CategoryOption } from './CatalogFilters';

/**
 * Mobile catalog filter sheet. Wraps the shared sheet frame; adds a search box that narrows the
 * (long) category + vendor lists and reuses the exact desktop <CatalogFilterControls>.
 */
export function FilterSheet({
  open,
  filters,
  categories,
  vendors,
  priceMax,
  resultCount,
  onChange,
  onReset,
  onClose,
}: {
  open: boolean;
  filters: CatalogFilterState;
  categories: CategoryOption[];
  vendors: VendorFilterOption[];
  priceMax: number;
  resultCount: number;
  onChange: (patch: Partial<CatalogFilterState>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shownCategories = q ? categories.filter((c) => c.label.toLowerCase().includes(q)) : categories;
  const shownVendors = q ? vendors.filter((v) => v.displayName.toLowerCase().includes(q)) : vendors;

  return (
    <SheetFrame open={open} resultCount={resultCount} onClose={onClose}>
      <input
        type="search"
        placeholder="Search categories or vendors"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 w-full border border-line bg-bg px-3 py-2.5 text-[13px] text-ink focus:border-ink focus:outline-none"
      />
      <CatalogFilterControls
        filters={filters}
        categories={shownCategories}
        vendors={shownVendors}
        priceMax={priceMax}
        onChange={onChange}
        onReset={onReset}
      />
    </SheetFrame>
  );
}
