/**
 * Loads the JSON fixtures into the store for tests.
 *
 * The app itself gets its data from the API, so nothing in `src/` imports these files any more.
 * The tests still do: they assert on the integrity of the fixture data the backend serves, and a
 * unit test should not need a running API to do that.
 *
 * Test-only. Never import this from application code.
 */

import budgetsJson from './budgets.json';
import equipmentCatalogJson from './equipment_catalog.json';
import emrEventsJson from './emr_events.json';
import hospicesJson from './hospices.json';
import inventoryJson from './inventory.json';
import orderEventsJson from './order_events.json';
import ordersJson from './orders.json';
import patientNotesJson from './patient_notes.json';
import patientsJson from './patients.json';
import productReviewsJson from './product_reviews.json';
import usersJson from './users.json';
import vendorOffersJson from './vendor_offers.json';
import vendorsJson from './vendors.json';
import { seedSnapshot, type Snapshot } from './store';

// TypeScript widens JSON string literals to `string`, so the union types in domain.ts need an
// explicit cast. This is our own fixture data, and db.test.ts is what validates it.
const snapshot = {
  equipmentCatalog: equipmentCatalogJson,
  hospices: hospicesJson,
  vendors: vendorsJson,
  users: usersJson,
  patients: patientsJson,
  orders: ordersJson,
  orderEvents: orderEventsJson,
  inventory: inventoryJson,
  emrEvents: emrEventsJson,
  vendorOffers: vendorOffersJson,
  productReviews: productReviewsJson,
  budgets: budgetsJson,
  patientNotes: patientNotesJson,
} as unknown as Snapshot;

/** Populate the store with the JSON fixtures. Call from a test's setup. */
export const seedFixtures = (): void => seedSnapshot(snapshot);

export { snapshot as fixtureSnapshot };
