/**
 * Budget configuration derivations: what each account is allowed to spend, and what it spent.
 *
 * A cap is never a flat number someone guessed — it is `PPD allowance x assigned patients x days`.
 * The PPD allowance comes from the role's budget row; the patient count is counted from the
 * caseload rather than read from `budgets.derivedFrom.assignedPatients`, because those two
 * disagree in the dataset (the budget rows claim 48/24/70 against real caseloads of 12/13/0) and
 * the caseload is the figure a director of nursing can actually verify.
 *
 * Rate edits are session-only. Every setter here is pure and returns a new overrides object —
 * nothing is written back to the JSON tables, and the UI marks overridden values as unsaved.
 */

import { budgetCapUsd, getBudgetsForHospice, patients, users } from '../data/db';
import { ROLE_LABELS } from './auth';
import { orderExtendedUsd } from './costLedger';
import { getOrdersForHospice } from '../data/db';
import { periodContains, type CostPeriod } from './costPeriod';
import type { User, UserRole } from '../types/domain';

export interface PpdOverrides {
  roles: Partial<Record<UserRole, number>>;
  accounts: Record<string, number>;
}

export const NO_OVERRIDES: PpdOverrides = { roles: {}, accounts: {} };

export type PpdSource = 'role-default' | 'role-override' | 'account-override' | 'none';
export type AccountBudgetStatus = 'no_rate' | 'no_caseload' | 'over' | 'near' | 'under';

export interface RoleRateVM {
  role: UserRole;
  label: string;
  /** Null for roles with no budget row — hospice_admin has none in the dataset. */
  defaultPpdUsd: number | null;
  effectivePpdUsd: number | null;
  overridden: boolean;
  accountCount: number;
  assignedPatients: number;
  accountOverrideCount: number;
}

export interface AccountBudgetRow {
  user: User;
  roleLabel: string;
  assignedPatients: number;
  ppdUsd: number | null;
  ppdSource: PpdSource;
  capUsd: number | null;
  spentUsd: number;
  overageUsd: number;
  orderCount: number;
  /** Null when there is no cap to measure against — never Infinity. */
  utilizationPct: number | null;
  status: AccountBudgetStatus;
  note: string | null;
  countsTowardTotals: boolean;
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
  | 'ppd'
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

function roleDefaultPpd(hospiceId: string, role: UserRole): number | null {
  const budget = getBudgetsForHospice(hospiceId).find(
    (b) => b.scope === 'role' && b.scopeRef === role,
  );
  return budget?.derivedFrom?.ppdUsd ?? null;
}

function hospiceStaff(hospiceId: string): User[] {
  return users
    .filter((u) => u.orgType === 'hospice' && u.orgId === hospiceId)
    .sort((a, b) => a.name.localeCompare(b.name));
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

export function effectivePpdFor(
  hospiceId: string,
  user: User,
  overrides: PpdOverrides,
): { ppdUsd: number | null; source: PpdSource } {
  const accountOverride = overrides.accounts[user.id];
  if (accountOverride !== undefined) return { ppdUsd: accountOverride, source: 'account-override' };

  const roleOverride = overrides.roles[user.role];
  if (roleOverride !== undefined) return { ppdUsd: roleOverride, source: 'role-override' };

  const roleDefault = roleDefaultPpd(hospiceId, user.role);
  return roleDefault === null
    ? { ppdUsd: null, source: 'none' }
    : { ppdUsd: roleDefault, source: 'role-default' };
}

export function buildAccountRows(
  hospiceId: string,
  period: CostPeriod,
  overrides: PpdOverrides,
  viewerRole?: UserRole,
): AccountBudgetRow[] {
  const periodOrders = getOrdersForHospice(hospiceId).filter((o) =>
    periodContains(period, o.orderedAt),
  );
  const staff = viewerRole === undefined ? hospiceStaff(hospiceId) : visibleHospiceStaff(hospiceId, viewerRole);

  return staff.map((user) => {
    const assignedPatients = caseloadSize(hospiceId, user.id);
    const { ppdUsd, source } = effectivePpdFor(hospiceId, user, overrides);

    const placed = periodOrders.filter((o) => o.orderedById === user.id);
    const spentUsd = round2(placed.reduce((sum, o) => sum + orderExtendedUsd(o, period), 0));

    const capUsd =
      ppdUsd === null
        ? null
        : round2(
            budgetCapUsd({
              id: `derived-${user.id}`,
              hospiceId,
              scope: 'role',
              scopeRef: user.role,
              period: period.key,
              limitUsd: 0,
              spentUsd,
              setById: null,
              derivedFrom: { ppdUsd, assignedPatients, days: period.days },
            }),
          );

    const utilizationPct =
      capUsd === null || capUsd === 0 ? null : Math.round((spentUsd / capUsd) * 100);
    const overageUsd = capUsd === null ? 0 : round2(Math.max(0, spentUsd - capUsd));

    let status: AccountBudgetStatus;
    let note: string | null = null;
    if (ppdUsd === null) {
      status = 'no_rate';
      note = `No role budget configured for ${ROLE_LABELS[user.role]}.`;
    } else if (assignedPatients === 0) {
      status = 'no_caseload';
      note =
        spentUsd > 0
          ? 'Spent against a $0 cap — no patients assigned.'
          : 'No patients assigned, so no cap is derived.';
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
      ppdUsd,
      ppdSource: source,
      capUsd,
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
  overrides: PpdOverrides,
  viewerRole?: UserRole,
): RoleRateVM[] {
  const staff = viewerRole === undefined ? hospiceStaff(hospiceId) : visibleHospiceStaff(hospiceId, viewerRole);
  const roles = [...new Set(staff.map((u) => u.role))];

  return roles
    .map((role) => {
      const inRole = staff.filter((u) => u.role === role);
      const defaultPpdUsd = roleDefaultPpd(hospiceId, role);
      const roleOverride = overrides.roles[role];
      return {
        role,
        label: ROLE_LABELS[role],
        defaultPpdUsd,
        effectivePpdUsd: roleOverride ?? defaultPpdUsd,
        overridden: roleOverride !== undefined,
        accountCount: inRole.length,
        assignedPatients: inRole.reduce((sum, u) => sum + caseloadSize(hospiceId, u.id), 0),
        accountOverrideCount: inRole.filter((u) => overrides.accounts[u.id] !== undefined).length,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
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
  no_caseload: 3,
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
      case 'ppd':
        return row.ppdUsd;
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

export function setRoleOverride(
  overrides: PpdOverrides,
  role: UserRole,
  value: number | null,
): PpdOverrides {
  const roles = { ...overrides.roles };
  if (value === null) delete roles[role];
  else roles[role] = value;
  return { roles, accounts: { ...overrides.accounts } };
}

/** Setting an account back to its role default clears the override rather than pinning it. */
export function setAccountOverride(
  overrides: PpdOverrides,
  userId: string,
  value: number | null,
  roleDefault: number | null,
): PpdOverrides {
  const accounts = { ...overrides.accounts };
  if (value === null || value === roleDefault) delete accounts[userId];
  else accounts[userId] = value;
  return { roles: { ...overrides.roles }, accounts };
}
