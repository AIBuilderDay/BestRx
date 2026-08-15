/**
 * The mock database.
 *
 * JSON files in this folder stand in for tables. Import from here, never from the raw .json files,
 * so that swapping in a real API later touches one module instead of every view.
 *
 * Lookups return `undefined` for a missing id rather than throwing — callers must handle it.
 */

import type {
  AiUsageEvent,
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

import aiUsageJson from './ai_usage.json';
import budgetsJson from './budgets.json';
import equipmentCatalogJson from './equipment_catalog.json';
import emrEventsJson from './emr_events.json';
import hospicesJson from './hospices.json';
import inventoryJson from './inventory.json';
import orderEventsJson from './order_events.json';
import ordersJson from './orders.json';
import patientsJson from './patients.json';
import productReviewsJson from './product_reviews.json';
import usersJson from './users.json';
import vendorOffersJson from './vendor_offers.json';
import vendorsJson from './vendors.json';

// TypeScript widens JSON string literals to `string`, so the union types in domain.ts need an
// explicit cast. The JSON is our own fixture data and is validated by the tests in db.test.ts.
export const equipmentCatalog = equipmentCatalogJson as unknown as CatalogEntry[];
export const hospices = hospicesJson as unknown as Hospice[];
export const vendors = vendorsJson as unknown as Vendor[];
export const users = usersJson as unknown as User[];
export const patients = patientsJson as unknown as Patient[];
export const orders = ordersJson as unknown as Order[];
export const orderEvents = orderEventsJson as unknown as OrderEvent[];
export const inventory = inventoryJson as unknown as InventoryUnit[];
export const emrEvents = emrEventsJson as unknown as EmrEvent[];
export const vendorOffers = vendorOffersJson as unknown as VendorOffer[];
export const productReviews = productReviewsJson as unknown as ProductReview[];
export const budgets = budgetsJson as unknown as Budget[];
export const aiUsage = aiUsageJson as unknown as AiUsageEvent[];

export const getOrder = (id: string): Order | undefined => orders.find((o) => o.id === id);

export const getPatient = (id: string | null | undefined): Patient | undefined =>
  id ? patients.find((p) => p.id === id) : undefined;

export const getVendor = (id: string | null | undefined): Vendor | undefined =>
  id ? vendors.find((v) => v.id === id) : undefined;

export const getHospice = (id: string | null | undefined): Hospice | undefined =>
  id ? hospices.find((h) => h.id === id) : undefined;

export const getUser = (id: string | null | undefined): User | undefined =>
  id ? users.find((u) => u.id === id) : undefined;

export const getCatalogEntry = (hcpcs: string): CatalogEntry | undefined =>
  equipmentCatalog.find((e) => e.hcpcs === hcpcs);

/** Timeline for one order, oldest first. */
export const getOrderEvents = (orderId: string): OrderEvent[] =>
  orderEvents
    .filter((e) => e.orderId === orderId)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at));

export const getOrdersForHospice = (hospiceId: string): Order[] =>
  orders.filter((o) => o.hospiceId === hospiceId);

export const getOrdersForPatient = (patientId: string): Order[] =>
  orders.filter((o) => o.patientId === patientId);

export const getInventoryForVendor = (vendorId: string): InventoryUnit[] =>
  inventory.filter((u) => u.vendorId === vendorId);

/** Every order currently carrying a risk state, worst first. */
export const getAtRiskOrders = (): Order[] =>
  orders
    .filter((o) => o.riskState !== null)
    .slice()
    .sort((a, b) => (b.risk?.score ?? 0) - (a.risk?.score ?? 0));

/** Every vendor selling one catalog item. The storefront's comparison list. */
export const getOffersForItem = (hcpcs: string): VendorOffer[] =>
  vendorOffers.filter((o) => o.hcpcs === hcpcs);

export const getOffersForVendor = (vendorId: string): VendorOffer[] =>
  vendorOffers.filter((o) => o.vendorId === vendorId);

export const getReviewsForOffer = (offerId: string): ProductReview[] =>
  productReviews.filter((r) => r.offerId === offerId);

export const getReviewsForVendor = (vendorId: string): ProductReview[] => {
  const offerIds = new Set(getOffersForVendor(vendorId).map((o) => o.id));
  return productReviews.filter((r) => offerIds.has(r.offerId));
};

export const getBudgetsForHospice = (hospiceId: string): Budget[] =>
  budgets.filter((b) => b.hospiceId === hospiceId);

export const getAiUsageForHospice = (hospiceId: string): AiUsageEvent[] =>
  aiUsage.filter((e) => e.hospiceId === hospiceId);

/** The cap a role budget works out to: the role's share of the hospice's total monthly budget. */
export const budgetCapUsd = (budget: Budget): number => {
  if (!budget.derivedFrom) return budget.limitUsd;
  const hospice = getHospice(budget.hospiceId);
  const monthlyBudgetUsd = hospice?.monthlyBudgetUsd ?? 0;
  return Math.round(monthlyBudgetUsd * budget.derivedFrom.pctOfBudget * 100) / 100;
};

/** 0-100. Over-cap values exceed 100 on purpose — the caller decides how to show that. */
export const budgetUtilizationPct = (budget: Budget): number => {
  const cap = budgetCapUsd(budget);
  return cap > 0 ? (budget.spentUsd / cap) * 100 : 0;
};
