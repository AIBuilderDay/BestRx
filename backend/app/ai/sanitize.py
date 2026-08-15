"""What the model is allowed to know about a patient.

Nothing identifying leaves this process: no full name, no DOB, no street address. The model gets
clinical context (diagnosis, status, timing), a coarse location (ZIP only — enough to reason about
delivery distance), an age instead of a birthday, and a short display label ("Harold B.") so an
order confirmation can be read back to the nurse.

The data is synthetic, but we sanitize as if it were real — that is part of the pitch. Ported from
the frontend's `lib/ai/sanitize.ts`, which is now deleted: the model calls happen here.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

Row = dict[str, Any]

# The fixtures are a frozen snapshot, so ages are computed against the dataset's "now" rather than
# the wall clock. Matches DATASET_NOW in frontend/src/lib/catalog.ts.
DATASET_NOW = datetime(2026, 8, 15, tzinfo=UTC)

_YEAR_SECONDS = 365.25 * 24 * 60 * 60


def _age_years(dob: str | None) -> int | None:
    """None for a missing or unparseable birthday — never raise on fixture data."""
    if not dob:
        return None
    try:
        born = datetime.fromisoformat(dob.replace("Z", "+00:00"))
    except ValueError:
        return None
    if born.tzinfo is None:
        born = born.replace(tzinfo=UTC)
    return max(0, int((DATASET_NOW - born).total_seconds() // _YEAR_SECONDS))


def patient_label(patient: Row) -> str:
    """First name + last initial, e.g. "Harold B." — for read-back, not identification."""
    first = str(patient.get("firstName") or "").strip()
    last = str(patient.get("lastName") or "").strip()
    initial = f"{last[0]}." if last else ""
    return " ".join(part for part in (first, initial) if part) or str(patient.get("id", "Patient"))


def sanitize_patient(patient: Row) -> Row:
    """The only patient shape that may reach the model."""
    address = patient.get("address") or {}
    diagnosis = patient.get("primaryDiagnosis") or {}
    sanitized: Row = {
        "id": patient.get("id"),
        "label": patient_label(patient),
        "ageYears": _age_years(patient.get("dob")),
        "gender": patient.get("gender"),
        "diagnosis": diagnosis.get("description"),
        "status": patient.get("status"),
        "zip": address.get("zip"),
    }
    # Present only when a discharge is scheduled — the delivery deadline that matters.
    if patient.get("dischargeAt"):
        sanitized["dischargeAt"] = patient["dischargeAt"]
    return sanitized


# Words shorter than this are too ambiguous to match a name on ("a", "for", "bed").
_MIN_NAME_LEN = 3
_WORDS = re.compile(r"[^a-zà-ÿ'-]+", re.IGNORECASE)


def find_mentioned_patients(text: str, pool: list[Row]) -> list[Row]:
    """Deterministic name matching — names never go to the model to be matched.

    Finds patients whose first or last name appears as a whole word in the text. An empty result
    means "no patient context", which callers treat as a plain search rather than an error.
    """
    words = {w for w in _WORDS.split(text.lower()) if len(w) >= _MIN_NAME_LEN}
    if not words:
        return []
    return [
        patient
        for patient in pool
        if str(patient.get("firstName", "")).lower() in words
        or str(patient.get("lastName", "")).lower() in words
    ]
