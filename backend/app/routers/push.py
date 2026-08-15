"""Browser push subscription management.

The browser subscribes and hands us an endpoint plus encryption keys; we store them so the push
Lambda can sign and POST to that endpoint later. The private VAPID key never appears here — only
the public key, which the browser needs to subscribe in the first place.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from ..config import Settings, get_settings
from ..repository import Repository, get_repository
from ..schemas import PushSubscriptionRequest, PushUnsubscribeRequest
from ..services.orders import now_iso

router = APIRouter(prefix="/push", tags=["push"])


def repository(settings: Settings = Depends(get_settings)) -> Repository:
    return get_repository(settings)


@router.get("/public-key")
def public_key(settings: Settings = Depends(get_settings)) -> dict[str, str]:
    """The VAPID public key the frontend passes to `pushManager.subscribe`."""
    if not settings.vapid_public_key:
        raise HTTPException(
            status_code=503,
            detail="Push is not configured. Run scripts/generate_vapid.py and set VAPID_PUBLIC_KEY.",
        )
    return {"publicKey": settings.vapid_public_key}


@router.post("/subscribe", status_code=201)
def subscribe(
    payload: PushSubscriptionRequest,
    repo: Repository = Depends(repository),
) -> dict[str, Any]:
    subscription = {
        "endpoint": payload.endpoint,
        "keys": payload.keys.model_dump(),
        "hospiceId": payload.hospiceId,
        "userId": payload.userId,
        "createdAt": now_iso(),
    }
    repo.put_subscription(subscription)
    return {"subscribed": True, "endpoint": payload.endpoint}


@router.delete("/subscribe", status_code=204)
def unsubscribe(
    payload: PushUnsubscribeRequest,
    repo: Repository = Depends(repository),
) -> Response:
    repo.delete_subscription(payload.endpoint)
    return Response(status_code=204)
