import { useMemo, useRef, useState } from 'react';
import { equipmentCatalog, getHospice, getUser, patients, vendors } from '../data/db';
import {
  buildCartGroups,
  buildCatalogItems,
  CATEGORY_LABELS,
  cartTotals,
  filterAndSortCatalog,
  paginateCatalog,
  patientFullName,
  priceCeiling,
  setCartLineQty,
  totalUnitsInCart,
  unitsInCartFor,
  upsertCartLine,
  type CatalogFilterState,
  type SortKey,
} from '../lib/catalog';
import type { EquipmentCategory } from '../types/domain';
import { TopNav } from '../components/layout/TopNav';
import { CatalogFilters, type CategoryOption } from '../components/catalog/CatalogFilters';
import { ProductCard } from '../components/catalog/ProductCard';
import { CatalogPagination } from '../components/catalog/CatalogPagination';
import { PatientAssignSheet } from '../components/catalog/PatientAssignSheet';
import { CartDrawer } from '../components/catalog/CartDrawer';
import { Toast } from '../components/ui/Toast';
import { useCart } from '../context/CartContext';
import { CURRENT_USER_ID, HOSPICE_ID } from '../lib/session';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'featured', label: 'Featured' },
  { key: 'price', label: 'Price' },
  { key: 'speed', label: 'Fastest' },
];

const PRICE_MAX = priceCeiling(equipmentCatalog);

export default function Catalog() {
  const hospice = getHospice(HOSPICE_ID);
  const currentUser = getUser(CURRENT_USER_ID);
  const assignablePatients = useMemo(
    () => patients.filter((p) => p.hospiceId === HOSPICE_ID && p.status !== 'deceased'),
    [],
  );
  const catalogItems = useMemo(() => buildCatalogItems(equipmentCatalog), []);

  const [filters, setFilters] = useState<CatalogFilterState>({
    category: 'All',
    vendorIds: [],
    speed: 'any',
    maxPrice: PRICE_MAX,
    sort: 'featured',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const { lines, setLines, cartOpen, setCartOpen, clearCart } = useCart();
  const [sheetHcpcs, setSheetHcpcs] = useState<string | null>(null);
  const [sheetQty, setSheetQty] = useState(1);
  const [checkoutAfter, setCheckoutAfter] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const say = (message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  };

  const pickQty = (hcpcs: string) => picks[hcpcs] ?? 1;
  const setPickQty = (hcpcs: string, n: number) => setPicks((p) => ({ ...p, [hcpcs]: Math.max(1, Math.min(99, n)) }));

  const openSheet = (hcpcs: string, forCheckout: boolean) => {
    setSheetHcpcs(hcpcs);
    setSheetQty(pickQty(hcpcs));
    setCheckoutAfter(forCheckout);
    setCartOpen(false);
  };

  const sheetProduct = catalogItems.find((it) => it.entry.hcpcs === sheetHcpcs) ?? null;

  const confirmSheet = (selectedPatientIds: string[]) => {
    if (!sheetProduct) return;
    if (selectedPatientIds.length === 0) {
      say('Pick at least one patient for this equipment');
      return;
    }
    setLines((prev) =>
      selectedPatientIds.reduce((acc, pid) => upsertCartLine(acc, sheetProduct.entry.hcpcs, pid, sheetQty), prev),
    );
    const names =
      selectedPatientIds.length === 1
        ? (patients.find((p) => p.id === selectedPatientIds[0]) &&
            patientFullName(patients.find((p) => p.id === selectedPatientIds[0])!)) ||
          selectedPatientIds[0]
        : `${selectedPatientIds.length} patients`;
    say(`${sheetProduct.entry.name} × ${sheetQty} added for ${names}`);
    setSheetHcpcs(null);
    if (checkoutAfter) setCartOpen(true);
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

  const resetFilters = () => {
    setFilters({ category: 'All', vendorIds: [], speed: 'any', maxPrice: PRICE_MAX, sort: 'featured' });
    setCurrentPage(1);
    say('Filters cleared');
  };

  const filteredSorted = filterAndSortCatalog(catalogItems, filters);
  const catalogPage = paginateCatalog(filteredSorted, currentPage);
  const cartGroups = buildCartGroups(lines, catalogItems, patients);
  const totals = cartTotals(lines, catalogItems);

  const categories: CategoryOption[] = [
    { key: 'All', label: 'All', count: equipmentCatalog.length },
    ...(Object.keys(CATEGORY_LABELS) as EquipmentCategory[]).map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      count: equipmentCatalog.filter((e) => e.category === key).length,
    })),
  ];

  return (
    <div className="min-h-screen bg-white">
      <TopNav
        hospiceName={hospice?.name ?? 'Hospice'}
        userName={currentUser?.name ?? 'Case manager'}
        cartCount={totalUnitsInCart(lines)}
        activeSection="catalog"
        onOpenCart={() => setCartOpen(true)}
      />

      <div className="grid grid-cols-[224px_minmax(0,1fr)] items-start">
        <CatalogFilters
          filters={filters}
          categories={categories}
          vendors={vendors}
          priceMax={PRICE_MAX}
          onChange={(patch) => {
            setFilters((f) => ({ ...f, ...patch }));
            setCurrentPage(1);
          }}
          onReset={resetFilters}
        />

        <main className="min-w-0 px-10 pb-20 pt-8.5">
          <div className="mb-7.5 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="text-xs text-[var(--color-ink-3)]">{hospice?.name ?? 'Hospice'} / Catalog</div>
              <h1 className="mt-1.5 text-3xl font-normal tracking-tight">Durable Medical Equipment</h1>
              <div className="mt-1.5 text-[13px] text-[var(--color-ink-2)]">
                {filteredSorted.length} of {catalogItems.length} items · Medicare-allowed rates on file, vendor and
                lead time shown where known from live inventory.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    setFilters((f) => ({ ...f, sort: s.key }));
                    setCurrentPage(1);
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors hover:border-[var(--color-ink)] ${
                    filters.sort === s.key
                      ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
                      : 'border-[var(--color-line)] bg-white text-[var(--color-ink-2)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {filteredSorted.length === 0 ? (
            <div className="py-15 text-center text-[13px] text-[var(--color-ink-3)]">No equipment matches these filters.</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-x-6.5 gap-y-10">
              {catalogPage.items.map((item, i) => (
                <div
                  key={item.entry.hcpcs}
                  className="h-full min-w-0 animate-[cardIn_0.55s_cubic-bezier(0.2,0.7,0.2,1)_both]"
                  style={{ animationDelay: `${i * 0.045}s` }}
                >
                  <ProductCard
                    item={item}
                    qty={pickQty(item.entry.hcpcs)}
                    onQtyChange={(n) => setPickQty(item.entry.hcpcs, n)}
                    inCartQty={unitsInCartFor(lines, item.entry.hcpcs)}
                    onAddToCart={() => openSheet(item.entry.hcpcs, false)}
                    onBuyNow={() => openSheet(item.entry.hcpcs, true)}
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
              onPageChange={setCurrentPage}
            />
          ) : null}
        </main>
      </div>

      <PatientAssignSheet
        product={sheetProduct}
        qty={sheetQty}
        patients={assignablePatients}
        checkoutAfter={checkoutAfter}
        onClose={() => setSheetHcpcs(null)}
        onConfirm={confirmSheet}
      />

      <CartDrawer
        open={cartOpen}
        groups={cartGroups}
        totals={totals}
        onQtyChange={(hcpcs, patientId, qty) => setLines((prev) => setCartLineQty(prev, hcpcs, patientId, qty))}
        onRemove={(hcpcs, patientId) => setLines((prev) => setCartLineQty(prev, hcpcs, patientId, 0))}
        onClose={() => setCartOpen(false)}
        onPlaceOrder={placeOrder}
      />

      <Toast message={toast} />
    </div>
  );
}
