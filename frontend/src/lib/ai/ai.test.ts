import { beforeEach, describe, expect, it } from 'vitest';
import { applyRanking } from './rerank';
import { looksLikeOrderCommand, validateAction } from './agentOrder';
import { findMentionedPatients, sanitizePatient } from './sanitize';
import { clearUsageLog, readUsageLog, recordUsage, summarizeUsage } from './usage';
import { priceUsd } from './client';
import { patients } from '../../data/db';

// usage.ts runs in vitest's node environment — give it a localStorage.
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}
globalThis.localStorage = new MemoryStorage();

describe('applyRanking', () => {
  const inputIds = ['OFR-001', 'OFR-002', 'OFR-003'];

  it('orders by the model ranking and keeps reasons', () => {
    const result = applyRanking(inputIds, [
      { offerId: 'OFR-003', reason: 'Fastest delivery' },
      { offerId: 'OFR-001', reason: 'Best rated' },
      { offerId: 'OFR-002', reason: '' },
    ]);
    expect(result.orderedOfferIds).toEqual(['OFR-003', 'OFR-001', 'OFR-002']);
    expect(result.reasons['OFR-003']).toBe('Fastest delivery');
    expect(result.reasons['OFR-002']).toBeUndefined();
  });

  it('drops hallucinated and duplicate ids, appends forgotten ones', () => {
    const result = applyRanking(inputIds, [
      { offerId: 'OFR-999', reason: 'made up' },
      { offerId: 'OFR-002', reason: 'ok' },
      { offerId: 'OFR-002', reason: 'dup' },
    ]);
    expect(result.orderedOfferIds).toEqual(['OFR-002', 'OFR-001', 'OFR-003']);
    expect(result.reasons['OFR-999']).toBeUndefined();
  });

  it('is a no-op permutation when the model returns nothing', () => {
    expect(applyRanking(inputIds, []).orderedOfferIds).toEqual(inputIds);
  });
});

describe('validateAction', () => {
  const offers = ['OFR-001', 'OFR-002'];
  const pts = ['PT-1', 'PT-2'];
  const base = {
    offerId: 'OFR-001',
    patientId: 'PT-2',
    quantity: 2,
    confidence: 'high' as const,
    summary: 'Add 2 beds for A. B.',
  };

  it('accepts a clean action', () => {
    expect(validateAction(base, offers, pts)).toEqual(base);
  });

  it('rejects NO_MATCH and unknown ids', () => {
    expect(validateAction({ ...base, offerId: 'NO_MATCH' }, offers, pts)).toBeNull();
    expect(validateAction({ ...base, patientId: 'PT-999' }, offers, pts)).toBeNull();
  });

  it('rejects absurd quantities', () => {
    expect(validateAction({ ...base, quantity: 0 }, offers, pts)).toBeNull();
    expect(validateAction({ ...base, quantity: 500 }, offers, pts)).toBeNull();
    expect(validateAction({ ...base, quantity: NaN }, offers, pts)).toBeNull();
  });
});

describe('looksLikeOrderCommand', () => {
  it('routes order-style commands to the agent', () => {
    expect(looksLikeOrderCommand('order a hospital bed for Harold')).toBe(true);
    expect(looksLikeOrderCommand('  Add a wheelchair for Maria')).toBe(true);
  });
  it('routes questions and searches to re-rank', () => {
    expect(looksLikeOrderCommand('best bed for a bariatric patient')).toBe(false);
    expect(looksLikeOrderCommand('oxygen concentrator')).toBe(false);
  });
});

describe('sanitizePatient', () => {
  const patient = patients[0];

  it('strips identity but keeps clinical context', () => {
    const s = sanitizePatient(patient);
    expect(s.label).toBe(`${patient.firstName} ${patient.lastName.charAt(0)}.`);
    expect(JSON.stringify(s)).not.toContain(patient.lastName);
    expect(JSON.stringify(s)).not.toContain(patient.dob);
    expect(JSON.stringify(s)).not.toContain(patient.address.street1);
    expect(s.zip).toBe(patient.address.zip);
    expect(s.diagnosis).toBe(patient.primaryDiagnosis.description);
    expect(typeof s.ageYears).toBe('number');
  });
});

describe('findMentionedPatients', () => {
  it('finds a patient by first name, case-insensitive', () => {
    const target = patients[0];
    const found = findMentionedPatients(`order a bed for ${target.firstName.toUpperCase()}`, patients);
    expect(found.map((p) => p.id)).toContain(target.id);
  });
  it('finds nothing in a plain search', () => {
    expect(findMentionedPatients('low air loss mattress', patients)).toEqual([]);
  });
});

describe('usage ledger', () => {
  beforeEach(() => clearUsageLog());

  it('records calls and splits totals by feature plus a grand total', () => {
    recordUsage({ feature: 'rerank', model: 'claude-haiku-4-5', inputTokens: 10_000, outputTokens: 1_000, latencyMs: 1500, ok: true });
    recordUsage({ feature: 'agent_order', model: 'claude-haiku-4-5', inputTokens: 5_000, outputTokens: 200, latencyMs: 900, ok: true });
    recordUsage({ feature: 'agent_order', model: 'claude-haiku-4-5', inputTokens: 0, outputTokens: 0, latencyMs: 15_000, ok: false });

    const summary = summarizeUsage();
    expect(summary.byFeature.rerank.calls).toBe(1);
    expect(summary.byFeature.agent_order.calls).toBe(2);
    expect(summary.total.calls).toBe(3);
    expect(summary.total.inputTokens).toBe(15_000);
    // 15k in @ $1/M + 1.2k out @ $5/M = $0.015 + $0.006
    expect(summary.total.costUsd).toBeCloseTo(0.021, 5);
  });

  it('prices Haiku correctly', () => {
    expect(priceUsd('claude-haiku-4-5', 1_000_000, 0)).toBe(1);
    expect(priceUsd('claude-haiku-4-5', 0, 1_000_000)).toBe(5);
    expect(priceUsd('unknown-model', 1_000_000, 1_000_000)).toBe(0);
  });

  it('survives a corrupt ledger', () => {
    localStorage.setItem('bestrx.ai_usage.v1', '{not json');
    expect(readUsageLog()).toEqual([]);
    localStorage.setItem('bestrx.ai_usage.v1', JSON.stringify([{ junk: true }]));
    expect(readUsageLog()).toEqual([]);
  });
});
