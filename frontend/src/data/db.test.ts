import { describe, expect, it } from 'vitest';
import {
  getAtRiskOrders,
  getOrder,
  getOrderEvents,
  getPatient,
  getVendor,
  orders,
  patients,
  users,
  vendors,
} from './db';

describe('mock database integrity', () => {
  it('keeps the six canonical bounty orders', () => {
    const canonical = orders.filter((o) => o.canonical).map((o) => o.id);
    expect(canonical).toEqual([
      'DME-10231',
      'DME-10198',
      'DME-10305',
      'DME-10087',
      'DME-09911',
      'DME-09803',
    ]);
  });

  it('resolves every foreign key on every order', () => {
    for (const order of orders) {
      expect(getPatient(order.patientId), `patient for ${order.id}`).toBeDefined();
      if (order.vendorId) expect(getVendor(order.vendorId), `vendor for ${order.id}`).toBeDefined();
      if (order.orderedById) {
        expect(users.some((u) => u.id === order.orderedById), `orderer for ${order.id}`).toBe(true);
      }
    }
  });

  it('points every patient at a real hospice and case manager', () => {
    for (const patient of patients) {
      expect(users.some((u) => u.id === patient.caseManagerId), patient.id).toBe(true);
    }
  });

  it('gives every order at least one timeline event, in chronological order', () => {
    for (const order of orders) {
      const events = getOrderEvents(order.id);
      expect(events.length, `events for ${order.id}`).toBeGreaterThan(0);
      const timestamps = events.map((e) => e.at);
      expect(timestamps).toEqual([...timestamps].sort());
    }
  });

  it('ranks at-risk orders worst first', () => {
    const atRisk = getAtRiskOrders();
    expect(atRisk.map((o) => o.id)).toEqual(['DME-09803', 'DME-10305']);
  });

  it('returns undefined rather than throwing for unknown ids', () => {
    expect(getOrder('DME-00000')).toBeUndefined();
    expect(getPatient(null)).toBeUndefined();
    expect(getVendor(undefined)).toBeUndefined();
  });

  it('gives every vendor an SLA and a 30-day performance record', () => {
    for (const vendor of vendors) {
      expect(vendor.sla.pickupHours).toBeGreaterThan(0);
      expect(vendor.performance30d.onTimeDeliveryPct).toBeGreaterThan(0);
    }
  });
});
