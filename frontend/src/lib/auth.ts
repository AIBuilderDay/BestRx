/**
 * Fake auth for the demo — see docs/PROJECT_DESCRIPTION.md §3 and §7 P0
 * ("Login and permissions. Role determines which views you get. Fake auth is fine.").
 *
 * Permissions derive from role here rather than living per-user in users.json, so there is a
 * single source of truth. The sets mirror mockups/login.html, which scaled them down from the
 * owner per docs/bounty/BRIEFING_NOTES.md ("The users").
 */

import { users } from '../data/db';
import type { User, UserRole } from '../types/domain';

export type Permission =
  | 'storefront:purchase'
  | 'orders:own'
  | 'orders:own-patients'
  | 'orders:all'
  | 'notes'
  | 'pickup:trigger'
  | 'approvals:high-cost'
  | 'reporting'
  | 'nurse-assignment'
  | 'budgets:configure'
  | 'vendors:manage';

export const DEMO_PASSWORD = 'demo';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  hospice_admin: [
    'storefront:purchase',
    'orders:all',
    'pickup:trigger',
    'approvals:high-cost',
    'reporting',
    'nurse-assignment',
    'budgets:configure',
    'vendors:manage',
  ],
  director_of_nursing: [
    'storefront:purchase',
    'orders:all',
    'pickup:trigger',
    'approvals:high-cost',
    'reporting',
    'nurse-assignment',
  ],
  case_manager: ['storefront:purchase', 'orders:own-patients', 'notes', 'pickup:trigger'],
  // Field nurses share the case manager's job in the field — see PROJECT_DESCRIPTION §3.
  field_nurse: ['storefront:purchase', 'orders:own-patients', 'notes', 'pickup:trigger'],
  admissions_nurse: ['storefront:purchase', 'orders:own', 'orders:own-patients', 'notes'],
  // Vendors never log in — they respond to text/email links (PROJECT_DESCRIPTION §3).
  vendor_dispatcher: [],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  hospice_admin: 'Owner',
  director_of_nursing: 'Director of Nursing',
  case_manager: 'Case Manager',
  field_nurse: 'Field Nurse',
  admissions_nurse: 'Admissions Nurse',
  vendor_dispatcher: 'Vendor Dispatcher',
};

export const permissionsFor = (user: User): Permission[] => ROLE_PERMISSIONS[user.role] ?? [];

export const can = (user: User | null, permission: Permission): boolean =>
  user !== null && permissionsFor(user).includes(permission);

/** Vendor-wide scorecard ratings — not shown on the catalog. DON and hospice owner only. */
export const canViewVendorScorecard = (user: User | null): boolean => can(user, 'reporting');

export const findUserByEmail = (email: string): User | undefined => {
  const needle = email.trim().toLowerCase();
  return needle === '' ? undefined : users().find((u) => u.email.toLowerCase() === needle);
};

/** The accounts offered as one-click sign-ins on the login page: Sample Hospice A, senior first. */
export const DEMO_ACCOUNT_IDS = ['USR-013', 'USR-012', 'USR-001', 'USR-010'];

const SESSION_KEY = 'bestrx.sessionUserId';

/** localStorage can be unavailable (private mode); treat failures as "signed out". */
export const readSession = (): User | null => {
  try {
    const id = window.localStorage.getItem(SESSION_KEY);
    return id ? (users().find((u) => u.id === id) ?? null) : null;
  } catch {
    return null;
  }
};

export const writeSession = (userId: string | null): void => {
  try {
    if (userId === null) window.localStorage.removeItem(SESSION_KEY);
    else window.localStorage.setItem(SESSION_KEY, userId);
  } catch {
    // Session just won't survive a refresh.
  }
};
