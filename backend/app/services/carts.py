"""Cart contents and checkout.

The cart is stored as offer ids and quantities, never as prices. Prices are resolved from
`vendor_offers` on every read, so a cart can never quote a number the catalog does not agree with —
which is the same rule the UI is held to (no invented figures, see CLAUDE.md).

`checkout` is where a cart becomes orders. It groups lines by (patient, vendor): an order in this
data model carries one patientId, and a real DME dispatch goes to one vendor, so a cart spanning
three patients across two vendors becomes up to six orders rather than one unshippable blob.
"""

from __future__ import annotations

from typing import Any

from ..carts import MAX_LINE_QTY, CartStore
from ..config import Settings
from ..fixtures import find_by
from ..store import OrderStore
from . import orders as orders_service

Row = dict[str, Any]


class UnknownUser(Exception):
    def __init__(self, user_id: str) -> None:
        super().__init__(f"User {user_id} not found")
        self.user_id = user_id


class UnknownOffer(Exception):
    def __init__(self, offer_id: str) -> None:
        super().__init__(f"Offer {offer_id} not found")
        self.offer_id = offer_id


class UnknownPatient(Exception):
    def __init__(self, patient_id: str) -> None:
        super().__init__(f"Patient {patient_id} not found")
        self.patient_id = patient_id


class CartNotFound(Exception):
    def __init__(self, user_id: str) -> None:
        super().__init__(f"No cart for user {user_id}")
        self.user_id = user_id


class EmptyCart(Exception):
    def __init__(self, user_id: str) -> None:
        super().__init__(f"Cart for user {user_id} is empty")
        self.user_id = user_id


def _require_user(user_id: str) -> Row:
    user = find_by("users", "id", user_id)
    if user is None:
        raise UnknownUser(user_id)
    return user


def _merge_lines(raw_lines: list[Row]) -> list[Row]:
    """Validate each line against the catalog, then collapse duplicate (offer, patient) pairs.

    Merging server-side means a client that adds the same item twice gets one line of qty 2 rather
    than two lines the totals would double-count.
    """
    merged: dict[tuple[str, str], Row] = {}
    for raw in raw_lines:
        offer_id = raw["offerId"]
        patient_id = raw["patientId"]

        if find_by("vendor_offers", "id", offer_id) is None:
            raise UnknownOffer(offer_id)
        if find_by("patients", "id", patient_id) is None:
            raise UnknownPatient(patient_id)

        key = (offer_id, patient_id)
        existing = merged.get(key)
        qty = raw["qty"] + (existing["qty"] if existing else 0)
        merged[key] = {"offerId": offer_id, "patientId": patient_id, "qty": min(qty, MAX_LINE_QTY)}

    return list(merged.values())


def _priced_line(line: Row) -> Row:
    """One stored line plus the catalog facts the client needs to render it."""
    offer = find_by("vendor_offers", "id", line["offerId"]) or {}
    price = float(offer.get("priceUsd", 0))
    return {
        **line,
        "hcpcs": offer.get("hcpcs"),
        "productName": offer.get("productName"),
        "vendorId": offer.get("vendorId"),
        "unit": offer.get("unit"),
        "priceUsd": price,
        "lineTotalUsd": round(price * line["qty"], 2),
    }


def _totals(priced: list[Row]) -> Row:
    """Rentals and one-time purchases stay separate: they are not the same dollar."""
    monthly = sum(line["lineTotalUsd"] for line in priced if line.get("unit") == "month")
    one_time = sum(line["lineTotalUsd"] for line in priced if line.get("unit") != "month")
    return {
        "monthlyUsd": round(monthly, 2),
        "oneTimeUsd": round(one_time, 2),
        "firstMonthUsd": round(monthly + one_time, 2),
        "unitCount": sum(line["qty"] for line in priced),
        "lineCount": len(priced),
    }


def view(cart: Row) -> Row:
    """The wire shape: stored lines, enriched with current catalog prices and totals."""
    priced = [_priced_line(line) for line in cart.get("lines", [])]
    return {**cart, "lines": priced, "totals": _totals(priced)}


def get_cart(carts: CartStore, user_id: str) -> Row:
    """The user's cart, creating an empty one on first read so the client always has an id."""
    _require_user(user_id)
    cart = carts.get(user_id)
    if cart is None:
        cart = create_cart(carts, user_id, [])
        return cart
    return view(cart)


def create_cart(carts: CartStore, user_id: str, raw_lines: list[Row]) -> Row:
    """Open a cart for a user, replacing any cart they already had.

    Replacing rather than erroring keeps this idempotent: a client that lost its local state can
    POST a fresh cart without first working out whether one exists.
    """
    user = _require_user(user_id)
    cart: Row = {
        "id": carts.next_cart_id(),
        "userId": user_id,
        "hospiceId": user.get("orgId"),
        "lines": _merge_lines(raw_lines),
        "updatedAt": orders_service.now_iso(),
    }
    return view(carts.put(cart))


def replace_lines(carts: CartStore, user_id: str, raw_lines: list[Row]) -> Row:
    """Set the cart's lines to exactly what the client sent.

    A whole-cart replace rather than per-line patching: the client already holds the full list, and
    one shape of update means there is no ordering question between concurrent edits.
    """
    _require_user(user_id)
    existing = carts.get(user_id)
    if existing is None:
        return create_cart(carts, user_id, raw_lines)

    existing["lines"] = _merge_lines(raw_lines)
    existing["updatedAt"] = orders_service.now_iso()
    return view(carts.put(existing))


def clear_cart(carts: CartStore, user_id: str) -> None:
    carts.delete(user_id)


def checkout(
    carts: CartStore,
    store: OrderStore,
    settings: Settings,
    user_id: str,
    urgency: str = "routine",
    order_type: str = "routine",
    notes: str = "",
) -> list[Row]:
    """Turn the cart into orders, one per (patient, vendor), and empty it.

    Each created order goes through `orders_service.create_order`, so a checkout reaches SSE and the
    push queue by exactly the same path a single order does — there is no second, quieter way for an
    order to come into existence.
    """
    user = _require_user(user_id)
    cart = carts.get(user_id)
    if cart is None:
        raise CartNotFound(user_id)

    lines = cart.get("lines", [])
    if not lines:
        raise EmptyCart(user_id)

    # (patientId, vendorId) -> merged equipment items, keyed by HCPCS so two offers for the same
    # code from one vendor become a single line on the order.
    grouped: dict[tuple[str, str | None], dict[str, Row]] = {}
    for line in lines:
        offer = find_by("vendor_offers", "id", line["offerId"])
        if offer is None:
            raise UnknownOffer(line["offerId"])

        key = (line["patientId"], offer.get("vendorId"))
        items = grouped.setdefault(key, {})
        hcpcs = offer["hcpcs"]
        if hcpcs in items:
            items[hcpcs]["qty"] += line["qty"]
        else:
            items[hcpcs] = {
                "hcpcs": hcpcs,
                "name": offer.get("productName", hcpcs),
                "qty": line["qty"],
            }

    created: list[Row] = []
    for (patient_id, vendor_id), items in grouped.items():
        created.append(
            orders_service.create_order(
                store,
                settings,
                {
                    "patientId": patient_id,
                    "hospiceId": user.get("orgId"),
                    "vendorId": vendor_id,
                    "orderedById": user_id,
                    "orderType": order_type,
                    "urgency": urgency,
                    "equipment": list(items.values()),
                    "notes": notes,
                },
            )
        )

    carts.delete(user_id)
    return created
