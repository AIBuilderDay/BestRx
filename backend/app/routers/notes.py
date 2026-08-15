"""Patient note endpoints.

Notes hang off a chart, so creating one is scoped to a patient (`POST /patients/{id}/notes`) while
editing and deleting address the note directly (`/notes/{id}`) — a note id is unique on its own and
the client already has it.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..fixtures import find_by
from ..notes import NoteStore, get_note_store
from ..schemas import CreateNoteRequest, UpdateNoteRequest
from ..services import notes as service

router = APIRouter(tags=["notes"])


@router.get("/patient-notes")
def list_all_notes(
    patientId: str | None = Query(default=None),
    notes: NoteStore = Depends(get_note_store),
) -> list[dict[str, Any]]:
    """Every note, newest first. Feeds the frontend's boot snapshot in one request."""
    return service.list_notes(notes, patientId)


@router.get("/patients/{patient_id}/notes")
def list_patient_notes(
    patient_id: str,
    notes: NoteStore = Depends(get_note_store),
) -> list[dict[str, Any]]:
    if find_by("patients", "id", patient_id) is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return service.list_notes(notes, patient_id)


@router.post("/patients/{patient_id}/notes", status_code=201)
def create_note(
    patient_id: str,
    payload: CreateNoteRequest,
    notes: NoteStore = Depends(get_note_store),
) -> dict[str, Any]:
    try:
        return service.create_note(
            notes, patient_id, payload.authorId, payload.title, payload.body
        )
    except (service.UnknownPatient, service.UnknownUser) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.InvalidNote as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.put("/notes/{note_id}")
def update_note(
    note_id: str,
    payload: UpdateNoteRequest,
    notes: NoteStore = Depends(get_note_store),
) -> dict[str, Any]:
    try:
        return service.update_note(notes, note_id, payload.title, payload.body)
    except (service.NoteNotFound, service.UnknownPatient) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.InvalidNote as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: str, notes: NoteStore = Depends(get_note_store)) -> None:
    try:
        service.delete_note(notes, note_id)
    except service.NoteNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
