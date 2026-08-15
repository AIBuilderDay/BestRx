import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getPatient, patients, vendors } from '../data/db';
import { can, isFamilyMember } from '../lib/auth';
import { createSessionReview } from '../lib/reviews';
import type { ProductReview } from '../types/domain';
import {
  activeFilterCount,
  buildCatalogItems,
  catalogFilterOptions,
  defaultCatalogFilters,
  filterAndSortCatalog,
  RESET_CATALOG_FILTERS_STATE,
  paginateCatalog,
  searchCatalog,
  patientFullName,
  priceCeiling,
  rescaleMaxPrice,
  totalUnitsInCart,
  upsertCartLine,
  UNIT_FOR_MODE,
  type CatalogFilterState,
  type PriceUnit,
  type PricingMode,
  type SortKey,
} from '../lib/catalog';
import type { User } from '../types/domain';
import { TopNav } from '../components/layout/TopNav';
import { CatalogFilters } from '../components/catalog/CatalogFilters';
import { MobileListToolbar } from '../components/ui/MobileListToolbar';
import { SortSheet } from '../components/ui/SortSheet';
import { FilterSheet } from '../components/catalog/FilterSheet';
import { ProductCard } from '../components/catalog/ProductCard';
import { PricingModeToggle } from '../components/catalog/PricingModeToggle';
import { CatalogPagination } from '../components/catalog/CatalogPagination';
import { PatientAssignSheet } from '../components/catalog/PatientAssignSheet';
import { FamilyPurchaseSheet } from '../components/catalog/FamilyPurchaseSheet';
import { EquipmentDetailView } from '../components/catalog/EquipmentDetailView';
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
        : patients().filter((p) => p.hospiceId === user.orgId && p.status !== 'deceased'),
    [isFamily, familyPatient, user.orgId],
  );
  const [sessionReviews, setSessionReviews] = useState<ProductReview[]>([]);
  const [mode, setMode] = useState<PricingMode>('rent');
  /** Per-card overrides of the page mode, keyed by offer id. Cleared whenever the page mode moves. */
  const [unitOverrides, setUnitOverrides] = useState<Record<string, PriceUnit>>({});
  const catalogItems = useMemo(() => buildCatalogItems(sessionReviews, mode), [sessionReviews, mode]);
  const priceMax = useMemo(() => priceCeiling(catalogItems), [catalogItems]);

  /** The arrangement a given card is showing: its own override, else the page mode. */
  const unitFor = (id: string): PriceUnit => unitOverrides[id] ?? UNIT_FOR_MODE[mode];

  const [filters, setFilters] = useState<CatalogFilterState>(() => defaultCatalogFilters(priceMax));
  const [currentPage, setCurrentPage] = useState(1);
  const { lines, setLines, setCartOpen, say } = useCart();
  const [sheetOfferId, setSheetOfferId] = useState<string | null>(null);
  const [sortSheetOpen, setSortSheetOpen] = useState(false); // mobile sort picker
  const [filterSheetOpen, setFilterSheetOpen] = useState(false); // mobile filter sheet

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

    const unit = unitFor(sheetProduct.offer.id);
    setLines((prev) =>
      selectedPatientIds.reduce((acc, pid) => upsertCartLine(acc, sheetProduct.offer.id, pid, unit, qty), prev),
    );
    const names =
      selectedPatientIds.length === 1
        ? (patients().find((p) => p.id === selectedPatientIds[0]) &&
            patientFullName(patients().find((p) => p.id === selectedPatientIds[0])!)) ||
          selectedPatientIds[0]
        : `${selectedPatientIds.length} patients`;
    say(`${sheetProduct.offer.productName} ${qty} added for ${names}`);
    setSheetOfferId(null);
  };

  const familyAddToCart = (qty: number) => {
    if (!sheetProduct || !familyPatient) return;
    const unit = unitFor(sheetProduct.offer.id);
    setLines((prev) => upsertCartLine(prev, sheetProduct.offer.id, familyPatient.id, unit, qty));
    say(`${sheetProduct.offer.productName} added to your cart`);
    setSheetOfferId(null);
  };

  /**
   * Switching the page mode rescales the max-price filter, because rental and purchase are
   * different orders of magnitude and a slider left at "$300" would mean opposite things either
   * side of it. Per-card overrides clear: one control, one meaning.
   */
  const switchMode = (next: PricingMode) => {
    if (next === mode) return;
    const nextItems = buildCatalogItems(sessionReviews, next);
    const nextMax = priceCeiling(nextItems);
    setFilters((f) => ({ ...f, maxPrice: rescaleMaxPrice(f.maxPrice, priceMax, nextMax) }));
    setUnitOverrides({});
    setMode(next);
    setCurrentPage(1);
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

  const filterOptions = useMemo(
    () => catalogFilterOptions(catalogItems, filters, vendors()),
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
                unit={unitFor(detailProduct.offer.id)}
                onUnitChange={(next) =>
                  setUnitOverrides((prev) => ({ ...prev, [detailProduct.offer.id]: next }))
                }
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
                <div className="flex flex-wrap items-center gap-2">
                  <PricingModeToggle mode={mode} onChange={switchMode} />
                  <span className="mx-1 h-5 w-px bg-line" aria-hidden />
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
                        unit={unitFor(item.offer.id)}
                        onUnitChange={(next) =>
                          setUnitOverrides((prev) => ({ ...prev, [item.offer.id]: next }))
                        }
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
    </div>
  );
}
