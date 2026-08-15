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
  onDelete?: (noteId: string) => void | Promise<void>;
  onSave: (note: PatientNote) => Promise<PatientNote>;
}) {
  const isCompose = mode === 'compose';
  const [editing, setEditing] = useState(isCompose);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editBody, setEditBody] = useState(note.body);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);
  const [crumpling, setCrumpling] = useState(false);

  useEffect(() => {
    setEditTitle(note.title);
    setEditBody(note.body);
    setEditing(isCompose);
    setEditError('');
    setSaving(false);
    setCrumpling(false);
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
      if (event.key === 'Escape' && !crumpling) close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, crumpling]);

  const commitDelete = useCallback(() => {
    if (!onDelete) return;
    onDelete(note.id);
    onClose();
  }, [note.id, onClose, onDelete]);

  /* The note is only removed once it has crumpled and flown off-screen. Readers who
     asked for reduced motion never see that animation, so it is deleted straight away. */
  const deleteNote = useCallback(() => {
    if (!onDelete) return;

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      commitDelete();
      return;
    }

    setCrumpling(true);
  }, [commitDelete, onDelete]);

  const startEditing = () => {
    setEditTitle(note.title);
    setEditBody(note.body);
    setEditError('');
    setEditing(true);
  };

  /* The same rules run again on the server, so a save can still be refused after passing here —
     the client check is what shows the nurse the problem without a round trip. */
  const saveEdit = async () => {
    const validationError = validatePatientNote(editTitle, editBody, note.patientId);
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setSaving(true);
    try {
      await onSave({ ...note, title: editTitle.trim(), body: editBody.trim() });
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : 'That note could not be saved. Try again.',
      );
      return;
    } finally {
      setSaving(false);
    }

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
        className={[
          'absolute inset-0 border-0 bg-black/25 motion-reduce:animate-none',
          crumpling
            ? 'pointer-events-none animate-note-backdrop-out'
            : 'cursor-pointer animate-note-backdrop-in',
        ].join(' ')}
        aria-label="Close note"
        onClick={crumpling ? undefined : close}
      />

      <div className="pointer-events-none fixed inset-0 grid place-items-center p-4">
        <div
          className={crumpling ? 'patient-note-toss' : undefined}
          /* Several crumple animations finish together; the toss is the one that
             ends with the note off-screen, so it is the one that commits. */
          onAnimationEnd={(event) => {
            if (crumpling && event.animationName === 'noteCrumpleToss') commitDelete();
          }}
        >
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
            onClose={crumpling ? undefined : dismiss}
            className={[
              'pointer-events-auto motion-reduce:animate-none',
              crumpling ? 'patient-sticky-note--crumpling' : 'animate-sticky-note-in',
            ].join(' ')}
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
                      <button
                        type="button"
                        className="patient-sticky-note-action"
                        onClick={saveEdit}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        className="patient-sticky-note-action patient-sticky-note-action--ghost"
                        disabled={saving}
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
    </div>
  );
}
