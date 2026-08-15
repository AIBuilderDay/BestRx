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

/** Newest first — the order the chart reads in, and the order the API returns notes in. */
export function sortNotes(notes: PatientNote[]): PatientNote[] {
  return [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function noteAuthorLabel(authorId: string): string {
  const user = getUser(authorId);
  if (!user) return 'Care team';
  return user.name.split(' ')[0];
}

/** Date and time for a note footer, read in the dataset's own zone.
 *
 * The fixtures are Mountain time (docs/DATA_MODEL.md), and the wall-clock reading is the fact a
 * nurse cares about — "9:15 AM" is when the family was called. Handing the string to `new Date`
 * and formatting it locally would re-render that 9:15 as 11:15 for a reader in New York and roll
 * it to the next day in Tokyo, so the parts are read straight off the string instead.
 */
export function formatNoteTimestamp(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  const hour24 = Number(iso.slice(11, 13));
  const minute = iso.slice(14, 16);

  if (!year || !month || !day || Number.isNaN(hour24) || !minute) return formatNoteDate(iso);

  const date = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return `${date}, ${hour12}:${minute} ${suffix}`;
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

/** Blank note used by the compose overlay before saving. The API assigns the real id and time. */
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
