"""Order endpoints, including the status change that drives both notification channels."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import Settings, get_settings
from ..schemas import CreateOrderRequest, OrderWithTimeline, UpdateStatusRequest
from ..services import orders as service
from ..store import BaseOrderStore, get_store

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("")
def list_orders(
    hospiceId: str | None = Query(default=None),
    patientId: str | None = Query(default=None),
    status: str | None = Query(default=None),
    store: BaseOrderStore = Depends(get_store),
) -> list[dict[str, Any]]:
    return service.list_orders(store, hospice_id=hospiceId, patient_id=patientId, status=status)


@router.get("/events/all")
def list_all_events(store: BaseOrderStore = Depends(get_store)) -> list[dict[str, Any]]:
    """Every order event in one response, for the frontend's boot snapshot.

    Declared above /{order_id} so "events" is not captured as an order id.
    """
    return store.all_events()


@router.get("/{order_id}", response_model=OrderWithTimeline)
def get_order(order_id: str, store: BaseOrderStore = Depends(get_store)) -> OrderWithTimeline:
    try:
        order, events = service.get_order_with_timeline(store, order_id)
    except service.OrderNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return OrderWithTimeline(order=order, events=events)


@router.post("", status_code=201)
def create_order(
    payload: CreateOrderRequest,
    store: BaseOrderStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    try:
        return service.create_order(store, settings, payload.model_dump())
    except service.UnknownPatient as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/{order_id}/status")
def update_status(
    order_id: str,
    payload: UpdateStatusRequest,
    store: BaseOrderStore = Depends(get_store),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Move an order forward, fan the event out over SSE, and enqueue a push notification."""
    try:
        order, event = service.change_status(
            store,
            settings,
            order_id,
            payload.status,
            actor_id=payload.actorId,
            detail=payload.detail,
        )
    except service.OrderNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.InvalidTransition as exc:
        # 409 carries what *is* possible, so a client can show the user the real options.
        raise HTTPException(
            status_code=409,
            detail={
                "message": str(exc),
                "currentStatus": exc.current,
                "allowedNext": exc.allowed,
            },
        ) from exc

    return {"order": order, "event": event}
