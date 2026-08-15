/**
 * Pure helpers for the Director of Nursing's nurse-assignment view.
 *
 * The patient→nurse link is patient.caseManagerId in the mock DB. Since the JSON is read-only at
 * runtime, reassignments made in the demo are held as overrides in localStorage and merged over the
 * seed data — honest about being browser-local, but they survive a reload so the demo feels real.
 */

import { patients, users } from '../data/db';
import type { Patient, PatientStatus, User, UserRole } from '../types/domain';

/** Roles that carry a patient caseload — the nurses a DON can assign patients to. */
const ASSIGNABLE_ROLES: UserRole[] = ['case_manager', 'field_nurse', 'admissions_nurse'];

/** Deceased and discharged patients no longer need a nurse assigned. */
const ASSIGNABLE_STATUSES: PatientStatus[] = ['active', 'pending_discharge'];

/** Maps a patient id to the nurse (user id) assigned to it. */
export type AssignmentMap = Record<string, string>;

export function getAssignableNurses(hospiceId: string): User[] {
  return users()
    .filter((u) => u.orgId === hospiceId && ASSIGNABLE_ROLES.includes(u.role))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getAssignablePatients(hospiceId: string): Patient[] {
  return patients()
    .filter((p) => p.hospiceId === hospiceId && ASSIGNABLE_STATUSES.includes(p.status))
    .slice()
    .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}

/** Live patient count per nurse id, from the current assignment map. */
export function countByNurse(assignments: AssignmentMap): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const nurseId of Object.values(assignments)) {
    counts[nurseId] = (counts[nurseId] ?? 0) + 1;
  }
  return counts;
}

const OVERRIDES_KEY = 'bestrx.nurseAssignments';

/** Browser-local reassignments, keyed by patient id. localStorage may be unavailable (private mode). */
export function readAssignmentOverrides(): AssignmentMap {
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as AssignmentMap) : {};
  } catch {
    return {};
  }
}

export function writeAssignmentOverrides(overrides: AssignmentMap): void {
  try {
    window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // Reassignments just won't survive a reload.
  }
}
