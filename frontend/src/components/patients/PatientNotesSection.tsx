import { useState } from 'react';
import type { PatientNote, User } from '../../types/domain';
import {
  createSessionPatientNote,
  formatNoteTimestamp,
  noteAuthorLabel,
  notesForPatient,
  validatePatientNote,
} from '../../lib/patientNotes';

/** Google Keep-style sticky notes for the patient chart. */
export function PatientNotesSection({
  patientId,
  user,
  storedNotes,
  sessionNotes,
  onAddNote,
}: {
  patientId: string;
  user: User;
  storedNotes: PatientNote[];
  sessionNotes: PatientNote[];
  onAddNote: (note: PatientNote) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const notes = notesForPatient(patientId, storedNotes, sessionNotes);

  const submit = () => {
    const body = draft.trim();
    const validationError = validatePatientNote(body, patientId);
    if (validationError) {
      setError(validationError);
      return;
    }
    onAddNote(createSessionPatientNote(patientId, user.id, body));
    setDraft('');
    setError('');
  };

  return (
    <section className="overflow-hidden border border-line bg-surface">
      <div className="border-b border-line bg-bg-subtle px-4 py-3.5">
        <h2 className="text-[13px] font-semibold tracking-tight">Notes</h2>
      </div>

      <div className="p-4">
        <div className="border border-line bg-bg-subtle p-3">
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError('');
            }}
            placeholder="Add a note for this patient — visible to the care team."
            rows={2}
            className="w-full resize-y border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            {error ? (
              <p role="alert" className="text-right text-xs text-risk">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="shrink-0 cursor-pointer border border-solid-bg bg-solid-bg px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-solid-ink transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add note
            </button>
          </div>
        </div>

        {notes.length === 0 ? (
          <p className="mt-4 text-[13px] text-ink-3">No notes yet — pin the first one above.</p>
        ) : (
          <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {notes.map((note) => (
              <article
                key={note.id}
                className="flex min-h-[132px] flex-col border border-line bg-surface p-3"
              >
                <p className="flex-1 text-[13px] leading-relaxed text-pretty text-ink">{note.body}</p>
                <div className="mt-3 border-t border-line/70 pt-2 text-[11px] text-ink-3">
                  <div className="font-medium text-ink-2">{noteAuthorLabel(note.authorId)}</div>
                  <div className="mt-0.5 tabular-nums">{formatNoteTimestamp(note.createdAt)}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
