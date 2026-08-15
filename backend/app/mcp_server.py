"""The MCP surface: every HTTP endpoint, mirrored as a tool.

Mounted into the FastAPI app at `/mcp` (see main.py), so the AI-assisted search bar talks to the
same process the REST API runs in — the same `OrderStore`, the same carts, the same fixtures. An
order created through a tool here fans out over SSE exactly as one created over HTTP does.

Tools are written by hand rather than generated with `FastMCP.from_fastapi`. Most routers return a
bare `list[dict]`, so a generated schema would tell a model nothing about what a row contains; a
docstring per tool is what lets the model pick the right one. Each tool delegates to the same
`services`/`fixtures` call its HTTP twin uses, so there is no second copy of the logic to drift.

Errors are raised as `ToolError`, which reaches the model as readable text instead of a stack trace.
The HTTP status codes their REST twins return have no meaning over MCP, so the message carries the
detail — including, for a rejected transition, which statuses *are* reachable.
"""

from __future__ import annotations

from typing import Any

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError

from . import fixtures
from .ai.usage import get_usage_ledger
from .carts import get_cart_store
from .config import get_settings
from .lifecycle import allowed_next
from .notes import get_note_store
from .services import carts as carts_service
from .services import notes as notes_service
from .services import orders as orders_service
from .store import get_store
from .subscriptions import get_subscription_store

Row = dict[str, Any]

mcp: FastMCP = FastMCP(
    name="BestRx",
    instructions=(
        "Hospice durable-medical-equipment (DME) ordering. Use these tools to search the "
        "equipment catalog and vendor offers, look up patients and orders, read and write the "
        "care-team notes on a patient's chart, and manage a user's cart.\n\n"
        "Two catalogs exist and are not interchangeable: `list_products` returns vendor offers "
        "(per-vendor pricing, what a nurse adds to a cart), while `list_equipment` returns the "
        "raw HCPCS catalog with no prices. `list_vendors` is the simulated storefront; "
        "`list_real_vendors` is real scraped suppliers and carries no pricing.\n\n"
        "Ids follow fixed shapes: orders `DME-#####`, and patients, vendors, offers and users "
        "each carry a string id from their table. Prefer filtering by id over scanning a full "
        "list. Never invent a price, a status, or a patient detail that a tool did not return."
    ),
)

# Read-only tools: safe to call speculatively while answering a search query.
_READ = {"readOnlyHint": True, "idempotentHint": True, "openWorldHint": False}
# Writes. `destructiveHint` is False for creates (they add rather than replace); the two tools that
# replace or discard state say so.
_CREATE = {"readOnlyHint": False, "destructiveHint": False, "openWorldHint": False}
_REPLACE = {"readOnlyHint": False, "destructiveHint": True, "openWorldHint": False}


def _found(row: Row | None, what: str, row_id: str) -> Row:
    """Fixtures return None for a missing id; a tool has to say so out loud."""
    if row is None:
        raise ToolError(f"{what} {row_id} not found")
    return row


# ── Catalog and reference tables ──────────────────────────────────────────────


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_patients(
    hospiceId: str | None = None,
    caseManagerId: str | None = None,
    status: str | None = None,
) -> list[Row]:
    """List patients, optionally filtered.

    Args:
        hospiceId: Restrict to one hospice organisation.
        caseManagerId: Restrict to the patients one case manager owns.
        status: Patient status, e.g. "active".
    """
    rows = fixtures.patients()
    if hospiceId:
        rows = [r for r in rows if r.get("hospiceId") == hospiceId]
    if caseManagerId:
        rows = [r for r in rows if r.get("caseManagerId") == caseManagerId]
    if status:
        rows = [r for r in rows if r.get("status") == status]
    return rows


@mcp.tool(tags={"catalog"}, annotations=_READ)
def get_patient(patientId: str) -> Row:
    """Look up one patient by id, including their address and case manager.

    Args:
        patientId: The patient's id.
    """
    return _found(fixtures.find_by("patients", "id", patientId), "Patient", patientId)


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_products(
    vendorId: str | None = None,
    category: str | None = None,
    inStock: bool | None = None,
) -> list[Row]:
    """List vendor offers — the priced storefront rows a nurse compares and adds to a cart.

    Each row carries an offer id, an HCPCS code, a vendor, and rental and/or purchase pricing.
    This is the tool to use for any question about what something costs.

    Args:
        vendorId: Restrict to one vendor's offers.
        category: Equipment category, e.g. "beds", "mobility".
        inStock: Only offers currently in stock when True.
    """
    rows = fixtures.vendor_offers()
    if vendorId:
        rows = [r for r in rows if r.get("vendorId") == vendorId]
    if category:
        rows = [r for r in rows if r.get("category") == category]
    if inStock is not None:
        rows = [r for r in rows if r.get("inStock") is inStock]
    return rows


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_equipment(category: str | None = None) -> list[Row]:
    """List the raw HCPCS equipment catalog. No prices — use `list_products` for pricing.

    Args:
        category: Equipment category to filter by.
    """
    rows = fixtures.equipment_catalog()
    if category:
        rows = [r for r in rows if r.get("category") == category]
    return rows


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_vendors() -> list[Row]:
    """List the simulated storefront vendors that offers and orders refer to."""
    return fixtures.vendors()


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_hospices() -> list[Row]:
    """List hospice organisations."""
    return fixtures.hospices()


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_users(orgId: str | None = None) -> list[Row]:
    """List demo user identities. No secrets live in this table.

    Args:
        orgId: Restrict to one organisation's users.
    """
    rows = fixtures.users()
    if orgId:
        rows = [r for r in rows if r.get("orgId") == orgId]
    return rows


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_budgets(hospiceId: str | None = None) -> list[Row]:
    """List hospice DME budgets, including per-patient-day (PPD) targets.

    Args:
        hospiceId: Restrict to one hospice.
    """
    rows = fixtures.budgets()
    if hospiceId:
        rows = [r for r in rows if r.get("hospiceId") == hospiceId]
    return rows


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_inventory(vendorId: str | None = None) -> list[Row]:
    """List vendor inventory levels.

    Args:
        vendorId: Restrict to one vendor's stock.
    """
    rows = fixtures.inventory()
    if vendorId:
        rows = [r for r in rows if r.get("vendorId") == vendorId]
    return rows


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_reviews(
    offerId: str | None = None, sort: str = "recent", order: str = "desc"
) -> list[Row]:
    """List product reviews written against vendor offers, newest first by default.

    Args:
        offerId: Restrict to reviews of one offer.
        sort: "recent" (by date) or "rating" (by stars).
        order: "desc" (default) or "asc".
    """
    rows = fixtures.product_reviews()
    if offerId:
        rows = [r for r in rows if r.get("offerId") == offerId]
    return fixtures.sort_reviews(rows, sort, order)


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_emr_events(patientId: str | None = None) -> list[Row]:
    """List EMR events — the clinical signals that prompt a DME order.

    Args:
        patientId: Restrict to one patient's events.
    """
    rows = fixtures.emr_events()
    if patientId:
        rows = [r for r in rows if r.get("patientId") == patientId]
    return rows


@mcp.tool(tags={"catalog"}, annotations=_READ)
def list_real_vendors(
    state: str | None = None,
    scope: str | None = None,
    hcpcs: str | None = None,
    hospiceFocused: bool | None = None,
) -> list[Row]:
    """List real, publicly-listed DME suppliers scraped from public sources.

    Distinct from `list_vendors`, which is the simulated storefront. Rows here carry no pricing and
    no invented operational metrics: unpublished fields are null and every row records a sourceUrl.

    Args:
        state: Two-letter state code, e.g. "UT".
        scope: "national" or "regional".
        hcpcs: HCPCS code the supplier carries, e.g. "E0250".
        hospiceFocused: Only suppliers that market to hospices when True.
    """
    rows = fixtures.real_vendors()
    if state:
        wanted = state.upper()
        rows = [
            r
            for r in rows
            if wanted in (r.get("statesServed") or [])
            or (r.get("headquarters") or {}).get("state") == wanted
            or any(loc.get("state") == wanted for loc in r.get("locations") or [])
        ]
    if scope:
        rows = [r for r in rows if r.get("scope") == scope]
    if hcpcs:
        code = hcpcs.upper()
        rows = [r for r in rows if code in (r.get("hcpcsCarried") or [])]
    if hospiceFocused is not None:
        rows = [r for r in rows if r.get("hospiceFocused") is hospiceFocused]
    return rows


@mcp.tool(tags={"catalog"}, annotations=_READ)
def get_real_vendor(vendorId: str) -> Row:
    """Look up one real DME supplier, with the source URL its facts came from.

    Args:
        vendorId: The supplier's id.
    """
    return _found(fixtures.find_by("real_vendors", "id", vendorId), "Real vendor", vendorId)


# ── Orders ────────────────────────────────────────────────────────────────────


@mcp.tool(tags={"orders"}, annotations=_READ)
def list_orders(
    hospiceId: str | None = None,
    patientId: str | None = None,
    status: str | None = None,
) -> list[Row]:
    """List DME orders, newest first.

    Statuses are: ordered, dispatched, in_transit, delivered (the delivery track), and
    pickup_triggered, picked_up (the pickup track).

    Args:
        hospiceId: Restrict to one hospice's orders.
        patientId: Restrict to one patient's orders.
        status: Restrict to one status.
    """
    return orders_service.list_orders(
        get_store(), hospice_id=hospiceId, patient_id=patientId, status=status
    )


@mcp.tool(tags={"orders"}, annotations=_READ)
def get_order(orderId: str) -> Row:
    """Look up one order together with its full event timeline.

    Args:
        orderId: The order id, e.g. "DME-10001".
    """
    try:
        order, events = orders_service.get_order_with_timeline(get_store(), orderId)
    except orders_service.OrderNotFound as exc:
        raise ToolError(str(exc)) from exc
    return {"order": order, "events": events}


@mcp.tool(tags={"orders"}, annotations=_READ)
def list_all_order_events() -> list[Row]:
    """Every order event across every order, oldest first."""
    return get_store().all_events()


@mcp.tool(tags={"orders"}, annotations=_CREATE)
def create_order(
    patientId: str,
    hospiceId: str,
    equipment: list[Row],
    vendorId: str | None = None,
    orderedById: str | None = None,
    orderType: str = "routine",
    urgency: str = "routine",
    targetBy: str | None = None,
    notes: str = "",
) -> Row:
    """Create a DME order in `ordered` state and open its timeline.

    This is a real write: it notifies every connected client over SSE and enqueues a push
    notification. Confirm the patient and the equipment with the user before calling it.

    Args:
        patientId: The patient the equipment is for.
        hospiceId: The ordering hospice.
        equipment: Line items, each {"hcpcs": str, "name": str, "qty": int, "unit": str}.
        vendorId: The vendor to fulfil the order.
        orderedById: The user placing the order.
        orderType: "routine" or the order's clinical type.
        urgency: "routine" or "stat".
        targetBy: ISO timestamp the order is needed by.
        notes: Free-text note carried on the order.
    """
    try:
        return orders_service.create_order(
            get_store(),
            get_settings(),
            {
                "patientId": patientId,
                "hospiceId": hospiceId,
                "vendorId": vendorId,
                "orderedById": orderedById,
                "orderType": orderType,
                "urgency": urgency,
                "equipment": equipment,
                "targetBy": targetBy,
                "notes": notes,
            },
        )
    except orders_service.UnknownPatient as exc:
        raise ToolError(str(exc)) from exc


@mcp.tool(tags={"orders"}, annotations=_REPLACE)
def update_order_status(
    orderId: str,
    status: str,
    actorId: str | None = None,
    detail: str | None = None,
) -> Row:
    """Move an order to a new status, fan the event out over SSE, and enqueue a push.

    Transitions are forward-only and cannot cross tracks:
    `ordered → dispatched → in_transit → delivered`, and `pickup_triggered → picked_up`.
    `delivered` and `picked_up` are terminal. A rejected transition reports what is reachable.

    Args:
        orderId: The order to move.
        status: The target status.
        actorId: The user making the change.
        detail: Overrides the generated timeline description.
    """
    try:
        order, event = orders_service.change_status(
            get_store(), get_settings(), orderId, status, actor_id=actorId, detail=detail
        )
    except orders_service.OrderNotFound as exc:
        raise ToolError(str(exc)) from exc
    except orders_service.InvalidTransition as exc:
        raise ToolError(
            f"{exc} — order {orderId} is {exc.current}; reachable next: "
            f"{', '.join(exc.allowed) or 'none (terminal)'}"
        ) from exc
    return {"order": order, "event": event}


@mcp.tool(tags={"orders"}, annotations=_READ)
def get_allowed_transitions(orderId: str) -> Row:
    """The statuses an order can move to next. Check this before `update_order_status`.

    Args:
        orderId: The order to inspect.
    """
    order = get_store().get_order(orderId)
    if order is None:
        raise ToolError(f"Order {orderId} not found")
    current = str(order.get("status", ""))
    return {
        "orderId": orderId,
        "currentStatus": current,
        "allowedNext": sorted(allowed_next(current)),
    }


# ── Carts ─────────────────────────────────────────────────────────────────────


def _cart_error(exc: Exception) -> ToolError:
    return ToolError(str(exc))


@mcp.tool(tags={"carts"}, annotations=_READ)
def get_cart(userId: str) -> Row:
    """The user's cart, priced from the current catalog, with totals. Opens an empty one if none.

    Prices are always resolved server-side from the catalog, so a cart can never quote a number the
    catalog disputes.

    Args:
        userId: The user whose cart to read.
    """
    try:
        return carts_service.get_cart(get_cart_store(), userId)
    except carts_service.UnknownUser as exc:
        raise _cart_error(exc) from exc


@mcp.tool(tags={"carts"}, annotations=_REPLACE)
def create_cart(userId: str, lines: list[Row]) -> Row:
    """Open a cart for a user, replacing any cart they already had.

    Args:
        userId: The user to open a cart for.
        lines: Cart lines, each {"offerId": str, "patientId": str, "qty": int, "unit": str},
            where unit is "month" to rent or "each" to buy outright.
    """
    try:
        return carts_service.create_cart(get_cart_store(), userId, lines)
    except carts_service.UnknownUser as exc:
        raise _cart_error(exc) from exc
    except (
        carts_service.UnknownOffer,
        carts_service.UnknownPatient,
        carts_service.UnsellableUnit,
    ) as exc:
        raise _cart_error(exc) from exc


@mcp.tool(tags={"carts"}, annotations=_REPLACE)
def update_cart(userId: str, lines: list[Row]) -> Row:
    """Replace the cart's lines with exactly the list given.

    This is a whole-cart replace, not a patch: send every line the cart should end up with, not
    only the new ones. Read the cart first with `get_cart` if you are adding to it. Duplicate
    (offer, patient, unit) lines are merged server-side.

    Args:
        userId: The user whose cart to replace.
        lines: The complete set of lines, each {"offerId", "patientId", "qty", "unit"}.
    """
    try:
        return carts_service.replace_lines(get_cart_store(), userId, lines)
    except carts_service.UnknownUser as exc:
        raise _cart_error(exc) from exc
    except (
        carts_service.UnknownOffer,
        carts_service.UnknownPatient,
        carts_service.UnsellableUnit,
    ) as exc:
        raise _cart_error(exc) from exc


@mcp.tool(tags={"carts"}, annotations=_REPLACE)
def clear_cart(userId: str) -> Row:
    """Empty the user's cart, discarding every line in it.

    Args:
        userId: The user whose cart to empty.
    """
    cleared = get_cart_store().delete(userId)
    return {"userId": userId, "cleared": cleared}


@mcp.tool(tags={"carts"}, annotations=_CREATE)
def checkout_cart(
    userId: str,
    urgency: str = "routine",
    orderType: str = "routine",
    notes: str = "",
) -> Row:
    """Turn the user's cart into orders — one per (patient, vendor) — and empty it.

    This is a real write: every order created here fans out over SSE and enqueues a push, exactly
    as a single order does. Show the user their cart and get confirmation before calling it.

    Args:
        userId: The user checking out.
        urgency: "routine" or "stat", applied to every created order.
        orderType: The order type applied to every created order.
        notes: A note carried onto every created order.
    """
    try:
        created = carts_service.checkout(
            get_cart_store(),
            get_store(),
            get_settings(),
            userId,
            urgency=urgency,
            order_type=orderType,
            notes=notes,
        )
    except (carts_service.UnknownUser, carts_service.CartNotFound) as exc:
        raise _cart_error(exc) from exc
    except carts_service.EmptyCart as exc:
        raise _cart_error(exc) from exc
    except (carts_service.UnknownOffer, orders_service.UnknownPatient) as exc:
        raise _cart_error(exc) from exc
    return {"orders": created, "orderIds": [order["id"] for order in created]}


# ── Patient notes ─────────────────────────────────────────────────────────────


def _note_error(exc: Exception) -> ToolError:
    return ToolError(str(exc))


@mcp.tool(tags={"notes"}, annotations=_READ)
def list_patient_notes(patientId: str | None = None) -> list[Row]:
    """List care-team notes pinned to patient charts, newest first.

    Notes are free text written by nurses — delivery preferences, equipment observations, family
    logistics. They never contain the patient's own name; a note refers to "patient" or "family".

    Args:
        patientId: Restrict to one patient's chart. Omit for every note.
    """
    return notes_service.list_notes(get_note_store(), patientId)


@mcp.tool(tags={"notes"}, annotations=_CREATE)
def create_patient_note(patientId: str, authorId: str, title: str, body: str) -> Row:
    """Pin a new note to a patient's chart. The whole care team sees it.

    The patient's own first or last name is rejected: refer to them as "patient" or "family".

    Args:
        patientId: The chart the note belongs to.
        authorId: The user writing the note.
        title: Short heading shown on the folded sticky note.
        body: The note text.
    """
    try:
        return notes_service.create_note(get_note_store(), patientId, authorId, title, body)
    except (notes_service.UnknownPatient, notes_service.UnknownUser) as exc:
        raise _note_error(exc) from exc
    except notes_service.InvalidNote as exc:
        raise _note_error(exc) from exc


@mcp.tool(tags={"notes"}, annotations=_REPLACE)
def update_patient_note(noteId: str, title: str, body: str) -> Row:
    """Replace a note's title and body. Its author and creation time are left unchanged.

    This overwrites the existing text rather than appending to it — read the note with
    `list_patient_notes` first if you mean to extend what is already there.

    Args:
        noteId: The note to edit, e.g. "PN-0001".
        title: The replacement heading.
        body: The replacement note text.
    """
    try:
        return notes_service.update_note(get_note_store(), noteId, title, body)
    except (notes_service.NoteNotFound, notes_service.UnknownPatient) as exc:
        raise _note_error(exc) from exc
    except notes_service.InvalidNote as exc:
        raise _note_error(exc) from exc


@mcp.tool(tags={"notes"}, annotations=_REPLACE)
def delete_patient_note(noteId: str) -> Row:
    """Delete a note from a patient's chart. This cannot be undone — confirm with the user first.

    Args:
        noteId: The note to delete.
    """
    try:
        notes_service.delete_note(get_note_store(), noteId)
    except notes_service.NoteNotFound as exc:
        raise _note_error(exc) from exc
    return {"noteId": noteId, "deleted": True}


# ── Push and meta ─────────────────────────────────────────────────────────────


@mcp.tool(tags={"push"}, annotations=_READ)
def get_push_public_key() -> Row:
    """The VAPID public key a browser needs in order to subscribe to push notifications."""
    settings = get_settings()
    if not settings.vapid_public_key:
        raise ToolError(
            "Push is not configured. Run notification-service/scripts/generate_vapid.py and set "
            "VAPID_PUBLIC_KEY."
        )
    return {"publicKey": settings.vapid_public_key}


@mcp.tool(tags={"push"}, annotations=_CREATE)
def subscribe_push(
    endpoint: str,
    p256dh: str,
    auth: str,
    hospiceId: str | None = None,
    userId: str | None = None,
) -> Row:
    """Register a browser push subscription so this user receives order-status notifications.

    Args:
        endpoint: The push endpoint URL the browser supplied.
        p256dh: The subscription's p256dh encryption key.
        auth: The subscription's auth secret.
        hospiceId: The hospice to scope notifications to.
        userId: The subscribing user.
    """
    get_subscription_store(get_settings()).put(
        {
            "endpoint": endpoint,
            "keys": {"p256dh": p256dh, "auth": auth},
            "hospiceId": hospiceId,
            "userId": userId,
            "createdAt": orders_service.now_iso(),
        }
    )
    return {"subscribed": True, "endpoint": endpoint}


@mcp.tool(tags={"push"}, annotations=_REPLACE)
def unsubscribe_push(endpoint: str) -> Row:
    """Remove a browser push subscription, stopping notifications to that endpoint.

    Args:
        endpoint: The push endpoint URL to unsubscribe.
    """
    get_subscription_store(get_settings()).delete(endpoint)
    return {"unsubscribed": True, "endpoint": endpoint}


@mcp.tool(tags={"meta"}, annotations=_READ)
def get_ai_usage() -> Row:
    """Every AI call this process has made, with token counts and what it cost in USD.

    In memory only: a restart clears the ledger, so the totals describe this process, not all time.
    """
    ledger = get_usage_ledger()
    return {"records": ledger.records(), "summary": ledger.summary()}


@mcp.tool(tags={"meta"}, annotations=_READ)
def health() -> Row:
    """API liveness, plus which notification paths are wired and how many SSE clients are live."""
    settings = get_settings()
    return {
        "status": "ok",
        "pushEnabled": settings.push_enabled,
        "subscriptionsPersisted": settings.subscriptions_persisted,
        "streamClients": get_store().subscriber_count,
        "aiEnabled": settings.ai_enabled,
    }
