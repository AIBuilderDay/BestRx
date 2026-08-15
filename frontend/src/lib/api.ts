/**
 * The API seam.
 *
 * When `VITE_API_BASE_URL` is set the app talks to the deployed backend. When it is not — the
 * default for `pnpm dev` and for anyone cloning the repo — every call falls back to the JSON
 * fixtures in `data/db.ts` and the app behaves exactly as it did before the backend existed.
 *
 * That fallback is deliberate: a demo must not go dark because AWS is unreachable or a credential
 * expired. It also means no view has to know whether a backend is present.
 *
 * Errors are returned, never thrown. Callers render something sane for the failure case, matching
 * the "lookups return undefined" rule in docs/DATA_MODEL.md.
 */

import {
  equipmentCatalog,
  getOrder,
  getOrderEvents,
  orders as fixtureOrders,
  patients as fixturePatients,
  vendorOffers,
  vendors as fixtureVendors,
} from '../data/db';
import type { CatalogEntry, Order, OrderEvent, Patient, Vendor, VendorOffer } from '../types/domain';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

/** True when a deployed backend is configured. */
export const isApiConfigured = (): boolean => BASE_URL.length > 0;

export interface ApiResult<T> {
  data: T;
  /** Where the data came from. Views can surface this so a demo is honest about what it is showing. */
  source: 'api' | 'fixtures';
  error?: string;
}

const fixtureResult = <T>(data: T, error?: string): ApiResult<T> => ({
  data,
  source: 'fixtures',
  error,
});

/** Ten seconds: long enough for a Lambda cold start, short enough that a dead API fails visibly. */
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

/** Try the API, fall back to fixtures on any failure. */
async function withFallback<T>(path: string, fallback: () => T): Promise<ApiResult<T>> {
  if (!isApiConfigured()) return fixtureResult(fallback());

  try {
    return { data: await request<T>(path), source: 'api' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`API request to ${path} failed; using fixtures instead.`, message);
    return fixtureResult(fallback(), message);
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

export const fetchOrders = (filters: OrderFilters = {}): Promise<ApiResult<Order[]>> =>
  withFallback(`/orders${queryString(filters)}`, () =>
    fixtureOrders.filter(
      (order) =>
        (!filters.hospiceId || order.hospiceId === filters.hospiceId) &&
        (!filters.patientId || order.patientId === filters.patientId) &&
        (!filters.status || order.status === filters.status),
    ),
  );

export interface OrderWithTimeline {
  order: Order | undefined;
  events: OrderEvent[];
}

export const fetchOrder = (orderId: string): Promise<ApiResult<OrderWithTimeline>> =>
  withFallback(`/orders/${orderId}`, () => ({
    order: getOrder(orderId),
    events: getOrderEvents(orderId),
  }));

export const fetchPatients = (
  filters: { hospiceId?: string; caseManagerId?: string } = {},
): Promise<ApiResult<Patient[]>> =>
  withFallback(`/patients${queryString(filters)}`, () =>
    fixturePatients.filter(
      (patient) =>
        (!filters.hospiceId || patient.hospiceId === filters.hospiceId) &&
        (!filters.caseManagerId || patient.caseManagerId === filters.caseManagerId),
    ),
  );

export const fetchProducts = (
  filters: { vendorId?: string; category?: string } = {},
): Promise<ApiResult<VendorOffer[]>> =>
  withFallback(`/products${queryString(filters)}`, () =>
    vendorOffers.filter(
      (offer) =>
        (!filters.vendorId || offer.vendorId === filters.vendorId) &&
        (!filters.category || offer.category === filters.category),
    ),
  );

export const fetchEquipment = (): Promise<ApiResult<CatalogEntry[]>> =>
  withFallback('/equipment', () => equipmentCatalog);

export const fetchVendors = (): Promise<ApiResult<Vendor[]>> =>
  withFallback('/vendors', () => fixtureVendors);

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
  return request<Order>('/orders', { method: 'POST', body: JSON.stringify(input) });
}

export async function updateOrderStatus(
  orderId: string,
  status: Order['status'],
  actorId?: string,
): Promise<{ order: Order; event: OrderEvent }> {
  if (!isApiConfigured()) throw new ApiUnavailableError();

  try {
    return await request<{ order: Order; event: OrderEvent }>(`/orders/${orderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, actorId }),
    });
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
