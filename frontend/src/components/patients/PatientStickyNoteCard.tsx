import type { CSSProperties, ReactNode, Ref } from 'react';
import type { PatientNote } from '../../types/domain';
import { formatNoteDate, noteAuthorLabel } from '../../lib/patientNotes';

/** Shared sticky-note surface for grid cards and the expanded overlay. */
export function PatientStickyNoteCard({
  note,
  expanded = false,
  editing = false,
  editTitle = '',
  editBody = '',
  titlePlaceholder,
  bodyPlaceholder,
  onEditTitleChange,
  onEditBodyChange,
  onActivate,
  onClose,
  hidden = false,
  actions,
  className = '',
  style,
  cardRef,
}: {
  note: PatientNote;
  expanded?: boolean;
  editing?: boolean;
  editTitle?: string;
  editBody?: string;
  titlePlaceholder?: string;
  bodyPlaceholder?: string;
  onEditTitleChange?: (value: string) => void;
  onEditBodyChange?: (value: string) => void;
  onActivate?: (element: HTMLElement) => void;
  onClose?: () => void;
  hidden?: boolean;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
  cardRef?: Ref<HTMLElement>;
}) {
  const interactive = Boolean(onActivate) && !editing;

  return (
    <article
      ref={cardRef}
      className={[
        'patient-sticky-note',
        expanded ? 'patient-sticky-note--expanded' : '',
        interactive ? 'patient-sticky-note--interactive' : '',
        hidden ? 'patient-sticky-note--hidden' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-label={note.title || titlePlaceholder || 'Note'}
      aria-hidden={hidden || undefined}
      onClick={interactive ? (event) => onActivate?.(event.currentTarget) : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate?.(event.currentTarget);
              }
            }
          : undefined
      }
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <header className="patient-sticky-note-meta">
        {editing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(event) => onEditTitleChange?.(event.target.value)}
            placeholder={titlePlaceholder}
            className="patient-sticky-note-title-input min-w-0 flex-1"
            aria-label="Note title"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{note.title}</span>
        )}
        {onClose ? (
          <button
            type="button"
            className="patient-sticky-note-close"
            aria-label="Close note"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            ✕
          </button>
        ) : null}
      </header>

      {editing ? (
        <textarea
          value={editBody}
          onChange={(event) => onEditBodyChange?.(event.target.value)}
          placeholder={bodyPlaceholder}
          className="patient-sticky-note-body-input"
          aria-label="Note body"
        />
      ) : (
        <p className="patient-sticky-note-message">{note.body}</p>
      )}

      {actions ? <div className="patient-sticky-note-actions">{actions}</div> : null}

      <footer className="patient-sticky-note-footer">
        <time dateTime={note.date}>{formatNoteDate(note.date)}</time>
        <span>{noteAuthorLabel(note.authorId)}</span>
      </footer>
    </article>
  );
}
