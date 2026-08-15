/**
 * Budget configuration derivations: what each account is allowed to spend, and what it spent.
 *
 * A department's budget is a flat share of the hospice's total: `role.pctOfBudget x
 * hospice.monthlyBudgetUsd`. Each account in that role gets an even split of the department budget
 * by default — patient caseload is shown for context but no longer drives the cap.
 *
 * Overrides are session-only. Every setter here is pure and returns a new overrides object —
 * nothing is written back to the JSON tables, and the UI marks overridden values as unsaved.
 */

import { getBudgetsForHospice, getHospice, patients, users } from '../data/db';
import { ROLE_LABELS } from './auth';
import { orderExtendedUsd } from './costLedger';
import { getOrdersForHospice } from '../data/db';
import { periodContains, type CostPeriod } from './costPeriod';
import type { User, UserRole } from '../types/domain';

export interface BudgetOverrides {
  /** Session override of the hospice's total monthly budget, in dollars. Null = use the on-file default. */
  totalBudgetUsd: number | null;
  /** Session override of a role's share of the hospice budget, as a 0-1 fraction. */
  rolePct: Partial<Record<UserRole, number>>;
  /** Session override of one account's flat allotted budget, in dollars. */
  accountUsd: Record<string, number>;
}

export const NO_OVERRIDES: BudgetOverrides = { totalBudgetUsd: null, rolePct: {}, accountUsd: {} };

export type BudgetSource = 'role-default' | 'role-override' | 'account-override' | 'none';
export type AccountBudgetStatus = 'no_rate' | 'no_budget' | 'over' | 'near' | 'under';

export interface RoleRateVM {
  role: UserRole;
  label: string;
  /** Null for roles with no budget row — hospice_admin has none in the dataset. */
  defaultPctOfBudget: number | null;
  effectivePctOfBudget: number | null;
  /** effectivePctOfBudget x hospice.monthlyBudgetUsd — this role's flat department budget. */
  departmentBudgetUsd: number | null;
  overridden: boolean;
  accountCount: number;
  assignedPatients: number;
  accountOverrideCount: number;
}

export interface AccountBudgetRow {
  user: User;
  roleLabel: string;
  assignedPatients: number;
  capUsd: number | null;
  budgetSource: BudgetSource;
  spentUsd: number;
  overageUsd: number;
  orderCount: number;
  /** Null when there is no cap to measure against — never Infinity. */
  utilizationPct: number | null;
  status: AccountBudgetStatus;
  note: string | null;
  countsTowardTotals: boolean;
}

export interface HospiceBudgetUsage {
  monthlyBudgetUsd: number;
  monthlyBudgetOverridden: boolean;
  spentUsd: number;
  /** Null when there's no budget to measure against. Can exceed 100 — the caller decides how to show that. */
  utilizationPct: number | null;
  overageUsd: number;
}

export interface AccountTotals {
  assignedPatients: number;
  capUsd: number;
  spentUsd: number;
  utilizationPct: number | null;
  overageUsd: number;
  excludedUserIds: string[];
  excludedReason: string | null;
}

export type AccountSortKey =
  | 'name'
  | 'role'
  | 'patients'
  | 'cap'
  | 'spent'
  | 'utilization'
  | 'status';

const round2 = (n: number): number => Math.round(n * 100) / 100;

const BUDGET_VISIBLE_ROLES: Partial<Record<UserRole, UserRole[]>> = {
  hospice_admin: ['director_of_nursing', 'case_manager', 'field_nurse', 'admissions_nurse'],
  director_of_nursing: ['case_manager', 'field_nurse', 'admissions_nurse'],
};

/** Accepts partial input like "8." while typing; rejects anything not a finite, non-negative number. */
export function parseRateInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function roleDefaultPctOfBudget(hospiceId: string, role: UserRole): number | null {
  const budget = getBudgetsForHospice(hospiceId).find(
    (b) => b.scope === 'role' && b.scopeRef === role,
  );
  return budget?.derivedFrom?.pctOfBudget ?? null;
}

function hospiceStaff(hospiceId: string): User[] {
  return users
    .filter((u) => u.orgType === 'hospice' && u.orgId === hospiceId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every staff member in this role at the hospice — unfiltered by viewer, so a department budget
 *  splits the same way no matter who is looking at it. */
function roleAccountCount(hospiceId: string, role: UserRole): number {
  return hospiceStaff(hospiceId).filter((u) => u.role === role).length;
}

function budgetVisibleRolesFor(viewerRole: UserRole): Set<UserRole> {
  return new Set(BUDGET_VISIBLE_ROLES[viewerRole] ?? []);
}

export function canViewBudgetAccount(viewerRole: UserRole, accountRole: UserRole): boolean {
  return budgetVisibleRolesFor(viewerRole).has(accountRole);
}

function visibleHospiceStaff(hospiceId: string, viewerRole: UserRole): User[] {
  return hospiceStaff(hospiceId).filter((u) => canViewBudgetAccount(viewerRole, u.role));
}

const caseloadSize = (hospiceId: string, userId: string): number =>
  patients.filter((p) => p.hospiceId === hospiceId && p.caseManagerId === userId).length;

/** The hospice's total monthly budget for this session: the override if set, else the on-file default. */
export function effectiveMonthlyBudgetUsd(hospiceId: string, overrides: BudgetOverrides): number {
  return overrides.totalBudgetUsd ?? getHospice(hospiceId)?.monthlyBudgetUsd ?? 0;
}

function departmentBudgetUsdFor(monthlyBudgetUsd: number, pctOfBudget: number): number {
  return round2(monthlyBudgetUsd * pctOfBudget);
}

/** This account's own flat allotted budget: an override if set, else an even split of its role's
 *  department budget across every account in that role. */
export function effectiveAllottedUsd(
  hospiceId: string,
  user: User,
  overrides: BudgetOverrides,
): { capUsd: number | null; source: BudgetSource } {
  const accountOverride = overrides.accountUsd[user.id];
  if (accountOverride !== undefined) return { capUsd: accountOverride, source: 'account-override' };

  const roleOverride = overrides.rolePct[user.role];
  const defaultPct = roleDefaultPctOfBudget(hospiceId, user.role);
  const pctOfBudget = roleOverride ?? defaultPct;
  if (pctOfBudget === null || pctOfBudget === undefined) return { capUsd: null, source: 'none' };

  const departmentBudgetUsd = departmentBudgetUsdFor(effectiveMonthlyBudgetUsd(hospiceId, overrides), pctOfBudget);
  const accountCount = roleAccountCount(hospiceId, user.role);
  const capUsd = accountCount === 0 ? 0 : round2(departmentBudgetUsd / accountCount);
  return { capUsd, source: roleOverride !== undefined ? 'role-override' : 'role-default' };
}

export function buildAccountRows(
  hospiceId: string,
  period: CostPeriod,
  overrides: BudgetOverrides,
  viewerRole?: UserRole,
): AccountBudgetRow[] {
  const periodOrders = getOrdersForHospice(hospiceId).filter((o) =>
    periodContains(period, o.orderedAt),
  );
  const staff = viewerRole === undefined ? hospiceStaff(hospiceId) : visibleHospiceStaff(hospiceId, viewerRole);

  return staff.map((user) => {
    const assignedPatients = caseloadSize(hospiceId, user.id);
    const { capUsd, source } = effectiveAllottedUsd(hospiceId, user, overrides);

    const placed = periodOrders.filter((o) => o.orderedById === user.id);
    const spentUsd = round2(placed.reduce((sum, o) => sum + orderExtendedUsd(o, period), 0));

    const utilizationPct =
      capUsd === null || capUsd === 0 ? null : Math.round((spentUsd / capUsd) * 100);
    const overageUsd = capUsd === null ? 0 : round2(Math.max(0, spentUsd - capUsd));

    let status: AccountBudgetStatus;
    let note: string | null = null;
    if (capUsd === null) {
      status = 'no_rate';
      note = `No role budget configured for ${ROLE_LABELS[user.role]}.`;
    } else if (capUsd === 0) {
      status = 'no_budget';
      note = spentUsd > 0 ? 'Spent against a $0 allotment.' : 'No budget allotted to this account.';
    } else if ((utilizationPct ?? 0) >= 100) {
      status = 'over';
    } else if ((utilizationPct ?? 0) >= 90) {
      status = 'near';
    } else {
      status = 'under';
    }

    return {
      user,
      roleLabel: ROLE_LABELS[user.role],
      assignedPatients,
      capUsd,
      budgetSource: source,
      spentUsd,
      overageUsd,
      orderCount: placed.length,
      utilizationPct,
      status,
      note,
      countsTowardTotals: capUsd !== null && capUsd > 0,
    };
  });
}

export function roleRates(
  hospiceId: string,
  overrides: BudgetOverrides,
  viewerRole?: UserRole,
): RoleRateVM[] {
  const staff = viewerRole === undefined ? hospiceStaff(hospiceId) : visibleHospiceStaff(hospiceId, viewerRole);
  const roles = [...new Set(staff.map((u) => u.role))];

  return roles
    .map((role) => {
      const inRole = staff.filter((u) => u.role === role);
      const defaultPctOfBudget = roleDefaultPctOfBudget(hospiceId, role);
      const roleOverride = overrides.rolePct[role];
      const effectivePctOfBudget = roleOverride ?? defaultPctOfBudget;
      const monthlyBudgetUsd = effectiveMonthlyBudgetUsd(hospiceId, overrides);
      return {
        role,
        label: ROLE_LABELS[role],
        defaultPctOfBudget,
        effectivePctOfBudget,
        departmentBudgetUsd:
          effectivePctOfBudget === null ? null : departmentBudgetUsdFor(monthlyBudgetUsd, effectivePctOfBudget),
        overridden: roleOverride !== undefined,
        accountCount: roleAccountCount(hospiceId, role),
        assignedPatients: inRole.reduce((sum, u) => sum + caseloadSize(hospiceId, u.id), 0),
        accountOverrideCount: inRole.filter((u) => overrides.accountUsd[u.id] !== undefined).length,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Total spend across visible accounts against the hospice's whole monthly budget — not the sum of
 *  role department budgets, which can be less than the total if roles don't allot the full 100%. */
export function hospiceBudgetUsage(
  hospiceId: string,
  rows: AccountBudgetRow[],
  overrides: BudgetOverrides,
): HospiceBudgetUsage {
  const monthlyBudgetUsd = effectiveMonthlyBudgetUsd(hospiceId, overrides);
  const spentUsd = round2(rows.reduce((sum, r) => sum + r.spentUsd, 0));
  return {
    monthlyBudgetUsd,
    monthlyBudgetOverridden: overrides.totalBudgetUsd !== null,
    spentUsd,
    utilizationPct: monthlyBudgetUsd === 0 ? null : Math.round((spentUsd / monthlyBudgetUsd) * 100),
    overageUsd: round2(Math.max(0, spentUsd - monthlyBudgetUsd)),
  };
}

export function accountTotals(rows: AccountBudgetRow[]): AccountTotals {
  const counted = rows.filter((r) => r.countsTowardTotals);
  const excluded = rows.filter((r) => !r.countsTowardTotals);
  const capUsd = round2(counted.reduce((sum, r) => sum + (r.capUsd ?? 0), 0));
  const spentUsd = round2(rows.reduce((sum, r) => sum + r.spentUsd, 0));

  return {
    assignedPatients: rows.reduce((sum, r) => sum + r.assignedPatients, 0),
    capUsd,
    spentUsd,
    overageUsd: round2(Math.max(0, spentUsd - capUsd)),
    utilizationPct: capUsd === 0 ? null : Math.round((spentUsd / capUsd) * 100),
    excludedUserIds: excluded.map((r) => r.user.id),
    excludedReason:
      excluded.length === 0
        ? null
        : `${excluded.length} account${excluded.length === 1 ? '' : 's'} excluded — no derived cap.`,
  };
}

const STATUS_RANK: Record<AccountBudgetStatus, number> = {
  over: 0,
  near: 1,
  under: 2,
  no_budget: 3,
  no_rate: 4,
};

/** Nulls sort last in both directions — an unset cap is not "the smallest cap". */
export function sortAccountRows(
  rows: AccountBudgetRow[],
  key: AccountSortKey,
  dir: 1 | -1,
): AccountBudgetRow[] {
  const numeric = (row: AccountBudgetRow): number | null => {
    switch (key) {
      case 'patients':
        return row.assignedPatients;
      case 'cap':
        return row.capUsd;
      case 'spent':
        return row.spentUsd;
      case 'utilization':
        return row.utilizationPct;
      case 'status':
        return STATUS_RANK[row.status];
      default:
        return null;
    }
  };

  return [...rows].sort((a, b) => {
    if (key === 'name') return dir * a.user.name.localeCompare(b.user.name);
    if (key === 'role') return dir * a.roleLabel.localeCompare(b.roleLabel) || a.user.name.localeCompare(b.user.name);

    const av = numeric(a);
    const bv = numeric(b);
    if (av === null && bv === null) return a.user.name.localeCompare(b.user.name);
    if (av === null) return 1;
    if (bv === null) return -1;
    return dir * (av - bv) || a.user.name.localeCompare(b.user.name);
  });
}

/** Setting the total back to the hospice's on-file default clears the override rather than pinning it. */
export function setTotalBudgetOverride(
  overrides: BudgetOverrides,
  value: number | null,
  hospiceDefaultUsd: number,
): BudgetOverrides {
  return {
    totalBudgetUsd: value === null || value === hospiceDefaultUsd ? null : value,
    rolePct: { ...overrides.rolePct },
    accountUsd: { ...overrides.accountUsd },
  };
}

export function setRolePctOverride(
  overrides: BudgetOverrides,
  role: UserRole,
  value: number | null,
): BudgetOverrides {
  const rolePct = { ...overrides.rolePct };
  if (value === null) delete rolePct[role];
  else rolePct[role] = value;
  return { totalBudgetUsd: overrides.totalBudgetUsd, rolePct, accountUsd: { ...overrides.accountUsd } };
}

/** Setting an account back to its role-derived default clears the override rather than pinning it. */
export function setAccountAllottedOverride(
  overrides: BudgetOverrides,
  userId: string,
  value: number | null,
  roleDefaultUsd: number | null,
): BudgetOverrides {
  const accountUsd = { ...overrides.accountUsd };
  if (value === null || value === roleDefaultUsd) delete accountUsd[userId];
  else accountUsd[userId] = value;
  return { totalBudgetUsd: overrides.totalBudgetUsd, rolePct: { ...overrides.rolePct }, accountUsd };
}
