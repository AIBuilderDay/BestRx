#!/usr/bin/env python3
"""Load the JSON fixtures into DynamoDB.

Run once after `terraform apply`, and again whenever you want to reset a demo. Terraform provisions
tables; scripts populate them.

    uv run python scripts/seed.py --prefix bestrx --region us-east-2

Idempotent: a re-run overwrites the same rows by primary key. The six `"canonical": true` orders from
the bounty organizers are written verbatim, per docs/DATA_MODEL.md.
"""

from __future__ import annotations

import argparse
import sys
from decimal import Decimal
from pathlib import Path
from typing import Any

import boto3

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.fixtures import seed_order_events, seed_orders  # noqa: E402


def to_dynamo(value: Any) -> Any:
    """DynamoDB has no float type and the fixtures are full of prices and risk scores."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {key: to_dynamo(item) for key, item in value.items()}
    if isinstance(value, list):
        return [to_dynamo(item) for item in value]
    return value


def seed_orders_table(table: Any, rows: list[dict[str, Any]]) -> int:
    with table.batch_writer() as batch:
        for row in rows:
            batch.put_item(Item=to_dynamo(row))
    return len(rows)


def seed_events_table(table: Any, rows: list[dict[str, Any]]) -> int:
    """Write events in chronological order so `seq` matches the fixture timeline.

    The SSE Lambda pages forward on `seq`, so it has to agree with the order things happened in.
    """
    ordered = sorted(rows, key=lambda event: event.get("at", ""))

    with table.batch_writer() as batch:
        for index, row in enumerate(ordered, start=1):
            batch.put_item(Item=to_dynamo({**row, "seq": index, "stream": "ALL"}))

    # The counter the API atomically increments for every new event. Start it past the seeded rows
    # so a fresh event never collides with a fixture one.
    table.put_item(
        Item={
            "orderId": "__counter__",
            "at": "__counter__",
            "value": Decimal(len(ordered)),
        }
    )
    return len(ordered)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prefix", default="bestrx")
    parser.add_argument("--region", default="us-east-2")
    parser.add_argument("--profile", default="default")
    args = parser.parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    dynamodb = session.resource("dynamodb")

    orders = seed_orders()
    events = seed_order_events()
    if not orders:
        print("No fixtures found. Run `task backend:sync-data` first.")
        return 1

    written_orders = seed_orders_table(dynamodb.Table(f"{args.prefix}-orders"), orders)
    written_events = seed_events_table(dynamodb.Table(f"{args.prefix}-order-events"), events)

    canonical = sum(1 for order in orders if order.get("canonical"))
    print(f"Seeded {written_orders} orders ({canonical} canonical) and {written_events} events.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
