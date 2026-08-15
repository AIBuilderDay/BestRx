"""Cart endpoints: one open cart per user, and the checkout that turns it into orders."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..carts import CartStore, get_cart_store
from ..config import Settings, get_settings
from ..schemas import CheckoutRequest, CreateCartRequest, UpdateCartRequest
from ..services import carts as service
from ..services import orders as orders_service
from ..store import OrderStore, get_store

router = APIRouter(prefix="/carts", tags=["carts"])


def _not_found(exc: Exception) -> HTTPException:
    return HTTPException(status_code=404, detail=str(exc))


def _unprocessable(exc: Exception) -> HTTPException:
    return HTTPException(status_code=422, detail=str(exc))


@router.post("", status_code=201)
def create_cart(
    payload: CreateCartRequest,
    carts: CartStore = Depends(get_cart_store),
) -> dict[str, Any]:
    """Open a cart for a user. Replaces any cart they already had, so it is safe to retry."""
    try:
        return service.create_cart(
            carts, payload.userId, [line.model_dump() for line in payload.lines]
        )
    except service.UnknownUser as exc:
        raise _not_found(exc) from exc
    except (service.UnknownOffer, service.UnknownPatient) as exc:
        raise _unprocessable(exc) from exc


@router.get("/{user_id}")
def get_cart(user_id: str, carts: CartStore = Depends(get_cart_store)) -> dict[str, Any]:
    """The user's cart, priced from the current catalog. Creates an empty one on first read."""
    try:
        return service.get_cart(carts, user_id)
    except service.UnknownUser as exc:
        raise _not_found(exc) from exc


@router.put("/{user_id}")
def update_cart(
    user_id: str,
    payload: UpdateCartRequest,
    carts: CartStore = Depends(get_cart_store),
) -> dict[str, Any]:
    """Replace the cart's lines with exactly what the client sent."""
    try:
        return service.replace_lines(carts, user_id, [line.model_dump() for line in payload.lines])
    except service.UnknownUser as exc:
        raise _not_found(exc) from exc
    except (service.UnknownOffer, service.UnknownPatient) as exc:
        raise _unprocessable(exc) from exc


@router.delete("/{user_id}", status_code=204)
def delete_cart(user_id: str, carts: CartStore = Depends(get_cart_store)) -> None:
    service.clear_cart(carts, user_id)


@router.post("/{user_id}/checkout", status_code=201)
def checkout(
    user_id: str,
    payload: CheckoutRequest,
    carts: CartStore = Depends(get_cart_store),
    store: OrderStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Convert the cart into orders — one per (patient, vendor) — and empty it.

    Every order created here goes through the same service call a single order does, so each one
    fans out over SSE and enqueues a push exactly as it would otherwise.
    """
    try:
        created = service.checkout(
            carts,
            store,
            settings,
            user_id,
            urgency=payload.urgency,
            order_type=payload.orderType,
            notes=payload.notes,
        )
    except (service.UnknownUser, service.CartNotFound) as exc:
        raise _not_found(exc) from exc
    except service.EmptyCart as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (service.UnknownOffer, orders_service.UnknownPatient) as exc:
        raise _unprocessable(exc) from exc

    return {"orders": created, "orderIds": [order["id"] for order in created]}
