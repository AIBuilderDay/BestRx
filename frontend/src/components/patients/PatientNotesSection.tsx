import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PatientNote, User } from '../../types/domain';
import { getNotesForPatient } from '../../data/db';
import { createDraftPatientNote, sortNotes } from '../../lib/patientNotes';
import {
  createPatientNote,
  deletePatientNote,
  fetchPatientNotes,
  updatePatientNote,
} from '../../lib/api';
import { PatientStickyNote } from './PatientStickyNote';
import { PatientStickyNoteOverlay } from './PatientStickyNoteOverlay';

type NoteOverlayState = {
  note: PatientNote;
  mode: 'view' | 'compose';
};

/**
 * Folded sticky-note cards for the patient chart.
 *
 * Every write goes to the API and the list is re-read from the boot snapshot the API client keeps
 * current, so a note added here is still on the chart after a reload and is visible to the rest of
 * the care team. A failed write leaves the note as it was and says so, rather than showing a note
 * the server never stored.
 */
export function PatientNotesSection({ patientId, user }: { patientId: string; user: User }) {
  const [notes, setNotes] = useState<PatientNote[]>(() => sortNotes(getNotesForPatient(patientId)));
  const [overlay, setOverlay] = useState<NoteOverlayState | null>(null);
  const [error, setError] = useState('');

  // Re-read from the API when the chart opens: the boot snapshot can be minutes old, and another
  // nurse may have written a note since.
  useEffect(() => {
    let cancelled = false;

    setNotes(sortNotes(getNotesForPatient(patientId)));
    fetchPatientNotes(patientId)
      .then((fetched) => {
        if (!cancelled) setNotes(sortNotes(fetched));
      })
      .catch(() => {
        // The snapshot's notes are already on screen; a refresh failure is not worth an alert.
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  /** Saves through the API. Throws when the write is refused; the overlay renders the message. */
  const saveNote = useCallback(
    async (updated: PatientNote): Promise<PatientNote> => {
      const saved =
        updated.id === 'draft'
          ? await createPatientNote(patientId, user.id, updated.title, updated.body)
          : await updatePatientNote(updated.id, updated.title, updated.body);

      setNotes(sortNotes(getNotesForPatient(patientId)));
      setOverlay((prev) => (prev?.note.id === updated.id ? { note: saved, mode: 'view' } : prev));
      setError('');
      return saved;
    },
    [patientId, user.id],
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      try {
        await deletePatientNote(noteId);
        setNotes(sortNotes(getNotesForPatient(patientId)));
        setError('');
      } catch {
        setError('That note could not be deleted. Try again.');
      }
    },
    [patientId],
  );

  return (
    <section className="overflow-hidden border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-bg-subtle px-4 py-3.5">
        <h2 className="text-[13px] font-semibold tracking-tight">Notes</h2>
        <button
          type="button"
          data-testid="add-patient-note"
          onClick={() =>
            setOverlay({
              note: createDraftPatientNote(patientId, user.id),
              mode: 'compose',
            })
          }
          className="cursor-pointer border border-solid-bg bg-solid-bg px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-solid-ink transition-opacity hover:opacity-85"
        >
          Add note
        </button>
      </div>

      <div className="p-4">
        {error ? (
          <p role="alert" className="mb-3 text-[13px] text-danger">
            {error}
          </p>
        ) : null}

        {notes.length === 0 ? (
          <p className="text-[13px] text-ink-3">No notes yet — add the first one above.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            {notes.map((note) => (
              <PatientStickyNote
                key={note.id}
                note={note}
                hidden={overlay?.mode === 'view' && overlay.note.id === note.id}
                onOpen={(selected) => setOverlay({ note: selected, mode: 'view' })}
              />
            ))}
          </div>
        )}
      </div>

      {overlay
        ? createPortal(
            <PatientStickyNoteOverlay
              note={overlay.note}
              mode={overlay.mode}
              onClose={() => setOverlay(null)}
              onDelete={overlay.mode === 'view' ? deleteNote : undefined}
              onSave={saveNote}
            />,
            document.body,
          )
        : null}
    </section>
  );
}
