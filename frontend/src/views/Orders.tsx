import { useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { can } from '../lib/auth';
import {
  buildOrderListItemVM,
  defaultOrderFilters,
  filterAndSortOrders,
  getVisibleOrders,
  orderFilterOptions,
  resolveOrderFilters,
  ordersSubtitle,
  paginateOrders,
  type OrderFilterState,
  type OrderListItemVM,
  type OrderSortKey,
} from '../lib/orders';
import type { User } from '../types/domain';
import { TopNav } from '../components/layout/TopNav';
import { OrderFilters } from '../components/orders/OrderFilters';
import { OrderFilterSheet } from '../components/orders/OrderFilterSheet';
import { OrderListSection } from '../components/orders/OrderListSection';
import { OrderReceiptDialog } from '../components/orders/OrderReceiptDialog';
import { CatalogPagination } from '../components/catalog/CatalogPagination';
import { MobileListToolbar } from '../components/ui/MobileListToolbar';
import { SortSheet } from '../components/ui/SortSheet';
import { useCart } from '../context/CartContext';
import { useData } from '../context/DataContext';

const ORDER_SORTS: { key: OrderSortKey; label: string; hint: string }[] = [
  { key: 'recent', label: 'Most recent', hint: 'Newest orders first' },
  { key: 'status', label: 'Status', hint: 'Group by order status' },
];

export default function Orders({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { cartCount, setCartOpen } = useCart();
  const { version } = useData(); // bumps when a live status change lands

  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const [filters, setFilters] = useState<OrderFilterState>(defaultOrderFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [receiptItem, setReceiptItem] = useState<OrderListItemVM | null>(null);
  const [sortSheetOpen, setSortSheetOpen] = useState(false); // mobile sort picker
  const [filterSheetOpen, setFilterSheetOpen] = useState(false); // mobile filter sheet

  const allItems = useMemo(
    () => getVisibleOrders(user).map(buildOrderListItemVM),
    [user, version],
  );

  const effectiveFilters = useMemo(
    () => ({ ...filters, query: searchQuery }),
    [filters, searchQuery],
  );

  const filteredSorted = useMemo(
    () => filterAndSortOrders(allItems, effectiveFilters),
    [allItems, effectiveFilters],
  );
  const ordersPage = paginateOrders(filteredSorted, currentPage);
  const filterOptions = useMemo(
    () => orderFilterOptions(allItems, effectiveFilters),
    [allItems, effectiveFilters],
  );

  const applyFilters = (patch: Partial<OrderFilterState>) => {
    setFilters((f) => resolveOrderFilters(allItems, f, patch));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setFilters(defaultOrderFilters());
    setCurrentPage(1);
  };

  const handleCallVendor = (item: OrderListItemVM) => {
    const digits = item.phone.replace(/\D/g, '');
    if (digits) window.location.href = `tel:${digits}`;
  };

  if (!can(user, 'orders:own') && !can(user, 'orders:own-patients') && !can(user, 'orders:all')) {
    return <Navigate to="/catalog" replace />;
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        user={user}
        cartCount={cartCount}
        activeSection="orders"
        onOpenCart={() => setCartOpen(true)}
        onSignOut={onSignOut}
      />

      <div className="grid grid-cols-1 items-start lg:grid-cols-[224px_minmax(0,1fr)]">
        <OrderFilters
          filters={effectiveFilters}
          categories={filterOptions.categories}
          patients={filterOptions.patients}
          dateRanges={filterOptions.dateRanges}
          onChange={applyFilters}
          onReset={resetFilters}
        />

        <main className="min-w-0 px-4 pb-16 pt-5 sm:px-6 lg:px-10 lg:pb-20 lg:pt-8.5">
          {/* Mobile: a clear page title (so this doesn't read as a shopping page) plus the
              result count + Sort/Filters triggers. The desktop heading/sidebar/sort menu are
              hidden below lg. */}
          <h1 className="mb-4 text-2xl font-normal tracking-tight lg:hidden">Orders</h1>
          <MobileListToolbar
            resultText={`${filteredSorted.length} order${filteredSorted.length === 1 ? '' : 's'}`}
            filterCount={(filters.category !== 'All' ? 1 : 0) + filters.patientIds.length}
            onOpenSort={() => setSortSheetOpen(true)}
            onOpenFilters={() => setFilterSheetOpen(true)}
          />

          <div className="mb-7.5 hidden lg:block">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <h1 className="text-3xl font-normal tracking-tight">Orders</h1>
              <div className="flex flex-wrap items-center gap-2">
                {ORDER_SORTS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => applyFilters({ sort: s.key })}
                    className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors hover:border-ink ${
                      filters.sort === s.key
                        ? 'border-ink bg-solid-bg text-solid-ink'
                        : 'border-line bg-surface text-ink-2'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-[13px] text-ink-2">{ordersSubtitle(allItems)}</p>
          </div>

          <OrderListSection
            items={ordersPage.items}
            onCallVendor={handleCallVendor}
            onDownloadReceipt={setReceiptItem}
          />

          {filteredSorted.length > 0 ? (
            <CatalogPagination
              page={ordersPage.page}
              totalPages={ordersPage.totalPages}
              firstItem={ordersPage.firstItem}
              lastItem={ordersPage.lastItem}
              totalItems={filteredSorted.length}
              onPageChange={setCurrentPage}
              ariaLabel="Order pages"
            />
          ) : null}

          {can(user, 'storefront:purchase') ? (
            <p className="mt-8 text-[13px] text-ink-3">
              Need something new?{' '}
              <Link to="/catalog" className="underline underline-offset-2 hover:text-ink">
                Browse equipment
              </Link>
            </p>
          ) : null}
        </main>
      </div>

      <SortSheet
        open={sortSheetOpen}
        value={filters.sort}
        options={ORDER_SORTS}
        onSelect={(sort) => applyFilters({ sort })}
        onClose={() => setSortSheetOpen(false)}
      />

      <OrderFilterSheet
        open={filterSheetOpen}
        filters={effectiveFilters}
        categories={filterOptions.categories}
        patients={filterOptions.patients}
        dateRanges={filterOptions.dateRanges}
        resultCount={filteredSorted.length}
        onChange={applyFilters}
        onReset={resetFilters}
        onClose={() => setFilterSheetOpen(false)}
      />

      <OrderReceiptDialog item={receiptItem} onClose={() => setReceiptItem(null)} />
    </div>
  );
}
