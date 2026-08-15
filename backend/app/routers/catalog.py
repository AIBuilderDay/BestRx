"""Read-only reference tables: patients, products, equipment, vendors.

These are served straight from the JSON fixtures. The API never writes them, so there is nothing to
persist and no reason to copy them into DynamoDB.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from .. import fixtures

router = APIRouter(tags=["catalog"])


@router.get("/patients")
def list_patients(
    hospiceId: str | None = Query(default=None),
    caseManagerId: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    rows = fixtures.patients()
    if hospiceId:
        rows = [row for row in rows if row.get("hospiceId") == hospiceId]
    if caseManagerId:
        rows = [row for row in rows if row.get("caseManagerId") == caseManagerId]
    if status:
        rows = [row for row in rows if row.get("status") == status]
    return rows


@router.get("/patients/{patient_id}")
def get_patient(patient_id: str) -> dict[str, Any]:
    patient = fixtures.find_by("patients", "id", patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    return patient


@router.get("/products")
def list_products(
    vendorId: str | None = Query(default=None),
    category: str | None = Query(default=None),
    inStock: bool | None = Query(default=None),
) -> list[dict[str, Any]]:
    """Vendor offers — the storefront rows a nurse compares and adds to a cart."""
    rows = fixtures.vendor_offers()
    if vendorId:
        rows = [row for row in rows if row.get("vendorId") == vendorId]
    if category:
        rows = [row for row in rows if row.get("category") == category]
    if inStock is not None:
        rows = [row for row in rows if row.get("inStock") is inStock]
    return rows


@router.get("/equipment")
def list_equipment(category: str | None = Query(default=None)) -> list[dict[str, Any]]:
    """The raw catalog, keyed by HCPCS. Distinct from /products, which is per-vendor pricing."""
    rows = fixtures.equipment_catalog()
    if category:
        rows = [row for row in rows if row.get("category") == category]
    return rows


@router.get("/vendors")
def list_vendors() -> list[dict[str, Any]]:
    return fixtures.vendors()
