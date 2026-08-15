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
} from '../lib/orders';
import type { User } from '../types/domain';
import { TopNav } from '../components/layout/TopNav';
import { OrderFilters } from '../components/orders/OrderFilters';
import { OrderSortMenu } from '../components/orders/OrderSortMenu';
import { OrderListSection } from '../components/orders/OrderListSection';
import { OrderReceiptDialog } from '../components/orders/OrderReceiptDialog';
import { CatalogPagination } from '../components/catalog/CatalogPagination';
import { useCart } from '../context/CartContext';

export default function Orders({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { cartCount, setCartOpen } = useCart();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const [filters, setFilters] = useState<OrderFilterState>(defaultOrderFilters);
  const [currentPage, setCurrentPage] = useState(1);
  const [receiptItem, setReceiptItem] = useState<OrderListItemVM | null>(null);

  const allItems = useMemo(
    () => getVisibleOrders(user).map(buildOrderListItemVM),
    [user],
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

      <div className="grid grid-cols-[224px_minmax(0,1fr)] items-start">
        <OrderFilters
          filters={effectiveFilters}
          categories={filterOptions.categories}
          patients={filterOptions.patients}
          onChange={applyFilters}
          onReset={resetFilters}
        />

        <main className="min-w-0 px-10 pb-20 pt-8.5">
          <div className="mb-7.5 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1 className="text-3xl font-normal tracking-tight">Orders</h1>
              <p className="mt-1 text-[13px] text-ink-2">{ordersSubtitle(allItems)}</p>
            </div>
            <OrderSortMenu sort={filters.sort} onChange={(sort) => applyFilters({ sort })} />
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

      <OrderReceiptDialog item={receiptItem} onClose={() => setReceiptItem(null)} />
    </div>
  );
}
