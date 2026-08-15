import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getPatient, patients, vendors } from '../data/db';
import { can, isFamilyMember } from '../lib/auth';
import { createSessionReview } from '../lib/reviews';
import type { ProductReview } from '../types/domain';
import {
  activeFilterCount,
  buildCartGroups,
  buildCatalogItems,
  cartTotals,
  catalogFilterOptions,
  defaultCatalogFilters,
  filterAndSortCatalog,
  resolveCatalogFilters,
  RESET_CATALOG_FILTERS_STATE,
  paginateCatalog,
  searchCatalog,
  patientFullName,
  priceCeiling,
  setCartLineQty,
  totalUnitsInCart,
  upsertCartLine,
  type CatalogFilterState,
  type SortKey,
} from '../lib/catalog';
import type { User } from '../types/domain';
import { TopNav } from '../components/layout/TopNav';
import { CatalogFilters } from '../components/catalog/CatalogFilters';
import { MobileListToolbar } from '../components/ui/MobileListToolbar';
import { SortSheet } from '../components/ui/SortSheet';
import { FilterSheet } from '../components/catalog/FilterSheet';
import { ProductCard } from '../components/catalog/ProductCard';
import { CatalogPagination } from '../components/catalog/CatalogPagination';
import { PatientAssignSheet } from '../components/catalog/PatientAssignSheet';
import { FamilyPurchaseSheet } from '../components/catalog/FamilyPurchaseSheet';
import { EquipmentDetailView } from '../components/catalog/EquipmentDetailView';
import { CartDrawer } from '../components/catalog/CartDrawer';
import { Toast } from '../components/ui/Toast';
import { useCart } from '../context/CartContext';
import { useAiRerank } from '../hooks/useAiRerank';

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'featured', label: 'Featured', hint: 'Our recommended order' },
  { key: 'price', label: 'Price', hint: 'Lowest cost first' },
  { key: 'speed', label: 'Fastest', hint: 'Shortest delivery lead time' },
];

export default function Catalog({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { offerId } = useParams<{ offerId?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const aiMode = searchParams.get('ai') === '1';
  const isFamily = isFamilyMember(user);
  // A family member only ever orders for their own loved one; staff order across their hospice.
  const familyPatient = isFamily ? getPatient(user.patientId) : undefined;
  const assignablePatients = useMemo(
    () =>
      isFamily
        ? familyPatient
          ? [familyPatient]
          : []
        : patients.filter((p) => p.hospiceId === user.orgId && p.status !== 'deceased'),
    [isFamily, familyPatient, user.orgId],
  );
  const [sessionReviews, setSessionReviews] = useState<ProductReview[]>([]);
  const catalogItems = useMemo(() => buildCatalogItems(sessionReviews), [sessionReviews]);
  const priceMax = useMemo(() => priceCeiling(catalogItems), [catalogItems]);

  const [filters, setFilters] = useState<CatalogFilterState>(() => defaultCatalogFilters(priceMax));
  const [currentPage, setCurrentPage] = useState(1);
  const { lines, setLines, cartOpen, setCartOpen, clearCart, agentAdded, setAgentAdded } = useCart();
  const [sheetOfferId, setSheetOfferId] = useState<string | null>(null);
  const [sortSheetOpen, setSortSheetOpen] = useState(false); // mobile sort picker
  const [filterSheetOpen, setFilterSheetOpen] = useState(false); // mobile filter sheet
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = (message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

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
        ? (patients.find((p) => p.id === selectedPatientIds[0]) &&
            patientFullName(patients.find((p) => p.id === selectedPatientIds[0])!)) ||
          selectedPatientIds[0]
        : `${selectedPatientIds.length} patients`;
    say(`${sheetProduct.offer.productName} ${qty} added for ${names}`);
    setSheetOfferId(null);
  };

  const familyAddToCart = (qty: number) => {
    if (!sheetProduct || !familyPatient) return;
    setLines((prev) => upsertCartLine(prev, sheetProduct.offer.id, familyPatient.id, qty));
    say(`${sheetProduct.offer.productName} added to your cart`);
    setSheetOfferId(null);
  };

  const placeOrder = () => {
    if (lines.length === 0) {
      say('Cart is empty');
      return;
    }
    const patientCount = new Set(lines.map((l) => l.patientId)).size;
    const lineCount = lines.length;
    clearCart();
    setCartOpen(false);
    say(`Order placed — ${lineCount} line${lineCount > 1 ? 's' : ''} across ${patientCount} patient${patientCount > 1 ? 's' : ''}`);
  };

  const applyFilters = (patch: Partial<CatalogFilterState>) => {
    exitDetail();
    setFilters((f) => resolveCatalogFilters(catalogItems, f, patch));
    setCurrentPage(1);
  };

  const resetFilters = () => {
    exitDetail();
    resetFiltersToDefault();
    say('Filters cleared');
  };

  // AI search: the model re-orders the (filter-respecting) catalog around the query and,
  // when the query names one patient, their sanitized context. Deterministic results render
  // immediately; the AI order is applied when it lands. Any failure = plain keyword search.
  const aiRerank = useAiRerank(aiMode && !!searchQuery, searchQuery, catalogItems, assignablePatients);
  const aiFailed = aiMode && !!searchQuery && aiRerank.failed;
  const aiActive = aiMode && !!searchQuery && !aiRerank.failed;
  let filteredSorted: typeof catalogItems;
  if (aiActive) {
    const base = filterAndSortCatalog(catalogItems, filters);
    if (aiRerank.result) {
      const position = new Map(aiRerank.result.orderedOfferIds.map((id, i) => [id, i]));
      filteredSorted = base
        .slice()
        .sort((a, b) => (position.get(a.offer.id) ?? 999) - (position.get(b.offer.id) ?? 999));
    } else {
      filteredSorted = base;
    }
  } else if (aiFailed) {
    // AI mode couldn't rank (no API key, or the call failed). The query is natural language, so
    // keyword-matching it would show zero products — fall back to the full catalog instead.
    filteredSorted = filterAndSortCatalog(catalogItems, filters);
  } else {
    filteredSorted = filterAndSortCatalog(searchCatalog(catalogItems, searchQuery), filters);
  }
  const aiReasons = aiActive && aiRerank.result ? aiRerank.result.reasons : {};
  const catalogPage = paginateCatalog(filteredSorted, currentPage);
  const cartGroups = buildCartGroups(lines, catalogItems, patients);
  const totals = cartTotals(lines, catalogItems);

  const filterOptions = useMemo(
    () => catalogFilterOptions(catalogItems, filters, vendors),
    [catalogItems, filters],
  );

  if (!can(user, 'storefront:purchase') && !isFamily) {
    return <Navigate to="/patients" replace />;
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

      <div className="grid grid-cols-1 items-start lg:grid-cols-[224px_minmax(0,1fr)]">
        <CatalogFilters
          filters={filters}
          categories={filterOptions.categories}
          vendors={filterOptions.vendors}
          priceMax={priceMax}
          onChange={applyFilters}
          onReset={resetFilters}
        />

        <main className="min-w-0 px-4 pb-16 pt-5 sm:px-6 lg:px-10 lg:pb-20 lg:pt-8.5">
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
              {/* Mobile: result count + Sort/Filters triggers. Replaces the desktop heading +
                  sidebar + sort chips, which are hidden below lg. */}
              <MobileListToolbar
                resultText={
                  searchQuery && !aiFailed
                    ? `${filteredSorted.length} result${filteredSorted.length === 1 ? '' : 's'}`
                    : `${filteredSorted.length} item${filteredSorted.length === 1 ? '' : 's'}`
                }
                filterCount={activeFilterCount(filters, priceMax)}
                onOpenSort={() => setSortSheetOpen(true)}
                onOpenFilters={() => setFilterSheetOpen(true)}
              />
              {aiMode && searchQuery ? (
                <div className="mb-5 flex items-center gap-1.5 text-[12px] lg:hidden">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-ai-ink">
                    <path d="M12 4l1.7 4.7L18.5 10l-4.8 1.6L12 16.5l-1.7-4.9L5.5 10l4.8-1.3L12 4Z" />
                  </svg>
                  {aiRerank.busy ? (
                    <span className="ai-status">Ranking for this search…</span>
                  ) : aiRerank.failed ? (
                    <span className="text-ink-3">AI unavailable — showing all equipment</span>
                  ) : (
                    <span className="text-ai-ink">AI-ranked, best match first</span>
                  )}
                </div>
              ) : null}

              <div className="mb-7.5 hidden flex-wrap items-end justify-between gap-5 lg:flex">
                <div>
                  <h1 className="text-3xl font-normal tracking-tight">Equipment</h1>
                  {searchQuery && !aiFailed ? (
                    <div className="mt-1.5 text-[13px] text-ink-2">
                      {filteredSorted.length} result{filteredSorted.length === 1 ? '' : 's'} for
                      {' '}&ldquo;{searchQuery}&rdquo;{' '}
                      <Link to="/catalog" className="underline underline-offset-2 hover:text-ink">
                        Clear
                      </Link>
                    </div>
                  ) : null}
                  {aiMode && searchQuery ? (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[12px]" data-testid="ai-rank-status">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="text-ai-ink">
                        <path d="M12 4l1.7 4.7L18.5 10l-4.8 1.6L12 16.5l-1.7-4.9L5.5 10l4.8-1.3L12 4Z" />
                      </svg>
                      {aiRerank.busy ? (
                        <span className="ai-status">Ranking for this search…</span>
                      ) : aiRerank.failed ? (
                        <span className="text-ink-3">AI unavailable — showing all equipment</span>
                      ) : (
                        <span className="text-ai-ink">
                          AI-ranked, best match first
                          {aiRerank.patientLabel ? ` · considered ${aiRerank.patientLabel}` : ''}
                        </span>
                      )}
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
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fill,minmax(236px,1fr))] lg:gap-x-6.5 lg:gap-y-10">
                  {catalogPage.items.map((item, i) => (
                    <div
                      key={item.offer.id}
                      className="h-full min-w-0 animate-card-in motion-reduce:animate-none"
                      style={{ animationDelay: `${i * 0.045}s` }}
                    >
                      <ProductCard
                        item={item}
                        onOrderNow={() => openCartSheet(item.offer.id)}
                        aiReason={aiReasons[item.offer.id]}
                      />
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

      {isFamily ? (
        <FamilyPurchaseSheet
          product={sheetProduct}
          patientName={familyPatient ? patientFullName(familyPatient) : 'your family member'}
          onClose={() => setSheetOfferId(null)}
          onAddToCart={familyAddToCart}
        />
      ) : (
        <PatientAssignSheet
          product={sheetProduct}
          patients={assignablePatients}
          onClose={() => setSheetOfferId(null)}
          onConfirm={confirmSheet}
        />
      )}

      <SortSheet
        open={sortSheetOpen}
        value={filters.sort}
        options={SORTS}
        onSelect={(sort) => applyFilters({ sort })}
        onClose={() => setSortSheetOpen(false)}
      />

      <FilterSheet
        open={filterSheetOpen}
        filters={filters}
        categories={filterOptions.categories}
        vendors={filterOptions.vendors}
        priceMax={priceMax}
        resultCount={filteredSorted.length}
        onChange={applyFilters}
        onReset={resetFilters}
        onClose={() => setFilterSheetOpen(false)}
      />

      <CartDrawer
        open={cartOpen}
        groups={cartGroups}
        totals={totals}
        onQtyChange={(id, patientId, qty) => setLines((prev) => setCartLineQty(prev, id, patientId, qty))}
        onRemove={(id, patientId) => setLines((prev) => setCartLineQty(prev, id, patientId, 0))}
        onClose={() => {
          setCartOpen(false);
          setAgentAdded(null); // the spotlight is a one-time confirmation, not a permanent badge
        }}
        onViewCart={() => {
          setCartOpen(false);
          navigate('/cart');
        }}
        onPlaceOrder={
          isFamily
            ? () => {
                // Family choose request-vs-buy on the cart page, so send them there, not straight to checkout.
                setCartOpen(false);
                navigate('/cart');
              }
            : placeOrder
        }
        agentAdded={agentAdded}
      />

      <Toast message={toast} />
    </div>
  );
}
