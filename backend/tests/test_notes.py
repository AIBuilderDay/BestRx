"""Patient note CRUD: the write path a nurse uses on the chart."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.fixtures import patients, users

PATIENT_ID = "PT-88612"
AUTHOR_ID = "USR-010"


def _create(client: TestClient, title: str = "Filter check", body: str = "Vendor to check filter.") -> dict:
    response = client.post(
        f"/patients/{PATIENT_ID}/notes",
        json={"authorId": AUTHOR_ID, "title": title, "body": body},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_fixtures_are_served(client: TestClient) -> None:
    response = client.get(f"/patients/{PATIENT_ID}/notes")
    assert response.status_code == 200
    notes = response.json()
    assert notes
    assert all(note["patientId"] == PATIENT_ID for note in notes)
    # Newest first, so the chart renders in the order the component expects.
    assert notes == sorted(notes, key=lambda note: note["createdAt"], reverse=True)


def test_create_persists_and_is_readable(client: TestClient) -> None:
    created = _create(client)
    assert created["id"].startswith("PN-")
    assert created["patientId"] == PATIENT_ID
    assert created["date"] == created["createdAt"][:10]

    listed = client.get(f"/patients/{PATIENT_ID}/notes").json()
    assert created["id"] in [note["id"] for note in listed]


def test_create_trims_and_assigns_distinct_ids(client: TestClient) -> None:
    first = _create(client, title="  Trim me  ", body="  Body  ")
    assert first["title"] == "Trim me"
    assert first["body"] == "Body"

    second = _create(client, title="Second note")
    assert second["id"] != first["id"]


def test_update_replaces_text_and_keeps_created_at(client: TestClient) -> None:
    created = _create(client)
    response = client.put(
        f"/notes/{created['id']}", json={"title": "Edited", "body": "Edited body."}
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Edited"
    assert updated["body"] == "Edited body."
    assert updated["createdAt"] == created["createdAt"]

    listed = client.get(f"/patients/{PATIENT_ID}/notes").json()
    assert [note for note in listed if note["id"] == created["id"]][0]["title"] == "Edited"


def test_delete_removes_the_note(client: TestClient) -> None:
    created = _create(client)
    assert client.delete(f"/notes/{created['id']}").status_code == 204

    listed = client.get(f"/patients/{PATIENT_ID}/notes").json()
    assert created["id"] not in [note["id"] for note in listed]
    assert client.delete(f"/notes/{created['id']}").status_code == 404


def test_seeded_note_can_be_edited_and_deleted(client: TestClient) -> None:
    seeded = client.get(f"/patients/{PATIENT_ID}/notes").json()[0]
    assert client.put(f"/notes/{seeded['id']}", json={"title": "T", "body": "B"}).status_code == 200
    assert client.delete(f"/notes/{seeded['id']}").status_code == 204


def test_patient_name_is_rejected_server_side(client: TestClient) -> None:
    patient = [row for row in patients() if row["id"] == PATIENT_ID][0]
    response = client.post(
        f"/patients/{PATIENT_ID}/notes",
        json={
            "authorId": AUTHOR_ID,
            "title": "Delivery",
            "body": f"{patient['firstName']} prefers morning deliveries.",
        },
    )
    assert response.status_code == 422
    assert "patient's name" in response.json()["detail"]


def test_blank_text_is_rejected(client: TestClient) -> None:
    response = client.post(
        f"/patients/{PATIENT_ID}/notes",
        json={"authorId": AUTHOR_ID, "title": "   ", "body": "Body."},
    )
    assert response.status_code == 422


def test_unknown_patient_and_author_are_404(client: TestClient) -> None:
    assert client.get("/patients/PT-00000/notes").status_code == 404

    payload = {"authorId": AUTHOR_ID, "title": "T", "body": "B"}
    assert client.post("/patients/PT-00000/notes", json=payload).status_code == 404

    unknown_author = {**payload, "authorId": "USR-000"}
    assert client.post(f"/patients/{PATIENT_ID}/notes", json=unknown_author).status_code == 404
    assert any(user["id"] == AUTHOR_ID for user in users())


def test_all_notes_endpoint_feeds_the_boot_snapshot(client: TestClient) -> None:
    everything = client.get("/patient-notes").json()
    for_patient = client.get("/patient-notes", params={"patientId": PATIENT_ID}).json()
    assert len(everything) >= len(for_patient)
    assert all(note["patientId"] == PATIENT_ID for note in for_patient)


def test_missing_note_is_404(client: TestClient) -> None:
    assert client.put("/notes/PN-9999", json={"title": "T", "body": "B"}).status_code == 404
