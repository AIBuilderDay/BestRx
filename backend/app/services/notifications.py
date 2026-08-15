"""Handing an order event to the notification service.

The API's entire responsibility is one SQS send. It never calls a push service, so a slow or failing
FCM cannot make an order update slow or fail — that decoupling is the reason the queue exists.

Push is best-effort. If the send fails the order update has already been committed, so we log and
carry on: the live SSE channel still works and the user still sees the change.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ..config import Settings

logger = logging.getLogger(__name__)

_client: Any | None = None


def _sqs(settings: Settings) -> Any:
    global _client
    if _client is None:
        import boto3

        _client = boto3.client("sqs", region_name=settings.aws_region)
    return _client


def reset_client() -> None:
    """Drop the cached SQS client. Used by tests."""
    global _client
    _client = None


def build_message(order: dict[str, Any], event: dict[str, Any]) -> dict[str, Any]:
    """The payload the push Lambda turns into a notification.

    Everything here comes from the order or its event — no invented facts, per CLAUDE.md.
    """
    return {
        "type": "order.status_changed",
        "orderId": order["id"],
        "status": order["status"],
        "hospiceId": order.get("hospiceId"),
        "patientId": order.get("patientId"),
        "vendorId": order.get("vendorId"),
        "urgency": order.get("urgency"),
        "at": event.get("at"),
        "seq": event.get("seq"),
        "detail": event.get("detail", ""),
    }


def publish_status_change(
    settings: Settings, order: dict[str, Any], event: dict[str, Any]
) -> bool:
    """Enqueue one status change. Returns whether it was accepted by SQS."""
    if not settings.push_enabled:
        logger.debug("push queue not configured; skipping enqueue for %s", order["id"])
        return False

    message = build_message(order, event)
    try:
        _sqs(settings).send_message(
            QueueUrl=settings.push_queue_url,
            MessageBody=json.dumps(message),
        )
    except Exception:  # noqa: BLE001 - the order update is already committed; never fail the request
        logger.exception("failed to enqueue push for order %s", order["id"])
        return False
    return True
