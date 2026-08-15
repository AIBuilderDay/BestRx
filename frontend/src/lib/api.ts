/**
 * The API client. The backend is the only source of data.
 *
 * `VITE_API_BASE_URL` defaults to the local API in docker-compose. There is deliberately no
 * fixture fallback: the app used to fall back to bundled JSON when a request failed, which meant a
 * broken backend looked identical to a working one. A failed request now surfaces as a visible
 * error state so what you see is always what the API actually returned.
 *
 * Reads throw on failure; callers catch and render an error state.
 */

import { appendOrderEvent, upsertOrder, type Snapshot } from '../data/store';
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

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/** True when a backend URL is configured. Without one the app cannot load any data. */
export const isApiConfigured = (): boolean => BASE_URL.length > 0;

/** Ten seconds: long enough for a cold start, short enough that a dead API fails visibly. */
const REQUEST_TIMEOUT_MS = 10_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 200)}`);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export interface OrderFilters extends Record<string, string | undefined> {
  hospiceId?: string;
  patientId?: string;
  status?: string;
}

const queryString = (filters: Record<string, string | undefined>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const fetchOrders = (filters: OrderFilters = {}): Promise<Order[]> =>
  request<Order[]>(`/orders${queryString(filters)}`);

export interface OrderWithTimeline {
  order: Order | undefined;
  events: OrderEvent[];
}

export const fetchOrder = (orderId: string): Promise<OrderWithTimeline> =>
  request<OrderWithTimeline>(`/orders/${orderId}`);

export const fetchPatients = (
  filters: { hospiceId?: string; caseManagerId?: string } = {},
): Promise<Patient[]> => request<Patient[]>(`/patients${queryString(filters)}`);

export const fetchProducts = (
  filters: { vendorId?: string; category?: string } = {},
): Promise<VendorOffer[]> => request<VendorOffer[]>(`/products${queryString(filters)}`);

export const fetchEquipment = (): Promise<CatalogEntry[]> => request<CatalogEntry[]>('/equipment');

export const fetchVendors = (): Promise<Vendor[]> => request<Vendor[]>('/vendors');

/**
 * Every table, in parallel, for the boot snapshot in `data/store.ts`.
 *
 * One round of requests rather than per-view fetching: the tables are small, none of them change
 * server-side during a session, and loading them up front keeps the synchronous lookups in
 * `src/lib/` working without threading promises through every helper.
 *
 * Rejects if any single table fails — a partially loaded app would render wrong numbers, which is
 * worse than showing an error.
 */
export async function fetchSnapshot(): Promise<Snapshot> {
  if (!isApiConfigured()) {
    throw new Error('No backend configured. Set VITE_API_BASE_URL to load data.');
  }

  const [
    equipmentCatalog,
    hospices,
    vendors,
    users,
    patients,
    orders,
    orderEvents,
    inventory,
    emrEvents,
    vendorOffers,
    productReviews,
    budgets,
  ] = await Promise.all([
    request<CatalogEntry[]>('/equipment'),
    request<Hospice[]>('/hospices'),
    request<Vendor[]>('/vendors'),
    request<User[]>('/users'),
    request<Patient[]>('/patients'),
    request<Order[]>('/orders'),
    request<OrderEvent[]>('/orders/events/all'),
    request<InventoryUnit[]>('/inventory'),
    request<EmrEvent[]>('/emr-events'),
    request<VendorOffer[]>('/products'),
    request<ProductReview[]>('/reviews'),
    request<Budget[]>('/budgets'),
  ]);

  return {
    equipmentCatalog,
    hospices,
    vendors,
    users,
    patients,
    orders,
    orderEvents,
    inventory,
    emrEvents,
    vendorOffers,
    productReviews,
    budgets,
  };
}

// ── Writes ────────────────────────────────────────────────────────────────────
// No fixture fallback: a write that silently did nothing would be worse than a visible failure.

export interface CreateOrderInput {
  patientId: string;
  hospiceId: string;
  vendorId?: string | null;
  orderedById?: string | null;
  orderType?: Order['orderType'];
  urgency?: Order['urgency'];
  equipment: Order['equipment'];
  targetBy?: string | null;
  notes?: string;
}

export class ApiUnavailableError extends Error {
  constructor() {
    super('No backend is configured. Set VITE_API_BASE_URL to place real orders.');
    this.name = 'ApiUnavailableError';
  }
}

/** Thrown for a 409: the order cannot move to that status from where it is. */
export class InvalidTransitionError extends Error {
  constructor(
    readonly currentStatus: string,
    readonly allowedNext: string[],
  ) {
    super(
      allowedNext.length > 0
        ? `Order is ${currentStatus}; it can only move to ${allowedNext.join(' or ')}.`
        : `Order is ${currentStatus}, which is final.`,
    );
    this.name = 'InvalidTransitionError';
  }
}

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (!isApiConfigured()) throw new ApiUnavailableError();
  const order = await request<Order>('/orders', { method: 'POST', body: JSON.stringify(input) });
  // Keep the boot snapshot current so the synchronous lookups in src/lib/ see the new order.
  upsertOrder(order);
  return order;
}

export async function updateOrderStatus(
  orderId: string,
  status: Order['status'],
  actorId?: string,
): Promise<{ order: Order; event: OrderEvent }> {
  if (!isApiConfigured()) throw new ApiUnavailableError();

  try {
    const result = await request<{ order: Order; event: OrderEvent }>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, actorId }),
    });
    upsertOrder(result.order);
    appendOrderEvent(result.event);
    return result;
  } catch (error) {
    // Rethrow a 409 as something the UI can explain to the user.
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('409')) {
      const match = message.match(/\{.*\}/s);
      if (match) {
        try {
          const detail = JSON.parse(match[0]) as {
            detail?: { currentStatus?: string; allowedNext?: string[] };
          };
          throw new InvalidTransitionError(
            detail.detail?.currentStatus ?? 'unknown',
            detail.detail?.allowedNext ?? [],
          );
        } catch (parseError) {
          if (parseError instanceof InvalidTransitionError) throw parseError;
        }
      }
    }
    throw error;
  }
}
