"""Patient notes: create, edit, delete.

The chart-privacy rule lives here as well as in the browser. `lib/patientNotes.ts` blocks a note
containing the patient's own name so the nurse sees the problem while typing, but a rule enforced
only in the client is not enforced at all — anything reaching this endpoint is checked again before
it is stored.

Timestamps are written in the dataset's Mountain offset (docs/DATA_MODEL.md), so a note created now
sorts and reads alongside the seeded ones instead of jumping an hour.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from ..fixtures import find_by
from ..notes import NoteStore

Row = dict[str, Any]

# The fixtures are Mountain time; see the note-timestamp comment in lib/patientNotes.ts.
DATA_TZ = timezone(timedelta(hours=-6))


class UnknownPatient(Exception):
    def __init__(self, patient_id: str) -> None:
        super().__init__(f"Patient {patient_id} not found")
        self.patient_id = patient_id


class UnknownUser(Exception):
    def __init__(self, user_id: str) -> None:
        super().__init__(f"User {user_id} not found")
        self.user_id = user_id


class NoteNotFound(Exception):
    def __init__(self, note_id: str) -> None:
        super().__init__(f"Note {note_id} not found")
        self.note_id = note_id


class InvalidNote(Exception):
    """The note text breaks a chart rule. The message is written to be shown to the nurse."""


def _contains_patient_name(text: str, patient: Row) -> bool:
    first = str(patient.get("firstName") or "")
    last = str(patient.get("lastName") or "")
    candidates = [name for name in (first, last, f"{first} {last}".strip()) if name]
    return any(re.search(rf"\b{re.escape(name)}\b", text, re.IGNORECASE) for name in candidates)


def _validate(title: str, body: str, patient: Row) -> tuple[str, str]:
    """Trimmed title and body, or raise InvalidNote with a message the UI can render verbatim."""
    clean_title = title.strip()
    clean_body = body.strip()

    if not clean_title:
        raise InvalidNote("Enter a title before saving.")
    if not clean_body:
        raise InvalidNote("Enter a note before saving.")

    for text in (clean_title, clean_body):
        if _contains_patient_name(text, patient):
            raise InvalidNote(
                'Notes cannot include the patient\'s name — refer to them as "patient" or "family".'
            )

    return clean_title, clean_body


def list_notes(notes: NoteStore, patient_id: str | None = None) -> list[Row]:
    return notes.list_notes(patient_id)


def create_note(
    notes: NoteStore, patient_id: str, author_id: str, title: str, body: str
) -> Row:
    patient = find_by("patients", "id", patient_id)
    if patient is None:
        raise UnknownPatient(patient_id)
    if find_by("users", "id", author_id) is None:
        raise UnknownUser(author_id)

    clean_title, clean_body = _validate(title, body, patient)
    created_at = datetime.now(DATA_TZ).isoformat(timespec="seconds")

    return notes.create(
        {
            "patientId": patient_id,
            "authorId": author_id,
            "title": clean_title,
            "body": clean_body,
            "date": created_at[:10],
            "createdAt": created_at,
        }
    )


def update_note(notes: NoteStore, note_id: str, title: str, body: str) -> Row:
    """Edit a note's text. `createdAt` is left alone — it is when the note was written."""
    existing = notes.get(note_id)
    if existing is None:
        raise NoteNotFound(note_id)

    patient = find_by("patients", "id", existing.get("patientId"))
    if patient is None:
        raise UnknownPatient(str(existing.get("patientId")))

    clean_title, clean_body = _validate(title, body, patient)
    return notes.put({**existing, "title": clean_title, "body": clean_body})


def delete_note(notes: NoteStore, note_id: str) -> None:
    if not notes.delete(note_id):
        raise NoteNotFound(note_id)
