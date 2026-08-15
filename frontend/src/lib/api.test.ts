/**
 * The API client.
 *
 * The property that matters most: there is no fixture fallback. A failed request surfaces as a
 * rejection so a broken backend can never look like a working one.
 *
 * `VITE_API_BASE_URL` is unset under test, so the module-level BASE_URL is empty and reads reject
 * on the unconfigured guard. The snapshot shape is checked against a stubbed fetch.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiUnavailableError,
  checkoutCart,
  clearCart,
  createCart,
  createOrder,
  EmptyCartError,
  fetchSnapshot,
  isApiConfigured,
  updateCart,
  updateOrderStatus,
} from './api';
import { orders, patients } from '../data/db';
import { fixtureSnapshot } from '../data/testSnapshot';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('with no backend configured', () => {
  it('reports itself as unconfigured', () => {
    expect(isApiConfigured()).toBe(false);
  });

  it('refuses to load a snapshot instead of falling back to fixtures', async () => {
    await expect(fetchSnapshot()).rejects.toThrow(/VITE_API_BASE_URL/);
  });

  it('refuses to create an order instead of pretending it worked', async () => {
    await expect(
      createOrder({
        patientId: patients()[0].id,
        hospiceId: 'HSP-001',
        equipment: [{ hcpcs: 'E0250', name: 'Hospital Bed', qty: 1 }],
      }),
    ).rejects.toBeInstanceOf(ApiUnavailableError);
  });

  it('refuses to update a status instead of pretending it worked', async () => {
    await expect(updateOrderStatus(orders()[0].id, 'dispatched')).rejects.toBeInstanceOf(
      ApiUnavailableError,
    );
  });

});

/**
 * Cart writes go to the server or fail loudly — a cart that silently diverged from what gets
 * ordered would be worse than a visible error. These assert against a stubbed fetch rather than the
 * unconfigured guard, so they hold whether or not a local .env points at a real API.
 */
describe('cart writes', () => {
  const line = { offerId: 'OFR-001', patientId: patients()[0].id, unit: 'month' as const, qty: 1 };

  const stubFetch = (response: Partial<Response>) => {
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}), ...response });
    vi.stubGlobal('fetch', spy);
    return spy;
  };

  it('sends a whole-cart replace as a PUT, never a price', async () => {
    const fetchSpy = stubFetch({
      json: async () => ({ id: 'CART-1', userId: 'USR-001', lines: [], totals: {} }),
    });

    await updateCart('USR-001', [line]);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/\/carts\/USR-001$/);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ lines: [line] });
  });

  it('posts a new cart with its owner', async () => {
    const fetchSpy = stubFetch({
      json: async () => ({ id: 'CART-1', userId: 'USR-001', lines: [], totals: {} }),
    });

    await createCart('USR-001', [line]);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toMatch(/\/carts$/);
    expect(JSON.parse(init.body)).toEqual({ userId: 'USR-001', lines: [line] });
  });

  it('deletes a cart without expecting a body back', async () => {
    const fetchSpy = stubFetch({ status: 204 });

    await expect(clearCart('USR-001')).resolves.toBeUndefined();
    expect(fetchSpy.mock.calls[0][1].method).toBe('DELETE');
  });

  it('surfaces a failed write rather than resolving quietly', async () => {
    stubFetch({ ok: false, status: 500, statusText: 'Server Error', text: async () => 'boom' });

    await expect(updateCart('USR-001', [line])).rejects.toThrow(/500/);
  });

  it('reports an empty cart as its own error, not a raw 409', async () => {
    stubFetch({ ok: false, status: 409, statusText: 'Conflict', text: async () => 'empty' });

    await expect(checkoutCart('USR-001')).rejects.toBeInstanceOf(EmptyCartError);
  });

  // Without this the Orders board would not show a just-placed order until a full reload.
  it('puts checked-out orders into the snapshot the views read', async () => {
    const created = { ...orders()[0], id: 'DME-99001', status: 'ordered' as const };
    stubFetch({ json: async () => ({ orders: [created], orderIds: [created.id] }) });

    await checkoutCart('USR-001');

    expect(orders().find((o) => o.id === 'DME-99001')).toBeDefined();
  });
});

describe('snapshot shape', () => {
  it('covers every table the store holds', () => {
    // A missing key here means a view would render an empty table with no error to explain it.
    expect(Object.keys(fixtureSnapshot).sort()).toEqual(
      [
        'budgets',
        'emrEvents',
        'equipmentCatalog',
        'hospices',
        'inventory',
        'orderEvents',
        'orders',
        'patients',
        'productReviews',
        'users',
        'vendorOffers',
        'vendors',
      ].sort(),
    );
  });

  it('loads every table with rows', () => {
    for (const [table, rows] of Object.entries(fixtureSnapshot)) {
      expect(rows.length, `${table} is empty`).toBeGreaterThan(0);
    }
  });
});
