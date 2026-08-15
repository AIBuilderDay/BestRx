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
  createOrder,
  fetchSnapshot,
  isApiConfigured,
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
