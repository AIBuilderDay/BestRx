"""The patient-note store.

Seeded from `patient_notes.json` at startup and mutated in place, the same trade the order store
makes: no database to provision, and a restart returns the chart to a known-good set of notes.

Notes are the one table a nurse both writes and expects to still be there on the next screen, so
the writes live here rather than in component state — a note added on the chart survives a reload
and is visible to the rest of the care team for as long as the process runs.
"""

from __future__ import annotations

import threading
from typing import Any

from .fixtures import seed_patient_notes

Row = dict[str, Any]


class NoteStore:
    """Patient notes, keyed by note id."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._notes: dict[str, Row] = {row["id"]: dict(row) for row in seed_patient_notes()}

    def list_notes(self, patient_id: str | None = None) -> list[Row]:
        """Notes newest first. Empty list for an unknown patient, never a raise."""
        with self._lock:
            rows = [dict(note) for note in self._notes.values()]
        if patient_id:
            rows = [row for row in rows if row.get("patientId") == patient_id]
        return sorted(rows, key=lambda row: str(row.get("createdAt") or ""), reverse=True)

    def get(self, note_id: str) -> Row | None:
        """None for a missing id, per docs/DATA_MODEL.md."""
        with self._lock:
            note = self._notes.get(note_id)
            return dict(note) if note else None

    def put(self, note: Row) -> Row:
        with self._lock:
            self._notes[note["id"]] = dict(note)
        return dict(note)

    def delete(self, note_id: str) -> bool:
        with self._lock:
            return self._notes.pop(note_id, None) is not None

    def create(self, note: Row) -> Row:
        """Store a note under the next id in the PN-#### series the fixtures use.

        The id is derived and claimed under one lock acquisition, so two concurrent creates cannot
        be handed the same id.
        """
        with self._lock:
            highest = 0
            for raw_id in self._notes:
                if raw_id.startswith("PN-") and raw_id[3:].isdigit():
                    highest = max(highest, int(raw_id[3:]))
            stored = {**note, "id": f"PN-{highest + 1:04d}"}
            self._notes[stored["id"]] = stored
        return dict(stored)


_store: NoteStore | None = None
_store_lock = threading.Lock()


def get_note_store() -> NoteStore:
    """One store per process."""
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                _store = NoteStore()
    return _store


def reset_note_store() -> None:
    """Drop the store so the fixtures reload. Used by tests."""
    global _store
    with _store_lock:
        _store = None
