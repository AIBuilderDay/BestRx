import { describe, expect, it } from 'vitest';
import {
  accountTotals,
  buildAccountRows,
  NO_OVERRIDES,
  parseRateInput,
  roleRates,
  setAccountOverride,
  setRoleOverride,
  sortAccountRows,
} from './budgetLedger';
import { getPeriod } from './costPeriod';

const period = getPeriod('aug-2026');
const rows = buildAccountRows('HSP-001', period, NO_OVERRIDES);
const rowFor = (id: string) => rows.find((r) => r.user.id === id)!;

describe('buildAccountRows', () => {
  it('lists every hospice account, including those carrying no patients', () => {
    expect(rows.map((r) => r.user.id).sort()).toEqual([
      'USR-001', 'USR-002', 'USR-010', 'USR-012', 'USR-013',
    ]);
  });

  it('derives a cap from PPD x counted caseload x days', () => {
    const dana = rowFor('USR-001');
    expect(dana.assignedPatients).toBe(13);
    expect(dana.ppdUsd).toBe(8);
    expect(dana.capUsd).toBeCloseTo(8 * 13 * 31, 2);
    expect(dana.spentUsd).toBeCloseTo(1645, 2);
    expect(dana.status).toBe('under');
  });

  it('flags an account approaching its cap', () => {
    const bea = rowFor('USR-010');
    expect(bea.capUsd).toBeCloseTo(8 * 12 * 31, 2);
    expect(bea.utilizationPct).toBe(93);
    expect(bea.status).toBe('near');
  });

  it('never reports a utilization for a zero cap, and says why', () => {
    const marcus = rowFor('USR-002');
    expect(marcus.assignedPatients).toBe(0);
    expect(marcus.capUsd).toBe(0);
    expect(marcus.spentUsd).toBeCloseTo(192.5, 2);
    expect(marcus.utilizationPct).toBeNull();
    expect(marcus.status).toBe('no_caseload');
    expect(marcus.note).toContain('no patients assigned');
    expect(marcus.countsTowardTotals).toBe(false);
  });

  it('leaves a role with no budget row uncapped rather than guessing zero', () => {
    const grant = rowFor('USR-013');
    expect(grant.ppdUsd).toBeNull();
    expect(grant.capUsd).toBeNull();
    expect(grant.utilizationPct).toBeNull();
    expect(grant.status).toBe('no_rate');
    expect(grant.note).toContain('No role budget configured');
  });

  it('counts the caseload itself rather than trusting budgets.derivedFrom', () => {
    // BUD-002 claims 24 assigned patients for case_manager; only 13 are actually assigned.
    expect(rowFor('USR-001').assignedPatients).toBe(13);
  });
});

describe('accountTotals', () => {
  it('sums only rows with a real cap, and names the exclusions', () => {
    const totals = accountTotals(rows);
    expect(totals.capUsd).toBeCloseTo(6200, 2);
    expect(totals.spentUsd).toBeCloseTo(4606, 2);
    expect(totals.utilizationPct).toBe(74);
    expect(totals.excludedUserIds.sort()).toEqual(['USR-002', 'USR-012', 'USR-013']);
    expect(totals.excludedReason).toContain('3 accounts excluded');
  });
});

describe('overrides', () => {
  it('applies an account override over the role default', () => {
    const overrides = setAccountOverride(NO_OVERRIDES, 'USR-001', 12, 8);
    const dana = buildAccountRows('HSP-001', period, overrides).find((r) => r.user.id === 'USR-001')!;
    expect(dana.ppdUsd).toBe(12);
    expect(dana.ppdSource).toBe('account-override');
    expect(dana.capUsd).toBeCloseTo(12 * 13 * 31, 2);
  });

  it('clears an account override set back to the role default', () => {
    const applied = setAccountOverride(NO_OVERRIDES, 'USR-001', 12, 8);
    const cleared = setAccountOverride(applied, 'USR-001', 8, 8);
    expect(cleared.accounts['USR-001']).toBeUndefined();
  });

  it('never mutates the overrides handed to it', () => {
    const before = JSON.stringify(NO_OVERRIDES);
    setRoleOverride(NO_OVERRIDES, 'case_manager', 11);
    setAccountOverride(NO_OVERRIDES, 'USR-001', 12, 8);
    expect(JSON.stringify(NO_OVERRIDES)).toBe(before);
  });

  it('lets a role override move every account in that role', () => {
    const overrides = setRoleOverride(NO_OVERRIDES, 'case_manager', 10);
    const updated = buildAccountRows('HSP-001', period, overrides);
    expect(updated.find((r) => r.user.id === 'USR-001')?.ppdUsd).toBe(10);
    expect(updated.find((r) => r.user.id === 'USR-001')?.ppdSource).toBe('role-override');
    expect(updated.find((r) => r.user.id === 'USR-010')?.ppdUsd).toBe(8);
  });
});

describe('roleRates', () => {
  it('reports each role once, with counted patients and no rate invented for the owner', () => {
    const cards = roleRates('HSP-001', NO_OVERRIDES);
    expect(cards.map((c) => c.role).sort()).toEqual([
      'admissions_nurse', 'case_manager', 'director_of_nursing', 'hospice_admin',
    ]);
    const caseManager = cards.find((c) => c.role === 'case_manager')!;
    expect(caseManager.accountCount).toBe(2);
    expect(caseManager.assignedPatients).toBe(13);
    expect(cards.find((c) => c.role === 'hospice_admin')?.defaultPpdUsd).toBeNull();
  });
});

describe('parseRateInput', () => {
  it('accepts partial and valid numbers, rejects everything else', () => {
    expect(parseRateInput('8')).toBe(8);
    expect(parseRateInput('8.')).toBe(8);
    expect(parseRateInput('8.75')).toBe(8.75);
    expect(parseRateInput('0')).toBe(0);
    expect(parseRateInput('')).toBeNull();
    expect(parseRateInput('abc')).toBeNull();
    expect(parseRateInput('-1')).toBeNull();
    expect(parseRateInput('Infinity')).toBeNull();
    expect(parseRateInput('NaN')).toBeNull();
  });
});

describe('sortAccountRows', () => {
  it('sorts by name in both directions', () => {
    expect(sortAccountRows(rows, 'name', 1)[0].user.name).toBe('Bea Cordova');
    expect(sortAccountRows(rows, 'name', -1)[0].user.name).toBe('Marcus Lee');
  });

  it('puts rows with no value last whichever way the column is sorted', () => {
    for (const dir of [1, -1] as const) {
      const sorted = sortAccountRows(rows, 'utilization', dir);
      const nullIds = sorted.filter((r) => r.utilizationPct === null).map((r) => r.user.id);
      const tail = sorted.slice(-nullIds.length).map((r) => r.user.id);
      expect(tail.sort(), `dir ${dir}`).toEqual(nullIds.sort());
    }
  });

  it('ranks status worst-first', () => {
    expect(sortAccountRows(rows, 'status', 1)[0].status).toBe('near');
  });

  it('leaves the source array untouched', () => {
    const before = rows.map((r) => r.user.id);
    sortAccountRows(rows, 'spent', -1);
    expect(rows.map((r) => r.user.id)).toEqual(before);
  });
});
