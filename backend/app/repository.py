"""Storage for orders, events, and push subscriptions.

Two implementations behind one protocol:

- `DynamoRepository` — what runs in AWS. Lambda is ephemeral, so writes have to land somewhere real.
- `MemoryRepository` — seeded from the JSON fixtures, used when no tables are configured. This is
  what makes `uvicorn app.main:app` work locally with no AWS account. Writes vanish on restart,
  which is fine for local work and honest about what it is.

Order events carry a monotonic `seq`. The SSE Lambda pages forward on it, so a reconnecting browser
resumes exactly where it left off instead of replaying or skipping.
"""

from __future__ import annotations

import threading
from decimal import Decimal
from typing import Any, Protocol

from .config import Settings
from .fixtures import seed_order_events, seed_orders

Row = dict[str, Any]


def _to_dynamo(value: Any) -> Any:
    """DynamoDB rejects floats; the fixtures are full of prices and risk scores."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: _to_dynamo(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_to_dynamo(item) for item in value]
    return value


def _from_dynamo(value: Any) -> Any:
    """Decimals back to int/float so FastAPI can serialize them."""
    if isinstance(value, Decimal):
        as_int = int(value)
        return as_int if value == as_int else float(value)
    if isinstance(value, dict):
        return {key: _from_dynamo(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_from_dynamo(item) for item in value]
    return value


class Repository(Protocol):
    def list_orders(self) -> list[Row]: ...
    def get_order(self, order_id: str) -> Row | None: ...
    def put_order(self, order: Row) -> None: ...
    def events_for_order(self, order_id: str) -> list[Row]: ...
    def append_event(self, event: Row) -> Row: ...
    def events_since(self, seq: int, limit: int = 100) -> list[Row]: ...
    def put_subscription(self, subscription: Row) -> None: ...
    def delete_subscription(self, endpoint: str) -> None: ...
    def list_subscriptions(self) -> list[Row]: ...


class MemoryRepository:
    """In-process store seeded from the JSON fixtures."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._orders: dict[str, Row] = {row["id"]: dict(row) for row in seed_orders()}

        # Seed events in timeline order so the assigned seq matches the fixture chronology.
        self._events: list[Row] = []
        for index, row in enumerate(
            sorted(seed_order_events(), key=lambda event: event.get("at", "")), start=1
        ):
            self._events.append({**row, "seq": index})

        self._next_seq = len(self._events) + 1
        self._subscriptions: dict[str, Row] = {}

    def list_orders(self) -> list[Row]:
        with self._lock:
            return [dict(order) for order in self._orders.values()]

    def get_order(self, order_id: str) -> Row | None:
        with self._lock:
            order = self._orders.get(order_id)
            return dict(order) if order else None

    def put_order(self, order: Row) -> None:
        with self._lock:
            self._orders[order["id"]] = dict(order)

    def events_for_order(self, order_id: str) -> list[Row]:
        with self._lock:
            matches = [dict(e) for e in self._events if e.get("orderId") == order_id]
        return sorted(matches, key=lambda event: event.get("at", ""))

    def append_event(self, event: Row) -> Row:
        with self._lock:
            stored = {**event, "seq": self._next_seq}
            self._next_seq += 1
            self._events.append(stored)
            return dict(stored)

    def events_since(self, seq: int, limit: int = 100) -> list[Row]:
        with self._lock:
            newer = [dict(e) for e in self._events if e.get("seq", 0) > seq]
        newer.sort(key=lambda event: event.get("seq", 0))
        return newer[:limit]

    def put_subscription(self, subscription: Row) -> None:
        with self._lock:
            self._subscriptions[subscription["endpoint"]] = dict(subscription)

    def delete_subscription(self, endpoint: str) -> None:
        with self._lock:
            self._subscriptions.pop(endpoint, None)

    def list_subscriptions(self) -> list[Row]:
        with self._lock:
            return [dict(sub) for sub in self._subscriptions.values()]


class DynamoRepository:
    """DynamoDB-backed store. Tables are created by Terraform and seeded by scripts/seed.py."""

    # One partition for the event stream. The dataset is a single hospice network at demo scale,
    # so a hot partition is not a concern; a real deployment would shard this by hospice.
    STREAM_PARTITION = "ALL"

    def __init__(self, settings: Settings) -> None:
        import boto3  # imported lazily so local runs need no AWS SDK configuration

        dynamodb = boto3.resource("dynamodb", region_name=settings.aws_region)
        self._orders = dynamodb.Table(settings.orders_table)
        self._events = dynamodb.Table(settings.order_events_table)
        self._subscriptions = (
            dynamodb.Table(settings.push_subscriptions_table)
            if settings.push_subscriptions_table
            else None
        )

    def list_orders(self) -> list[Row]:
        rows: list[Row] = []
        kwargs: dict[str, Any] = {}
        while True:
            response = self._orders.scan(**kwargs)
            rows.extend(response.get("Items", []))
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            kwargs["ExclusiveStartKey"] = last_key
        return [_from_dynamo(row) for row in rows]

    def get_order(self, order_id: str) -> Row | None:
        response = self._orders.get_item(Key={"id": order_id})
        item = response.get("Item")
        return _from_dynamo(item) if item else None

    def put_order(self, order: Row) -> None:
        self._orders.put_item(Item=_to_dynamo(order))

    def events_for_order(self, order_id: str) -> list[Row]:
        from boto3.dynamodb.conditions import Key

        response = self._events.query(
            KeyConditionExpression=Key("orderId").eq(order_id),
            ScanIndexForward=True,
        )
        return [_from_dynamo(row) for row in response.get("Items", [])]

    def append_event(self, event: Row) -> Row:
        stored = {**event, "seq": self._next_sequence(), "stream": self.STREAM_PARTITION}
        self._events.put_item(Item=_to_dynamo(stored))
        return _from_dynamo(stored)

    def _next_sequence(self) -> int:
        """Monotonic counter kept as a row in the events table.

        A single atomic ADD, so concurrent writers can never be handed the same seq.
        """
        response = self._events.update_item(
            Key={"orderId": "__counter__", "at": "__counter__"},
            UpdateExpression="ADD #value :increment",
            ExpressionAttributeNames={"#value": "value"},
            ExpressionAttributeValues={":increment": Decimal(1)},
            ReturnValues="UPDATED_NEW",
        )
        return int(response["Attributes"]["value"])

    def events_since(self, seq: int, limit: int = 100) -> list[Row]:
        from boto3.dynamodb.conditions import Key

        response = self._events.query(
            IndexName="by-seq",
            KeyConditionExpression=(
                Key("stream").eq(self.STREAM_PARTITION) & Key("seq").gt(Decimal(seq))
            ),
            ScanIndexForward=True,
            Limit=limit,
        )
        return [_from_dynamo(row) for row in response.get("Items", [])]

    def put_subscription(self, subscription: Row) -> None:
        if self._subscriptions is None:
            return
        self._subscriptions.put_item(Item=_to_dynamo(subscription))

    def delete_subscription(self, endpoint: str) -> None:
        if self._subscriptions is None:
            return
        self._subscriptions.delete_item(Key={"endpoint": endpoint})

    def list_subscriptions(self) -> list[Row]:
        if self._subscriptions is None:
            return []
        response = self._subscriptions.scan()
        return [_from_dynamo(row) for row in response.get("Items", [])]


_repository: Repository | None = None
_repository_lock = threading.Lock()


def get_repository(settings: Settings) -> Repository:
    """One repository per process, reused across Lambda invocations."""
    global _repository
    if _repository is None:
        with _repository_lock:
            if _repository is None:
                _repository = (
                    DynamoRepository(settings) if settings.use_dynamodb else MemoryRepository()
                )
    return _repository


def reset_repository() -> None:
    """Drop the cached repository. Used by tests."""
    global _repository
    with _repository_lock:
        _repository = None
