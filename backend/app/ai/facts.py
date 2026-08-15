"""The compact offer view the model is shown.

Only fields that belong in a ranking decision, joined from the fixtures the REST API already
serves. The frontend used to ship this payload up with every request; now it sends offer ids and
the facts are assembled here, so a search costs a list of ids rather than the whole storefront.
"""

from __future__ import annotations

from typing import Any

from .. import fixtures

Row = dict[str, Any]


def _rating_summary(offer_id: str, reviews: list[Row]) -> Row | None:
    """Average stars and count, or None when nobody has reviewed this SKU."""
    scores = [r["rating"] for r in reviews if r.get("offerId") == offer_id and r.get("rating")]
    if not scores:
        return None
    return {"avg": round(sum(scores) / len(scores), 2), "count": len(scores)}


def offer_facts(offer_ids: list[str]) -> list[Row]:
    """Facts for these offers, in the order given. Unknown ids are dropped, not faked."""
    offers = {row["id"]: row for row in fixtures.vendor_offers()}
    vendors = {row["id"]: row for row in fixtures.vendors()}
    reviews = fixtures.product_reviews()

    facts: list[Row] = []
    for offer_id in offer_ids:
        offer = offers.get(offer_id)
        if offer is None:
            continue
        vendor = vendors.get(offer.get("vendorId", ""))
        facts.append(
            {
                "offerId": offer["id"],
                "product": offer.get("productName"),
                "description": offer.get("description"),
                "category": offer.get("category"),
                # Both arrangements, so the model can weigh a rental against a purchase.
                "rentalPriceUsd": offer.get("rentalPriceUsd"),
                "purchasePriceUsd": offer.get("purchasePriceUsd"),
                "priceUnit": offer.get("unit"),
                "inStock": offer.get("inStock"),
                "deliveryEtaHours": offer.get("deliveryEtaHours"),
                "deliveryLeadDays": offer.get("deliveryLeadDays"),
                "vendor": (vendor or {}).get("name"),
                "nurseRating": _rating_summary(offer["id"], reviews),
            }
        )
    return facts


def known_offer_ids(offer_ids: list[str]) -> list[str]:
    """The subset the catalog actually holds — what a schema enum may safely be built from."""
    known = {row["id"] for row in fixtures.vendor_offers()}
    seen: set[str] = set()
    result: list[str] = []
    for offer_id in offer_ids:
        if offer_id in known and offer_id not in seen:
            seen.add(offer_id)
            result.append(offer_id)
    return result


def assignable_patients(hospice_id: str | None) -> list[Row]:
    """Patients a nurse at this hospice may order for. Deceased patients are never offered."""
    rows = [row for row in fixtures.patients() if row.get("status") != "deceased"]
    if hospice_id:
        rows = [row for row in rows if row.get("hospiceId") == hospice_id]
    return rows
