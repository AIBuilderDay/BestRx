import type { PatientNote } from '../../types/domain';
import { PatientStickyNoteCard } from './PatientStickyNoteCard';

/** Grid sticky-note card — click to expand. */
export function PatientStickyNote({
  note,
  hidden = false,
  onOpen,
}: {
  note: PatientNote;
  hidden?: boolean;
  onOpen: (note: PatientNote) => void;
}) {
  return (
    <PatientStickyNoteCard
      note={note}
      hidden={hidden}
      onActivate={() => onOpen(note)}
    />
  );
}
