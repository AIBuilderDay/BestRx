import { describe, expect, it } from 'vitest';
import { formatNoteDate, validatePatientNote } from './patientNotes';

describe('formatNoteDate', () => {
  it('formats an ISO date as a short date', () => {
    expect(formatNoteDate('2026-08-10')).toBe('Aug 10, 2026');
  });
});

describe('validatePatientNote', () => {
  it('requires a title and body', () => {
    expect(validatePatientNote('', 'Some body', 'PT-88612')).toMatch(/title/i);
    expect(validatePatientNote('Title', '', 'PT-88612')).toMatch(/note/i);
  });

  it('rejects PPI, PII, and PHI', () => {
    expect(validatePatientNote('PPI review', 'Flagged for follow-up', 'PT-88612')).toMatch(/PPI/);
    expect(validatePatientNote('Follow-up', 'contains pii here', 'PT-88612')).toMatch(/PPI/);
    expect(validatePatientNote('PHI note', 'do not store PHI in notes', 'PT-88612')).toMatch(/PPI/);
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
