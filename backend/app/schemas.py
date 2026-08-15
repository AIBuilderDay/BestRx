"""Request and response shapes.

Responses are the raw fixture rows, so the frontend's existing `types/domain.ts` keeps describing
them exactly. Only request bodies are modelled strictly — those are the boundary where a bad
payload has to be rejected rather than stored.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from .carts import MAX_LINE_QTY
from .lifecycle import ALL_STATUSES

OrderStatus = Literal[
    "ordered", "dispatched", "in_transit", "delivered", "pickup_triggered", "picked_up"
]


class EquipmentItemIn(BaseModel):
    hcpcs: str = Field(min_length=1)
    name: str = Field(min_length=1)
    qty: int = Field(ge=1)
    # Absent on orders placed before rent-vs-buy existed: readers fall back to the offer's default.
    unit: Literal["month", "purchase"] | None = None


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


class CartLineIn(BaseModel):
    """A cart line is an offer and a quantity. Prices are never accepted from the client — they are
    resolved from vendor_offers server-side so a cart cannot quote a number the catalog disputes."""

    offerId: str = Field(min_length=1)
    patientId: str = Field(min_length=1)
    # Which arrangement the client picked. Validated against the offer, which must sell it.
    unit: Literal["month", "purchase"] = "month"
    qty: int = Field(ge=1, le=MAX_LINE_QTY)


class CreateCartRequest(BaseModel):
    userId: str = Field(min_length=1)
    lines: list[CartLineIn] = Field(default_factory=list)


class UpdateCartRequest(BaseModel):
    """A whole-cart replace: the client sends the complete line list it wants stored."""

    lines: list[CartLineIn]


class CheckoutRequest(BaseModel):
    urgency: Literal["stat", "urgent", "routine"] = "routine"
    orderType: Literal["admission", "routine", "resupply", "pickup"] = "routine"
    notes: str = ""


class CreateNoteRequest(BaseModel):
    """A care-team note being pinned to a chart. Length caps match the sticky note it renders on."""

    authorId: str = Field(min_length=1)
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=2000)


class UpdateNoteRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=2000)


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


class RerankRequest(BaseModel):
    """What the browser sends to rank a search. Offer ids only — the facts are joined server-side."""

    query: str = Field(min_length=1, max_length=500)
    offerIds: list[str] = Field(min_length=1, max_length=200)
    """Scopes the patient pool the query may be matched against. Names never leave the API."""
    hospiceId: str | None = None


class AgentOrderRequest(BaseModel):
    """A plain-English order command, and the nurse whose cart it fills."""

    command: str = Field(min_length=1, max_length=500)
    userId: str = Field(min_length=1)


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
    pushEnabled: bool
    """False locally: subscriptions are in memory and do not survive a restart."""
    subscriptionsPersisted: bool
    """How many browsers currently hold an SSE connection."""
    streamClients: int
    """False when no ANTHROPIC_API_KEY is set: /ai/* answers 503 and the UI hides AI search."""
    aiEnabled: bool = False
    knownStatuses: list[str] = Field(default_factory=lambda: list(ALL_STATUSES))
