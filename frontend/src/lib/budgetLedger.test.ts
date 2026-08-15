import { describe, expect, it } from 'vitest';
import {
  accountTotals,
  buildAccountRows,
  canViewBudgetAccount,
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
    expect(dana.spentUsd).toBeCloseTo(6530, 2);
    expect(dana.status).toBe('over');
  });

  it('flags an account that has blown through its cap', () => {
    const bea = rowFor('USR-010');
    expect(bea.capUsd).toBeCloseTo(8 * 12 * 31, 2);
    expect(bea.utilizationPct).toBe(298);
    expect(bea.status).toBe('over');
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

  it('shows the owner every hospice account below owner, excluding owner accounts', () => {
    const ownerRows = buildAccountRows('HSP-001', period, NO_OVERRIDES, 'hospice_admin');
    expect(ownerRows.map((r) => r.user.id).sort()).toEqual([
      'USR-001', 'USR-002', 'USR-010', 'USR-012',
    ]);
    expect(ownerRows.some((r) => r.user.role === 'hospice_admin')).toBe(false);
  });

  it('shows directors only case managers, field nurses, and admissions nurses', () => {
    const directorRows = buildAccountRows('HSP-001', period, NO_OVERRIDES, 'director_of_nursing');
    expect(directorRows.map((r) => r.user.id).sort()).toEqual([
      'USR-001', 'USR-002', 'USR-010',
    ]);
    expect(directorRows.some((r) => r.user.role === 'hospice_admin')).toBe(false);
    expect(directorRows.some((r) => r.user.role === 'director_of_nursing')).toBe(false);
  });
});

describe('accountTotals', () => {
  it('sums only rows with a real cap, and names the exclusions', () => {
    const totals = accountTotals(rows);
    expect(totals.capUsd).toBeCloseTo(6200, 2);
    expect(totals.spentUsd).toBeCloseTo(15578, 2);
    expect(totals.utilizationPct).toBe(251);
    expect(totals.overageUsd).toBeCloseTo(9378, 2);
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

  it('uses the same role visibility as the account table', () => {
    expect(roleRates('HSP-001', NO_OVERRIDES, 'hospice_admin').map((c) => c.role).sort()).toEqual([
      'admissions_nurse', 'case_manager', 'director_of_nursing',
    ]);
    expect(roleRates('HSP-001', NO_OVERRIDES, 'director_of_nursing').map((c) => c.role).sort()).toEqual([
      'admissions_nurse', 'case_manager',
    ]);
  });
});

describe('canViewBudgetAccount', () => {
  it('allows only subordinate budget roles for reporting users', () => {
    expect(canViewBudgetAccount('hospice_admin', 'hospice_admin')).toBe(false);
    expect(canViewBudgetAccount('hospice_admin', 'director_of_nursing')).toBe(true);
    expect(canViewBudgetAccount('director_of_nursing', 'hospice_admin')).toBe(false);
    expect(canViewBudgetAccount('director_of_nursing', 'director_of_nursing')).toBe(false);
    expect(canViewBudgetAccount('director_of_nursing', 'case_manager')).toBe(true);
    expect(canViewBudgetAccount('director_of_nursing', 'admissions_nurse')).toBe(true);
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
    expect(sortAccountRows(rows, 'status', 1)[0].status).toBe('over');
  });

  it('leaves the source array untouched', () => {
    const before = rows.map((r) => r.user.id);
    sortAccountRows(rows, 'spent', -1);
    expect(rows.map((r) => r.user.id)).toEqual(before);
  });
});
