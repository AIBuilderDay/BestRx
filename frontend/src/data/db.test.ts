import { describe, expect, it } from 'vitest';
import {
  budgetCapUsd,
  budgets,
  budgetUtilizationPct,
  getAtRiskOrders,
  getCatalogEntry,
  getOffersForItem,
  getOrder,
  getOrderEvents,
  getPatient,
  getVendor,
  hospices,
  orders,
  patients,
  users,
  vendorOffers,
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

  it('sells only catalog items, from vendors that exist', () => {
    for (const offer of vendorOffers) {
      expect(getVendor(offer.vendorId), offer.id).toBeDefined();
      expect(getCatalogEntry(offer.hcpcs), offer.id).toBeDefined();
      expect(offer.nurseRating).toBeGreaterThanOrEqual(1);
      expect(offer.nurseRating).toBeLessThanOrEqual(5);
    }
  });

  it('offers every canonical order item from at least one vendor', () => {
    const canonicalCodes = orders
      .filter((o) => o.canonical)
      .flatMap((o) => o.equipment.map((e) => e.hcpcs));
    for (const hcpcs of new Set(canonicalCodes)) {
      expect(getOffersForItem(hcpcs).length, hcpcs).toBeGreaterThan(0);
    }
  });

  it('scopes every budget to a real hospice, and to a role or a real patient', () => {
    for (const budget of budgets) {
      expect(hospices.some((h) => h.id === budget.hospiceId), budget.id).toBe(true);
      if (budget.scope === 'patient_purchase') {
        expect(getPatient(budget.scopeRef), budget.id).toBeDefined();
      } else {
        expect(users.some((u) => u.role === budget.scopeRef), budget.id).toBe(true);
      }
      expect(budget.spentUsd).toBeLessThanOrEqual(budget.limitUsd);
    }
  });

  it('derives every role budget cap from PPD x patients x days', () => {
    for (const budget of budgets.filter((b) => b.derivedFrom)) {
      expect(budgetCapUsd(budget), budget.id).toBeCloseTo(budget.limitUsd, 2);
      expect(budgetUtilizationPct(budget), budget.id).toBeLessThanOrEqual(100);
    }
  });

  it('gives every vendor an SLA and a 30-day performance record', () => {
    for (const vendor of vendors) {
      expect(vendor.sla.pickupHours).toBeGreaterThan(0);
      expect(vendor.performance30d.onTimeDeliveryPct).toBeGreaterThan(0);
    }
  });
});
