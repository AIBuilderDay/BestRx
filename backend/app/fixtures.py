"""Read-only access to the mock JSON tables.

These are the same files the frontend reads through `src/data/db.ts`. Tables the API never writes
(patients, vendors, offers, catalog, reviews) are served straight from here and ship inside the
Lambda bundle — copying them into DynamoDB would buy nothing.

`orders` and `order_events` are loaded here too, but only as the seed for DynamoDB and as the
fallback store when no tables are configured.

Lookups return None for a missing id rather than raising, matching the rule in docs/DATA_MODEL.md.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

# Populated by the Dockerfile / build step: frontend/src/data is copied to backend/data.
DATA_DIR = Path(__file__).resolve().parent.parent / "data"

Row = dict[str, Any]


@lru_cache(maxsize=None)
def load_table(name: str) -> list[Row]:
    """Load one JSON table by file stem. Returns [] if the file is absent."""
    path = DATA_DIR / f"{name}.json"
    if not path.is_file():
        return []
    with path.open(encoding="utf-8") as handle:
        rows = json.load(handle)
    return rows if isinstance(rows, list) else []


def find_by(name: str, key: str, value: str | None) -> Row | None:
    if not value:
        return None
    for row in load_table(name):
        if row.get(key) == value:
            return row
    return None


def patients() -> list[Row]:
    return load_table("patients")


def vendors() -> list[Row]:
    return load_table("vendors")


def real_vendors() -> list[Row]:
    """Real, publicly-listed DME suppliers. Distinct from vendors() — see docs/DATA_MODEL.md."""
    return load_table("real_vendors")


def vendor_offers() -> list[Row]:
    return load_table("vendor_offers")


def equipment_catalog() -> list[Row]:
    return load_table("equipment_catalog")


def product_reviews() -> list[Row]:
    return load_table("product_reviews")


def hospices() -> list[Row]:
    return load_table("hospices")


def users() -> list[Row]:
    return load_table("users")


def seed_orders() -> list[Row]:
    return load_table("orders")


def seed_order_events() -> list[Row]:
    return load_table("order_events")
