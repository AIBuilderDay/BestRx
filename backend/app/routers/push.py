"""Browser push subscription management.

The browser subscribes and hands us an endpoint plus encryption keys; we store them so the
notification service can sign and POST to that endpoint later. The private VAPID key never appears
here — only the public key, which the browser needs in order to subscribe at all.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from ..config import Settings, get_settings
from ..schemas import PushSubscriptionRequest, PushUnsubscribeRequest
from ..services.orders import now_iso
from ..subscriptions import SubscriptionStore, get_subscription_store

router = APIRouter(prefix="/push", tags=["push"])


def subscription_store(settings: Settings = Depends(get_settings)) -> SubscriptionStore:
    return get_subscription_store(settings)


@router.get("/public-key")
def public_key(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    """The VAPID public key the frontend passes to `pushManager.subscribe`."""
    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=503,
            detail=(
                "Push is not configured. Run notification-service/scripts/generate_vapid.py and set "
                "VAPID_PUBLIC_KEY."
            ),
        )
    return {"publicKey": settings.vapid_public_key}


@router.post("/subscribe", status_code=201)
def subscribe(
    payload: PushSubscriptionRequest,
    store: SubscriptionStore = Depends(subscription_store),
) -> dict[str, Any]:
    store.put(
        {
            "endpoint": payload.endpoint,
            "keys": payload.keys.model_dump(),
            "hospiceId": payload.hospiceId,
            "userId": payload.userId,
            "createdAt": now_iso(),
        }
    )
    return {"subscribed": True, "endpoint": payload.endpoint}


@router.delete("/subscribe", status_code=204)
def unsubscribe(
    payload: PushUnsubscribeRequest,
    store: SubscriptionStore = Depends(subscription_store),
) -> Response:
    store.delete(payload.endpoint)
    return Response(status_code=204)
