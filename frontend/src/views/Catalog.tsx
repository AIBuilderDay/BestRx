import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { patients, vendors } from '../data/db';
import { can } from '../lib/auth';
import { createSessionReview } from '../lib/reviews';
import type { ProductReview } from '../types/domain';
import {
  buildCatalogItems,
  catalogFilterOptions,
  defaultCatalogFilters,
  filterAndSortCatalog,
  RESET_CATALOG_FILTERS_STATE,
  paginateCatalog,
  searchCatalog,
  patientFullName,
  priceCeiling,
  totalUnitsInCart,
  upsertCartLine,
  type CatalogFilterState,
  type SortKey,
} from '../lib/catalog';
import type { User } from '../types/domain';
import { TopNav } from '../components/layout/TopNav';
import { CatalogFilters } from '../components/catalog/CatalogFilters';
import { ProductCard } from '../components/catalog/ProductCard';
import { CatalogPagination } from '../components/catalog/CatalogPagination';
import { PatientAssignSheet } from '../components/catalog/PatientAssignSheet';
import { EquipmentDetailView } from '../components/catalog/EquipmentDetailView';
import { useCart } from '../context/CartContext';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'price', label: 'Price' },
  { key: 'speed', label: 'Fastest' },
];

export default function Catalog({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { offerId } = useParams<{ offerId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const assignablePatients = useMemo(
    () => patients().filter((p) => p.hospiceId === user.orgId && p.status !== 'deceased'),
    [user.orgId],
  );
  const [sessionReviews, setSessionReviews] = useState<ProductReview[]>([]);
  const catalogItems = useMemo(() => buildCatalogItems(sessionReviews), [sessionReviews]);
  const priceMax = useMemo(() => priceCeiling(catalogItems), [catalogItems]);

  const [filters, setFilters] = useState<CatalogFilterState>(() => defaultCatalogFilters(priceMax));
  const [currentPage, setCurrentPage] = useState(1);
  const { lines, setLines, setCartOpen, say } = useCart();
  const [sheetOfferId, setSheetOfferId] = useState<string | null>(null);

  const resetFiltersToDefault = () => {
    setFilters(defaultCatalogFilters(priceMax));
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    if (!location.state || !('resetCatalogFilters' in location.state)) return;
    resetFiltersToDefault();
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate, priceMax]);

  const exitDetail = () => {
    if (offerId) navigate('/catalog');
  };

  const openCartSheet = (id: string) => {
    setSheetOfferId(id);
    setCartOpen(false);
  };

  const sheetProduct = catalogItems.find((it) => it.offer.id === sheetOfferId) ?? null;
  const detailProduct = offerId ? (catalogItems.find((it) => it.offer.id === offerId) ?? null) : null;

  const addReview = (rating: number, comment: string) => {
    if (!offerId) return;
    setSessionReviews((prev) => [...prev, createSessionReview(offerId, user.id, rating, comment)]);
    say('Review submitted — thank you');
  };

  const confirmSheet = (selectedPatientIds: string[], qty: number) => {
    if (!sheetProduct) return;
    if (selectedPatientIds.length === 0) {
      say('Pick at least one patient for this equipment');
      return;
    }

    setLines((prev) =>
      selectedPatientIds.reduce((acc, pid) => upsertCartLine(acc, sheetProduct.offer.id, pid, qty), prev),
    );
    const names =
      selectedPatientIds.length === 1
        ? (patients().find((p) => p.id === selectedPatientIds[0]) &&
            patientFullName(patients().find((p) => p.id === selectedPatientIds[0])!)) ||
          selectedPatientIds[0]
        : `${selectedPatientIds.length} patients()`;
    say(`${sheetProduct.offer.productName} ${qty} added for ${names}`);
    setSheetOfferId(null);
  };

  const applyFilters = (patch: Partial<CatalogFilterState>) => {
    exitDetail();
    setFilters((f) => ({ ...f, ...patch }));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    exitDetail();
    resetFiltersToDefault();
    say('Filters cleared');
  };

  const filteredSorted = filterAndSortCatalog(searchCatalog(catalogItems, searchQuery), filters);
  const catalogPage = paginateCatalog(filteredSorted, currentPage);

  const filterOptions = useMemo(
    () => catalogFilterOptions(catalogItems, filters, vendors()),
    [catalogItems, filters],
  );

  if (!can(user, 'storefront:purchase')) {
    return <Navigate to="/patients()" replace />;
  }

  return (
    <div className="min-h-screen bg-bg">
      <TopNav
        user={user}
        cartCount={totalUnitsInCart(lines)}
        activeSection="catalog"
        onOpenCart={() => setCartOpen(true)}
        onSignOut={onSignOut}
      />

      <div className="grid grid-cols-[224px_minmax(0,1fr)] items-start">
        <CatalogFilters
          filters={filters}
          categories={filterOptions.categories}
          vendors={filterOptions.vendors}
          priceMax={priceMax}
          onChange={applyFilters}
          onReset={resetFilters}
        />

        <main className="min-w-0 px-10 pb-20 pt-8.5">
          {offerId ? (
            detailProduct ? (
              <EquipmentDetailView
                product={detailProduct}
                user={user}
                sessionReviews={sessionReviews}
                onAddReview={addReview}
                onAddToCart={() => openCartSheet(detailProduct.offer.id)}
              />
            ) : (
              <>
                <p className="text-[13px] text-ink-3">This listing could not be found.</p>
                <Link
                  to="/catalog"
                  state={RESET_CATALOG_FILTERS_STATE}
                  className="mt-4 inline-block text-[13px] underline underline-offset-2"
                >
                  Back to catalog
                </Link>
              </>
            )
          ) : (
            <>
              <div className="mb-7.5 flex flex-wrap items-end justify-between gap-5">
                <div>
                  <h1 className="text-3xl font-normal tracking-tight">Equipment</h1>
                  {searchQuery ? (
                    <div className="mt-1.5 text-[13px] text-ink-2">
                      {filteredSorted.length} result{filteredSorted.length === 1 ? '' : 's'} for
                      {' '}&ldquo;{searchQuery}&rdquo;{' '}
                      <Link to="/catalog" className="underline underline-offset-2 hover:text-ink">
                        Clear
                      </Link>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {SORTS.map((s) => (
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

              {filteredSorted.length === 0 ? (
                <div className="py-15 text-center text-[13px] text-ink-3">{searchQuery ? <>No equipment matches &ldquo;{searchQuery}&rdquo;.</> : 'No equipment matches these filters.'}</div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-x-6.5 gap-y-10">
                  {catalogPage.items.map((item, i) => (
                    <div
                      key={item.offer.id}
                      className="h-full min-w-0 animate-[cardIn_0.55s_cubic-bezier(0.2,0.7,0.2,1)_both]"
                      style={{ animationDelay: `${i * 0.045}s` }}
                    >
                      <ProductCard item={item} onOrderNow={() => openCartSheet(item.offer.id)} />
                    </div>
                  ))}
                </div>
              )}

              {filteredSorted.length > 0 ? (
                <CatalogPagination
                  page={catalogPage.page}
                  totalPages={catalogPage.totalPages}
                  firstItem={catalogPage.firstItem}
                  lastItem={catalogPage.lastItem}
                  totalItems={filteredSorted.length}
                  onPageChange={(page) => {
                    exitDetail();
                    setCurrentPage(page);
                  }}
                />
              ) : null}
            </>
          )}
        </main>
      </div>

      <PatientAssignSheet
        product={sheetProduct}
        patients={assignablePatients}
        onClose={() => setSheetOfferId(null)}
        onConfirm={confirmSheet}
      />

    </div>
  );
}
