import { useCallback, useEffect, useState } from 'react';
import type { PatientNote } from '../../types/domain';
import { validatePatientNote } from '../../lib/patientNotes';
import { PatientStickyNoteCard } from './PatientStickyNoteCard';

const EXPANDED_NOTE_WIDTH = 400;

/** Full-screen editor for a patient sticky note. */
export function PatientStickyNoteOverlay({
  note,
  mode = 'view',
  onClose,
  onDelete,
  onSave,
}: {
  note: PatientNote;
  mode?: 'view' | 'compose';
  onClose: () => void;
  onDelete?: (noteId: string) => void;
  onSave: (note: PatientNote) => void;
}) {
  const isCompose = mode === 'compose';
  const [editing, setEditing] = useState(isCompose);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editBody, setEditBody] = useState(note.body);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    setEditTitle(note.title);
    setEditBody(note.body);
    setEditing(isCompose);
    setEditError('');
  }, [isCompose, note]);

  const dismiss = useCallback(() => {
    onClose();
  }, [onClose]);

  const close = useCallback(() => {
    if (!isCompose && editing) {
      setEditing(false);
      setEditTitle(note.title);
      setEditBody(note.body);
      setEditError('');
      return;
    }

    onClose();
  }, [editing, isCompose, note, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close]);

  const deleteNote = useCallback(() => {
    if (!onDelete) return;
    onDelete(note.id);
    onClose();
  }, [note.id, onClose, onDelete]);

  const startEditing = () => {
    setEditTitle(note.title);
    setEditBody(note.body);
    setEditError('');
    setEditing(true);
  };

  const saveEdit = () => {
    const validationError = validatePatientNote(editTitle, editBody, note.patientId);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    onSave({
      ...note,
      title: editTitle.trim(),
      body: editBody.trim(),
    });

    if (isCompose) {
      onClose();
      return;
    }

    setEditing(false);
    setEditError('');
  };

  return (
    <div className="fixed inset-0 z-[70]" role="presentation" data-testid="patient-note-overlay">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer border-0 bg-black/25 animate-note-backdrop-in motion-reduce:animate-none"
        aria-label="Close note"
        onClick={close}
      />

      <div className="pointer-events-none fixed inset-0 grid place-items-center p-4">
        <PatientStickyNoteCard
          note={note}
          expanded
          editing={editing}
          editTitle={editTitle}
          editBody={editBody}
          titlePlaceholder={isCompose ? 'Title' : undefined}
          bodyPlaceholder={
            isCompose ? 'Add a note for this patient — visible to the care team.' : undefined
          }
          onEditTitleChange={(value) => {
            setEditTitle(value);
            if (editError) setEditError('');
          }}
          onEditBodyChange={(value) => {
            setEditBody(value);
            if (editError) setEditError('');
          }}
          onClose={dismiss}
          className="pointer-events-auto animate-sticky-note-in motion-reduce:animate-none"
          style={{ width: EXPANDED_NOTE_WIDTH }}
          actions={
            <div className="patient-sticky-note-action-row">
              {editError ? (
                <p role="alert" className="patient-sticky-note-action-error">
                  {editError}
                </p>
              ) : null}
              <div className="patient-sticky-note-action-buttons">
                {editing ? (
                  <>
                    <button type="button" className="patient-sticky-note-action" onClick={saveEdit}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="patient-sticky-note-action patient-sticky-note-action--ghost"
                      onClick={isCompose ? dismiss : () => {
                        setEditing(false);
                        setEditTitle(note.title);
                        setEditBody(note.body);
                        setEditError('');
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="patient-sticky-note-action" onClick={startEditing}>
                      Edit
                    </button>
                    {onDelete ? (
                      <button
                        type="button"
                        className="patient-sticky-note-action patient-sticky-note-action--danger"
                        onClick={deleteNote}
                      >
                        Trash
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}
