/**
 * The API seam.
 *
 * The property that matters most: with no backend configured, every read still returns fixture data
 * and the app behaves exactly as it did before the backend existed. A demo must not go dark because
 * AWS is unreachable.
 */

import { describe, expect, it } from 'vitest';
import {
  ApiUnavailableError,
  createOrder,
  fetchEquipment,
  fetchOrder,
  fetchOrders,
  fetchPatients,
  fetchProducts,
  isApiConfigured,
  updateOrderStatus,
} from './api';
import { orders, patients } from '../data/db';

// No VITE_API_BASE_URL is set under test, so this exercises the fallback path.

describe('with no backend configured', () => {
  it('reports itself as unconfigured', () => {
    expect(isApiConfigured()).toBe(false);
  });

  it('serves orders from fixtures', async () => {
    const result = await fetchOrders();

    expect(result.source).toBe('fixtures');
    expect(result.data).toHaveLength(orders.length);
  });

  it('applies filters to the fixture data', async () => {
    const result = await fetchOrders({ hospiceId: 'HSP-001' });

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((order) => order.hospiceId === 'HSP-001')).toBe(true);
  });

  it('combines filters', async () => {
    const result = await fetchOrders({ hospiceId: 'HSP-001', status: 'delivered' });

    expect(
      result.data.every((o) => o.hospiceId === 'HSP-001' && o.status === 'delivered'),
    ).toBe(true);
  });

  it('serves one order with its timeline', async () => {
    const result = await fetchOrder(orders[0].id);

    expect(result.data.order?.id).toBe(orders[0].id);
    expect(Array.isArray(result.data.events)).toBe(true);
  });

  it('returns undefined for a missing order rather than throwing', async () => {
    const result = await fetchOrder('DME-00000');

    expect(result.data.order).toBeUndefined();
    expect(result.data.events).toEqual([]);
  });

  it('serves patients, products, and equipment', async () => {
    const [patientResult, productResult, equipmentResult] = await Promise.all([
      fetchPatients(),
      fetchProducts(),
      fetchEquipment(),
    ]);

    expect(patientResult.data).toHaveLength(patients.length);
    expect(productResult.data.length).toBeGreaterThan(0);
    expect(equipmentResult.data.length).toBeGreaterThan(0);
  });

  it('filters patients by case manager', async () => {
    const result = await fetchPatients({ caseManagerId: 'USR-001' });

    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((p) => p.caseManagerId === 'USR-001')).toBe(true);
  });

  it('refuses to create an order instead of pretending it worked', async () => {
    await expect(
      createOrder({
        patientId: patients[0].id,
        hospiceId: 'HSP-001',
        equipment: [{ hcpcs: 'E0250', name: 'Hospital Bed', qty: 1 }],
      }),
    ).rejects.toBeInstanceOf(ApiUnavailableError);
  });

  it('refuses to update a status instead of pretending it worked', async () => {
    await expect(updateOrderStatus(orders[0].id, 'dispatched')).rejects.toBeInstanceOf(
      ApiUnavailableError,
    );
  });
});
