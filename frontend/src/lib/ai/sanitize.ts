/**
 * What the model is allowed to know.
 *
 * Nothing that identifies a patient leaves the app: no full name, no DOB, no
 * street address. The model gets clinical context (diagnosis, status, timing),
 * a coarse location (ZIP only — enough to reason about delivery distance), an
 * age instead of a birthday, and a short display label ("Harold B.") so an
 * order confirmation can be read back to the nurse. Data here is synthetic,
 * but we sanitize as if it were real — that is part of the pitch.
 */

import type { Patient } from '../../types/domain';
import { DATASET_NOW } from '../catalog';

export interface SanitizedPatient {
  id: string;
  /** First name + last initial, e.g. "Harold B." — for read-back, not identification. */
  label: string;
  ageYears: number | null;
  gender: string;
  diagnosis: string;
  status: Patient['status'];
  /** Present only when a discharge is scheduled — the delivery deadline that matters. */
  dischargeAt?: string;
  zip: string;
}

export function sanitizePatient(patient: Patient): SanitizedPatient {
  const sanitized: SanitizedPatient = {
    id: patient.id,
    label: `${patient.firstName} ${patient.lastName.charAt(0)}.`,
    ageYears: ageInYears(patient.dob),
    gender: patient.gender,
    diagnosis: patient.primaryDiagnosis.description,
    status: patient.status,
    zip: patient.address.zip,
  };
  if (patient.dischargeAt) sanitized.dischargeAt = patient.dischargeAt;
  return sanitized;
}

function ageInYears(dob: string): number | null {
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const ms = DATASET_NOW.getTime() - born.getTime();
  return Math.max(0, Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000)));
}

/**
 * Deterministic, client-side patient mention detection — names never go to the
 * model for matching. Finds patients whose first or last name appears as a
 * whole word in the text. Empty result means "no patient context".
 */
export function findMentionedPatients(text: string, pool: Patient[]): Patient[] {
  const words = new Set(
    text
      .toLowerCase()
      .split(/[^a-zà-ÿ'-]+/i)
      .filter((w) => w.length >= 3),
  );
  return pool.filter(
    (p) => words.has(p.firstName.toLowerCase()) || words.has(p.lastName.toLowerCase()),
  );
}
