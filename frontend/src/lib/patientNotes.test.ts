import { describe, expect, it } from 'vitest';
import {
  createDraftPatientNote,
  formatNoteDate,
  formatNoteTimestamp,
  sortNotes,
  validatePatientNote,
} from './patientNotes';
import type { PatientNote } from '../types/domain';

describe('formatNoteDate', () => {
  it('formats an ISO date as a short date', () => {
    expect(formatNoteDate('2026-08-10')).toBe('Aug 10, 2026');
  });
});

describe('formatNoteTimestamp', () => {
  it('includes the time of day, not just the date', () => {
    expect(formatNoteTimestamp('2026-08-10T09:15:00-06:00')).toBe('Aug 10, 2026, 9:15 AM');
  });

  it('reads the wall clock in the dataset zone, whatever the viewer is in', () => {
    // Formatting via `new Date` would show 11:15 AM in New York and Aug 11 in Tokyo.
    expect(formatNoteTimestamp('2026-08-10T09:15:00-06:00')).toContain('9:15 AM');
    expect(formatNoteTimestamp('2026-08-10T23:40:00-06:00')).toBe('Aug 10, 2026, 11:40 PM');
  });

  it('handles noon and midnight', () => {
    expect(formatNoteTimestamp('2026-08-10T00:05:00-06:00')).toContain('12:05 AM');
    expect(formatNoteTimestamp('2026-08-10T12:00:00-06:00')).toContain('12:00 PM');
  });

  it('falls back to the date when there is no time part', () => {
    expect(formatNoteTimestamp('2026-08-10')).toBe('Aug 10, 2026');
  });

  it('formats a note written just now', () => {
    const draft = createDraftPatientNote('PT-88612', 'USR-010');
    expect(formatNoteTimestamp(draft.createdAt)).toMatch(/\d{1,2}:\d{2}\s(AM|PM)$/);
  });
});

describe('sortNotes', () => {
  const note = (id: string, createdAt: string): PatientNote => ({
    id,
    patientId: 'PT-88612',
    authorId: 'USR-010',
    title: id,
    body: 'Body',
    date: createdAt.slice(0, 10),
    createdAt,
  });

  it('puts the newest note first without mutating the input', () => {
    const input = [
      note('PN-1', '2026-08-10T09:15:00-06:00'),
      note('PN-2', '2026-08-12T14:40:00-06:00'),
    ];

    expect(sortNotes(input).map((n) => n.id)).toEqual(['PN-2', 'PN-1']);
    expect(input.map((n) => n.id)).toEqual(['PN-1', 'PN-2']);
  });
});

describe('validatePatientNote', () => {
  it('requires a title and body', () => {
    expect(validatePatientNote('', 'Some body', 'PT-88612')).toMatch(/title/i);
    expect(validatePatientNote('Title', '', 'PT-88612')).toMatch(/note/i);
  });

  it('allows notes mentioning PPI, PII, or PHI', () => {
    expect(validatePatientNote('PPI review', 'Flagged for follow-up', 'PT-88612')).toBeNull();
    expect(validatePatientNote('Follow-up', 'contains pii here', 'PT-88612')).toBeNull();
    expect(validatePatientNote('PHI note', 'do not store PHI in notes', 'PT-88612')).toBeNull();
  });

  it('rejects the patient\'s first or last name', () => {
    expect(validatePatientNote('Bed request', 'Edward asked for a lower bed', 'PT-88612')).toMatch(/name/);
    expect(validatePatientNote('Nelson family', 'Spoke with Nelson family', 'PT-88612')).toMatch(/name/);
  });

  it('allows generic references', () => {
    expect(validatePatientNote('Deliveries', 'Patient prefers morning deliveries.', 'PT-88612')).toBeNull();
    expect(validatePatientNote('Drop-off', 'Family requested side-door drop-off.', 'PT-88612')).toBeNull();
  });
});
