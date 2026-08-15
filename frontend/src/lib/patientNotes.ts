import { getPatient, getUser } from '../data/db';
import type { PatientNote } from '../types/domain';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsPatientName(body: string, firstName: string, lastName: string): boolean {
  const names = [firstName, lastName, `${firstName} ${lastName}`];
  return names.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(body));
}

function validateNoteText(text: string, patientId: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const patient = getPatient(patientId);
  if (patient && containsPatientName(trimmed, patient.firstName, patient.lastName)) {
    return 'Notes cannot include the patient\'s name — refer to them as "patient" or "family".';
  }

  return null;
}

/** Returns an error message when the note breaks chart privacy rules; otherwise null. */
export function validatePatientNote(title: string, body: string, patientId: string): string | null {
  if (!title.trim()) return 'Enter a title before saving.';
  if (!body.trim()) return 'Enter a note before saving.';

  return validateNoteText(title, patientId) ?? validateNoteText(body, patientId);
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

/** Date-only label for sticky-note footers. */
export function formatNoteDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function createSessionPatientNote(
  patientId: string,
  authorId: string,
  title: string,
  body: string,
): PatientNote {
  const createdAt = new Date().toISOString().slice(0, 19) + '-06:00';
  return {
    id: `PN-S-${Date.now()}`,
    patientId,
    authorId,
    title: title.trim(),
    body: body.trim(),
    date: createdAt.slice(0, 10),
    createdAt,
  };
}

/** Blank note used by the compose overlay before saving. */
export function createDraftPatientNote(patientId: string, authorId: string): PatientNote {
  const createdAt = new Date().toISOString().slice(0, 19) + '-06:00';
  return {
    id: 'draft',
    patientId,
    authorId,
    title: '',
    body: '',
    date: createdAt.slice(0, 10),
    createdAt,
  };
}
