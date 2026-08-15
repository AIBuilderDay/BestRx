"""Request and response shapes.

Responses are the raw fixture rows, so the frontend's existing `types/domain.ts` keeps describing
them exactly. Only request bodies are modelled strictly — those are the boundary where a bad
payload has to be rejected rather than stored.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .lifecycle import ALL_STATUSES

OrderStatus = Literal[
    "ordered", "dispatched", "in_transit", "delivered", "pickup_triggered", "picked_up"
]


class EquipmentItemIn(BaseModel):
    hcpcs: str = Field(min_length=1)
    name: str = Field(min_length=1)
    qty: int = Field(ge=1)


class CreateOrderRequest(BaseModel):
    patientId: str = Field(min_length=1)
    hospiceId: str = Field(min_length=1)
    vendorId: str | None = None
    orderedById: str | None = None
    orderType: Literal["admission", "routine", "resupply", "pickup"] = "routine"
    urgency: Literal["stat", "urgent", "routine"] = "routine"
    equipment: list[EquipmentItemIn] = Field(min_length=1)
    targetBy: str | None = None
    notes: str = ""


class UpdateStatusRequest(BaseModel):
    status: OrderStatus
    actorId: str | None = None
    detail: str | None = None


class PushSubscriptionKeys(BaseModel):
    p256dh: str = Field(min_length=1)
    auth: str = Field(min_length=1)


class PushSubscriptionRequest(BaseModel):
    endpoint: str = Field(min_length=1)
    keys: PushSubscriptionKeys
    # Scopes notifications to one hospice so a nurse is not woken for another network's orders.
    hospiceId: str | None = None
    userId: str | None = None


class PushUnsubscribeRequest(BaseModel):
    endpoint: str = Field(min_length=1)


class StatusErrorDetail(BaseModel):
    """Body of a 409, so a client can show the user what is actually possible."""

    message: str
    currentStatus: str
    allowedNext: list[str]


class OrderWithTimeline(BaseModel):
    order: dict[str, Any]
    events: list[dict[str, Any]]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    storage: Literal["dynamodb", "memory"]
    pushEnabled: bool
    knownStatuses: list[str] = Field(default_factory=lambda: list(ALL_STATUSES))
