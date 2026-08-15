/**
 * The in-memory snapshot of every table, fetched from the API at app boot.
 *
 * The app used to import the JSON fixtures directly, which made every table available
 * synchronously at module load. The API is now the only source of data, but the pure helpers in
 * `src/lib/` still do synchronous lookups mid-computation (`getVendor(id)` inside a reduce, for
 * example). Rather than make every one of those async and thread promises up into the views, we
 * load all tables once before the app renders and serve those synchronous lookups from here.
 *
 * The tables are small (a few hundred rows total) and none of them change server-side during a
 * session, so one parallel fetch at boot costs less than per-view requests would.
 *
 * `db.ts` reads through this module. Nothing else should import it directly.
 */

import type {
  Budget,
  CatalogEntry,
  EmrEvent,
  Hospice,
  InventoryUnit,
  Order,
  OrderEvent,
  Patient,
  ProductReview,
  User,
  Vendor,
  VendorOffer,
} from '../types/domain';

export interface Snapshot {
  equipmentCatalog: CatalogEntry[];
  hospices: Hospice[];
  vendors: Vendor[];
  users: User[];
  patients: Patient[];
  orders: Order[];
  orderEvents: OrderEvent[];
  inventory: InventoryUnit[];
  emrEvents: EmrEvent[];
  vendorOffers: VendorOffer[];
  productReviews: ProductReview[];
  budgets: Budget[];
}

const EMPTY: Snapshot = {
  equipmentCatalog: [],
  hospices: [],
  vendors: [],
  users: [],
  patients: [],
  orders: [],
  orderEvents: [],
  inventory: [],
  emrEvents: [],
  vendorOffers: [],
  productReviews: [],
  budgets: [],
};

let snapshot: Snapshot = EMPTY;

/** The current snapshot. Empty until `loadSnapshot` resolves — views render only after it does. */
export const getSnapshot = (): Snapshot => snapshot;

export const setSnapshot = (next: Snapshot): void => {
  snapshot = next;
};

/** Test seam: load a snapshot without a network round trip. */
export const seedSnapshot = (partial: Partial<Snapshot>): void => {
  snapshot = { ...EMPTY, ...partial };
};

export const resetSnapshot = (): void => {
  snapshot = EMPTY;
};

/**
 * Replace the orders table after a write. Keeps a newly placed order visible to the synchronous
 * helpers without a full reload.
 */
export const upsertOrder = (order: Order): void => {
  const index = snapshot.orders.findIndex((o) => o.id === order.id);
  const orders =
    index === -1
      ? [order, ...snapshot.orders]
      : snapshot.orders.map((existing, i) => (i === index ? order : existing));
  snapshot = { ...snapshot, orders };
};

export const appendOrderEvent = (event: OrderEvent): void => {
  if (snapshot.orderEvents.some((e) => e.id === event.id)) return;
  snapshot = { ...snapshot, orderEvents: [...snapshot.orderEvents, event] };
};
