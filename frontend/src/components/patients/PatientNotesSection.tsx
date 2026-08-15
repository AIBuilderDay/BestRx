import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PatientNote, User } from '../../types/domain';
import {
  createDraftPatientNote,
  createSessionPatientNote,
  notesForPatient,
} from '../../lib/patientNotes';
import { PatientStickyNote } from './PatientStickyNote';
import { PatientStickyNoteOverlay } from './PatientStickyNoteOverlay';

type NoteOverlayState = {
  note: PatientNote;
  mode: 'view' | 'compose';
};

/** Folded sticky-note cards for the patient chart. */
export function PatientNotesSection({
  patientId,
  user,
  storedNotes,
  sessionNotes,
  onAddNote,
  onSessionNotesChange,
}: {
  patientId: string;
  user: User;
  storedNotes: PatientNote[];
  sessionNotes: PatientNote[];
  onAddNote: (note: PatientNote) => void;
  onSessionNotesChange: (notes: PatientNote[]) => void;
}) {
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [editedNotes, setEditedNotes] = useState<Record<string, PatientNote>>({});
  const [overlay, setOverlay] = useState<NoteOverlayState | null>(null);

  const notes = useMemo(() => {
    const merged = notesForPatient(patientId, storedNotes, sessionNotes)
      .filter((note) => !deletedIds.includes(note.id))
      .map((note) => editedNotes[note.id] ?? note);
    return merged;
  }, [patientId, storedNotes, sessionNotes, deletedIds, editedNotes]);

  const saveNote = (updated: PatientNote) => {
    if (updated.id === 'draft') {
      onAddNote(createSessionPatientNote(patientId, user.id, updated.title, updated.body));
      return;
    }

    if (updated.id.startsWith('PN-S-')) {
      onSessionNotesChange(sessionNotes.map((note) => (note.id === updated.id ? updated : note)));
    } else {
      setEditedNotes((prev) => ({ ...prev, [updated.id]: updated }));
    }
    setOverlay((prev) => (prev?.note.id === updated.id ? { ...prev, note: updated } : prev));
  };

  const deleteNote = (noteId: string) => {
    if (noteId.startsWith('PN-S-')) {
      onSessionNotesChange(sessionNotes.filter((note) => note.id !== noteId));
    } else {
      setDeletedIds((prev) => [...prev, noteId]);
    }
  };

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
