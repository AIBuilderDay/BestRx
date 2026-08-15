/**
 * Read access to the database.
 *
 * The rows come from the API, fetched once at app boot into `store.ts`. This module is the only
 * place that reads that snapshot; import from here, never from `store.ts` or a raw .json file.
 * Patient notes are the one exception: the API does not serve them yet, so they are read straight
 * from the fixture, still behind this module.
 *
 * The table accessors are functions rather than arrays because the data now arrives after this
 * module is evaluated — a `const patients = [...]` binding would capture the empty snapshot
 * forever. Everything is still synchronous, so the pure helpers in `src/lib/` are unaffected.
 *
 * Lookups return `undefined` for a missing id rather than throwing — callers must handle it.
 */

import patientNotesJson from './patient_notes.json';
import { getSnapshot } from './store';
import type {
  Budget,
  CatalogEntry,
  EmrEvent,
  Hospice,
  InventoryUnit,
  Order,
  OrderEvent,
  Patient,
  PatientNote,
  ProductReview,
  User,
  Vendor,
  VendorOffer,
} from '../types/domain';

export const equipmentCatalog = (): CatalogEntry[] => getSnapshot().equipmentCatalog;
export const hospices = (): Hospice[] => getSnapshot().hospices;
export const vendors = (): Vendor[] => getSnapshot().vendors;
export const users = (): User[] => getSnapshot().users;
export const patients = (): Patient[] => getSnapshot().patients;
export const orders = (): Order[] => getSnapshot().orders;
export const orderEvents = (): OrderEvent[] => getSnapshot().orderEvents;
export const inventory = (): InventoryUnit[] => getSnapshot().inventory;
export const emrEvents = (): EmrEvent[] => getSnapshot().emrEvents;
export const vendorOffers = (): VendorOffer[] => getSnapshot().vendorOffers;
export const productReviews = (): ProductReview[] => getSnapshot().productReviews;
export const budgets = (): Budget[] => getSnapshot().budgets;

// Patient notes are not served by the API yet, so they come straight from the fixture file. The
// family members store does the same for the same reason (see lib/familyMembers.ts).
export const patientNotes = patientNotesJson as unknown as PatientNote[];

export const getNotesForPatient = (patientId: string): PatientNote[] =>
  patientNotes.filter((n) => n.patientId === patientId);

export const getOrder = (id: string): Order | undefined => orders().find((o) => o.id === id);

export const getPatient = (id: string | null | undefined): Patient | undefined =>
  id ? patients().find((p) => p.id === id) : undefined;

export const getVendor = (id: string | null | undefined): Vendor | undefined =>
  id ? vendors().find((v) => v.id === id) : undefined;

export const getHospice = (id: string | null | undefined): Hospice | undefined =>
  id ? hospices().find((h) => h.id === id) : undefined;

export const getUser = (id: string | null | undefined): User | undefined =>
  id ? users().find((u) => u.id === id) : undefined;

export const getCatalogEntry = (hcpcs: string): CatalogEntry | undefined =>
  equipmentCatalog().find((e) => e.hcpcs === hcpcs);

/** Timeline for one order, oldest first. */
export const getOrderEvents = (orderId: string): OrderEvent[] =>
  orderEvents()
    .filter((e) => e.orderId === orderId)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));

export const getOrdersForHospice = (hospiceId: string): Order[] =>
  orders().filter((o) => o.hospiceId === hospiceId);

export const getOrdersForPatient = (patientId: string): Order[] =>
  orders().filter((o) => o.patientId === patientId);

export const getInventoryForVendor = (vendorId: string): InventoryUnit[] =>
  inventory().filter((u) => u.vendorId === vendorId);

/** Every order currently carrying a risk state, worst first. */
export const getAtRiskOrders = (): Order[] =>
  orders()
    .filter((o) => o.riskState !== null)
    .slice()
    .sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0));

/** Every vendor selling one catalog item. The storefront's comparison list. */
export const getOffersForItem = (hcpcs: string): VendorOffer[] =>
  vendorOffers().filter((o) => o.hcpcs === hcpcs);

export const getOffersForVendor = (vendorId: string): VendorOffer[] =>
  vendorOffers().filter((o) => o.vendorId === vendorId);

export const getReviewsForOffer = (offerId: string): ProductReview[] =>
  productReviews().filter((r) => r.offerId === offerId);

export const getReviewsForVendor = (vendorId: string): ProductReview[] => {
  const offerIds = new Set(getOffersForVendor(vendorId).map((o) => o.id));
  return productReviews().filter((r) => offerIds.has(r.offerId));
};

export const getBudgetsForHospice = (hospiceId: string): Budget[] =>
  budgets().filter((b) => b.hospiceId === hospiceId);

/** The cap a role budget works out to: per-patient-day allowance x patients carried x days. */
export const budgetCapUsd = (budget: Budget): number =>
  budget.derivedFrom
    ? budget.derivedFrom.ppdUsd * budget.derivedFrom.assignedPatients * budget.derivedFrom.days
    : budget.limitUsd;

/** 0-100. Over-cap values exceed 100 on purpose — the caller decides how to show that. */
export const budgetUtilizationPct = (budget: Budget): number => {
  const cap = budgetCapUsd(budget);
  return cap > 0 ? (budget.spentUsd / cap) * 100 : 0;
};
