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
  getReviewsForOffer,
  getVendor,
  hospices,
  orders,
  patients,
  patientNotes,
  productReviews,
  users,
  vendorOffers,
  vendors,
} from './db';
import { offerRatingSummary, vendorRatingSummary } from '../lib/reviews';

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

  it('sells only catalog items, from vendors that exist, with auditable storefront fields', () => {
    for (const offer of vendorOffers) {
      const vendor = getVendor(offer.vendorId);
      const catalogEntry = getCatalogEntry(offer.hcpcs);
      expect(vendor, offer.id).toBeDefined();
      expect(catalogEntry, offer.id).toBeDefined();
      expect(offer.productName, offer.id).toBe(catalogEntry?.name);
      expect(offer.category, offer.id).toBe(catalogEntry?.category);
      expect(offer.description, offer.id).toBe(catalogEntry?.description);
      expect(offer.imagePath.startsWith('/images/'), offer.id).toBe(true);
      expect(offer.deliveryLeadDays).toBeGreaterThan(0);
      expect(vendor?.displayName.length, offer.id).toBeGreaterThan(0);
      expect(getReviewsForOffer(offer.id).length, offer.id).toBeGreaterThan(0);
    }
  });

  it('stores individual product reviews linked to one vendor offer each', () => {
    for (const review of productReviews) {
      expect(vendorOffers.some((o) => o.id === review.offerId), review.id).toBe(true);
      expect(users.some((u) => u.id === review.reviewerId), review.id).toBe(true);
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
      expect(Number.isInteger(review.rating), review.id).toBe(true);
      expect(review.comment.trim().length, review.id).toBeGreaterThan(0);
    }
  });

  it('derives offer ratings from product_reviews rows', () => {
    const summary = offerRatingSummary('OFR-001');
    expect(summary).not.toBeNull();
    expect(summary?.count).toBe(getReviewsForOffer('OFR-001').length);
    expect(summary?.average).toBeGreaterThanOrEqual(1);
    expect(summary?.average).toBeLessThanOrEqual(5);
  });

  it('stores patient notes linked to patients and authors', () => {
    for (const note of patientNotes) {
      expect(getPatient(note.patientId), note.id).toBeDefined();
      expect(users.some((u) => u.id === note.authorId), note.id).toBe(true);
      expect(note.body.trim().length, note.id).toBeGreaterThan(0);
    }
  });

  it('stores vendor overall ratings for scorecards, matching review aggregates', () => {
    for (const vendor of vendors) {
      const computed = vendorRatingSummary(vendor.id);
      expect(computed, vendor.id).not.toBeNull();
      expect(vendor.overallRating).toBe(computed?.average);
      expect(vendor.overallRatingCount).toBe(computed?.count);
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
