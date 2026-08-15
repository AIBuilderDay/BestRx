"""Order endpoints, including the status change that drives both notification channels."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from ..config import Settings, get_settings
from ..repository import Repository, get_repository
from ..schemas import CreateOrderRequest, OrderWithTimeline, UpdateStatusRequest
from ..services import orders as service

router = APIRouter(prefix="/orders", tags=["orders"])


def repository(settings: Settings = Depends(get_settings)) -> Repository:
    return get_repository(settings)


@router.get("")
def list_orders(
    hospiceId: str | None = Query(default=None),
    patientId: str | None = Query(default=None),
    status: str | None = Query(default=None),
    repo: Repository = Depends(repository),
) -> list[dict[str, Any]]:
    return service.list_orders(repo, hospice_id=hospiceId, patient_id=patientId, status=status)


@router.get("/{order_id}", response_model=OrderWithTimeline)
def get_order(order_id: str, repo: Repository = Depends(repository)) -> OrderWithTimeline:
    try:
        order, events = service.get_order_with_timeline(repo, order_id)
    except service.OrderNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return OrderWithTimeline(order=order, events=events)


@router.post("", status_code=201)
def create_order(
    payload: CreateOrderRequest,
    repo: Repository = Depends(repository),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    try:
        return service.create_order(repo, settings, payload.model_dump())
    except service.UnknownPatient as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.patch("/{order_id}/status")
def update_status(
    order_id: str,
    payload: UpdateStatusRequest,
    repo: Repository = Depends(repository),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Move an order forward, append its timeline event, and enqueue a push notification."""
    try:
        order, event = service.change_status(
            repo,
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
