import { getPatient, getUser } from '../data/db';
import type { PatientNote } from '../types/domain';

/** PPI, PII, PHI, and similar protected-identifier tokens. */
const PROTECTED_ID_PATTERN = /\b(?:PPI|PII|PHI)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsPatientName(body: string, firstName: string, lastName: string): boolean {
  const names = [firstName, lastName, `${firstName} ${lastName}`];
  return names.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(body));
}

/** Returns an error message when the note breaks chart privacy rules; otherwise null. */
export function validatePatientNote(body: string, patientId: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return 'Enter a note before saving.';

  if (PROTECTED_ID_PATTERN.test(trimmed)) {
    return 'Notes cannot include PPI, PII, or PHI.';
  }

  const patient = getPatient(patientId);
  if (patient && containsPatientName(trimmed, patient.firstName, patient.lastName)) {
    return 'Notes cannot include the patient\'s name — refer to them as "patient" or "family".';
  }

  return null;
}

export function notesForPatient(patientId: string, stored: PatientNote[], session: PatientNote[] = []): PatientNote[] {
  const sessionForPatient = session.filter((n) => n.patientId === patientId);
  return [...sessionForPatient, ...stored.filter((n) => n.patientId === patientId)].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function noteAuthorLabel(authorId: string): string {
  const user = getUser(authorId);
  if (!user) return 'Care team';
  return user.name.split(' ')[0];
}

export function formatNoteTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function createSessionPatientNote(patientId: string, authorId: string, body: string): PatientNote {
  return {
    id: `PN-S-${Date.now()}`,
    patientId,
    authorId,
    body: body.trim(),
    createdAt: new Date().toISOString().slice(0, 19) + '-06:00',
  };
}
