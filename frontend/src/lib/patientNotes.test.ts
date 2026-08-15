import { describe, expect, it } from 'vitest';
import { validatePatientNote } from './patientNotes';

describe('validatePatientNote', () => {
  it('rejects PPI, PII, and PHI', () => {
    expect(validatePatientNote('Flagged for PPI review', 'PT-88612')).toMatch(/PPI/);
    expect(validatePatientNote('contains pii here', 'PT-88612')).toMatch(/PPI/);
    expect(validatePatientNote('do not store PHI in notes', 'PT-88612')).toMatch(/PPI/);
  });

  it('rejects the patient\'s first or last name', () => {
    expect(validatePatientNote('Edward asked for a lower bed', 'PT-88612')).toMatch(/name/);
    expect(validatePatientNote('Spoke with Nelson family', 'PT-88612')).toMatch(/name/);
  });

  it('allows generic references', () => {
    expect(validatePatientNote('Patient prefers morning deliveries.', 'PT-88612')).toBeNull();
    expect(validatePatientNote('Family requested side-door drop-off.', 'PT-88612')).toBeNull();
  });
});
