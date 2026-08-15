import { describe, expect, it } from 'vitest';
import {
  accountTotals,
  buildAccountRows,
  canViewBudgetAccount,
  hospiceBudgetUsage,
  NO_OVERRIDES,
  parseRateInput,
  roleRates,
  setAccountAllottedOverride,
  setRolePctOverride,
  setTotalBudgetOverride,
  sortAccountRows,
} from './budgetLedger';
import { getPeriod } from './costPeriod';

const period = getPeriod('aug-2026');
const rows = buildAccountRows('HSP-001', period, NO_OVERRIDES);
const rowFor = (id: string) => rows.find((r) => r.user.id === id)!;

// HSP-001: monthlyBudgetUsd $40,000. admissions_nurse 30% ($12,000, 1 account), case_manager 20%
// ($8,000, 2 accounts -> $4,000 each), director_of_nursing 50% ($20,000, 1 account).

describe('buildAccountRows', () => {
  it('lists every hospice account, including those carrying no patients', () => {
    expect(rows.map((r) => r.user.id).sort()).toEqual([
      'USR-001', 'USR-002', 'USR-010', 'USR-012', 'USR-013',
    ]);
  });

  it('derives a cap from the role\'s share of the hospice budget, split evenly across its accounts', () => {
    const dana = rowFor('USR-001'); // case_manager, one of two accounts in the role
    expect(dana.assignedPatients).toBe(13);
    expect(dana.capUsd).toBeCloseTo(4000, 2);
    expect(dana.spentUsd).toBeCloseTo(6530, 2);
    expect(dana.status).toBe('over');
  });

  it('flags an account that has blown through its cap', () => {
    const bea = rowFor('USR-010'); // admissions_nurse, sole account in the role
    expect(bea.capUsd).toBeCloseTo(12000, 2);
    expect(bea.spentUsd).toBeCloseTo(8857.5, 2);
    expect(bea.status).toBe('under');
  });

  it('still allots an account its role-derived share even with no caseload — patients no longer drive the cap', () => {
    const marcus = rowFor('USR-002'); // case_manager, the other of two accounts in the role
    expect(marcus.assignedPatients).toBe(0);
    expect(marcus.capUsd).toBeCloseTo(4000, 2);
    expect(marcus.spentUsd).toBeCloseTo(192.5, 2);
    expect(marcus.status).toBe('under');
    expect(marcus.countsTowardTotals).toBe(true);
  });

  it('leaves a role with no budget row uncapped rather than guessing zero', () => {
    const grant = rowFor('USR-013'); // hospice_admin — no budget row in the dataset
    expect(grant.capUsd).toBeNull();
    expect(grant.utilizationPct).toBeNull();
    expect(grant.status).toBe('no_rate');
    expect(grant.note).toContain('No role budget configured');
  });

  it('shows the owner every hospice account below owner, excluding owner accounts', () => {
    const ownerRows = buildAccountRows('HSP-001', period, NO_OVERRIDES, 'hospice_admin');
    expect(ownerRows.map((r) => r.user.id).sort()).toEqual([
      'USR-001', 'USR-002', 'USR-010', 'USR-012',
    ]);
    expect(ownerRows.some((r) => r.user.role === 'hospice_admin')).toBe(false);
  });

  it('shows the director the full budget, including her own row and the owner\'s', () => {
    const directorRows = buildAccountRows('HSP-001', period, NO_OVERRIDES, 'director_of_nursing');
    expect(directorRows.map((r) => r.user.id).sort()).toEqual([
      'USR-001', 'USR-002', 'USR-010', 'USR-012', 'USR-013',
    ]);
    expect(directorRows.some((r) => r.user.role === 'hospice_admin')).toBe(true);
    expect(directorRows.some((r) => r.user.role === 'director_of_nursing')).toBe(true);
  });
});

describe('accountTotals', () => {
  it('sums only rows with a real cap, and names the exclusions', () => {
    const totals = accountTotals(rows);
    expect(totals.capUsd).toBeCloseTo(4000 + 12000 + 4000 + 20000, 2);
    expect(totals.spentUsd).toBeCloseTo(15580, 2);
    expect(totals.excludedUserIds).toEqual(['USR-013']);
    expect(totals.excludedReason).toContain('1 account excluded');
  });
});

describe('overrides', () => {
  it('applies an account override over the role-derived default', () => {
    const overrides = setAccountAllottedOverride(NO_OVERRIDES, 'USR-001', 5000, 4000);
    const dana = buildAccountRows('HSP-001', period, overrides).find((r) => r.user.id === 'USR-001')!;
    expect(dana.capUsd).toBe(5000);
    expect(dana.budgetSource).toBe('account-override');
  });

  it('clears an account override set back to the role-derived default', () => {
    const applied = setAccountAllottedOverride(NO_OVERRIDES, 'USR-001', 5000, 4000);
    const cleared = setAccountAllottedOverride(applied, 'USR-001', 4000, 4000);
    expect(cleared.accountUsd['USR-001']).toBeUndefined();
  });

  it('never mutates the overrides handed to it', () => {
    const before = JSON.stringify(NO_OVERRIDES);
    setRolePctOverride(NO_OVERRIDES, 'case_manager', 0.25);
    setAccountAllottedOverride(NO_OVERRIDES, 'USR-001', 5000, 4000);
    expect(JSON.stringify(NO_OVERRIDES)).toBe(before);
  });

  it('lets a role override move every account in that role', () => {
    const overrides = setRolePctOverride(NO_OVERRIDES, 'case_manager', 0.25); // $10,000 dept / 2
    const updated = buildAccountRows('HSP-001', period, overrides);
    expect(updated.find((r) => r.user.id === 'USR-001')?.capUsd).toBeCloseTo(5000, 2);
    expect(updated.find((r) => r.user.id === 'USR-001')?.budgetSource).toBe('role-override');
    expect(updated.find((r) => r.user.id === 'USR-010')?.capUsd).toBeCloseTo(12000, 2); // untouched
  });
});

describe('hospiceBudgetUsage', () => {
  it('measures total spend against the whole hospice budget, not the sum of department budgets', () => {
    const usage = hospiceBudgetUsage('HSP-001', rows, NO_OVERRIDES);
    expect(usage.monthlyBudgetUsd).toBe(40000);
    expect(usage.monthlyBudgetOverridden).toBe(false);
    expect(usage.spentUsd).toBeCloseTo(15580, 2);
    expect(usage.utilizationPct).toBe(39);
    expect(usage.overageUsd).toBe(0);
  });

  it('reports over-100% usage and the overage dollars once total spend clears the total budget', () => {
    const overrides = setTotalBudgetOverride(NO_OVERRIDES, 10000, 40000);
    const usage = hospiceBudgetUsage('HSP-001', rows, overrides);
    expect(usage.monthlyBudgetOverridden).toBe(true);
    expect(usage.utilizationPct).toBe(156); // round(15580 / 10000 * 100)
    expect(usage.overageUsd).toBeCloseTo(5580, 2);
  });

  it('clears the override when set back to the hospice default', () => {
    const applied = setTotalBudgetOverride(NO_OVERRIDES, 10000, 40000);
    const cleared = setTotalBudgetOverride(applied, 40000, 40000);
    expect(cleared.totalBudgetUsd).toBeNull();
  });

  it('never reports a utilization when there is no budget to measure against', () => {
    const overrides = setTotalBudgetOverride(NO_OVERRIDES, 0, 40000);
    const usage = hospiceBudgetUsage('HSP-001', rows, overrides);
    expect(usage.utilizationPct).toBeNull();
  });
});

describe('roleRates', () => {
  it('reports each role once, with the department budget derived from its share', () => {
    const cards = roleRates('HSP-001', NO_OVERRIDES);
    expect(cards.map((c) => c.role).sort()).toEqual([
      'admissions_nurse', 'case_manager', 'director_of_nursing', 'hospice_admin',
    ]);
    const caseManager = cards.find((c) => c.role === 'case_manager')!;
    expect(caseManager.accountCount).toBe(2);
    expect(caseManager.assignedPatients).toBe(13);
    expect(caseManager.defaultPctOfBudget).toBeCloseTo(0.2, 6);
    expect(caseManager.departmentBudgetUsd).toBeCloseTo(8000, 2);
    expect(cards.find((c) => c.role === 'hospice_admin')?.defaultPctOfBudget).toBeNull();
    expect(cards.find((c) => c.role === 'hospice_admin')?.departmentBudgetUsd).toBeNull();
  });

  it('uses the same role visibility as the account table', () => {
    expect(roleRates('HSP-001', NO_OVERRIDES, 'hospice_admin').map((c) => c.role).sort()).toEqual([
      'admissions_nurse', 'case_manager', 'director_of_nursing',
    ]);
    expect(roleRates('HSP-001', NO_OVERRIDES, 'director_of_nursing').map((c) => c.role).sort()).toEqual([
      'admissions_nurse', 'case_manager', 'director_of_nursing', 'hospice_admin',
    ]);
  });
});

describe('canViewBudgetAccount', () => {
  it('gives the owner every subordinate role, and the director the full budget', () => {
    expect(canViewBudgetAccount('hospice_admin', 'hospice_admin')).toBe(false);
    expect(canViewBudgetAccount('hospice_admin', 'director_of_nursing')).toBe(true);
    expect(canViewBudgetAccount('director_of_nursing', 'hospice_admin')).toBe(true);
    expect(canViewBudgetAccount('director_of_nursing', 'director_of_nursing')).toBe(true);
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
