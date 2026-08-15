"""Token ledger: every model call is recorded here, split by feature plus a grand total.

This is the data the cost dashboard renders — do not build UI on top of it in this module.

In memory, same trade as the order store: no database, and a restart returns to a known-good state.
It lives server-side rather than in localStorage because the model calls do: the browser no longer
knows what a call cost, and one ledger across every client is easier to demo than one per browser.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any, Literal

Row = dict[str, Any]

Feature = Literal["rerank", "agent_order"]

# USD per 1M tokens, used to price each call. Keep in step with the model in Settings.ai_model.
MODEL_PRICES_PER_MTOK: dict[str, dict[str, float]] = {
    "claude-haiku-4-5": {"input": 1.0, "output": 5.0},
    "claude-sonnet-5": {"input": 3.0, "output": 15.0},
    "claude-opus-5": {"input": 5.0, "output": 25.0},
}

# How many individual calls to keep. The totals are exact regardless — only the per-call list is
# trimmed, so a long demo cannot grow this without bound.
MAX_RECORDS = 500

_EMPTY_TOTALS: Row = {"calls": 0, "inputTokens": 0, "outputTokens": 0, "costUsd": 0.0}


def price_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """0.0 for a model we have no published price for — never guess a number the UI would show."""
    prices = MODEL_PRICES_PER_MTOK.get(model)
    if prices is None:
        return 0.0
    return (input_tokens * prices["input"] + output_tokens * prices["output"]) / 1_000_000


class UsageLedger:
    """Every AI call, and the running totals the cost view reads."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._records: list[Row] = []
        self._next_id = 1

    def record(
        self,
        *,
        feature: Feature,
        model: str,
        input_tokens: int,
        output_tokens: int,
        latency_ms: int,
        ok: bool,
    ) -> Row:
        """Append one call. Never raises — cost tracking must not break the feature it tracks."""
        with self._lock:
            record: Row = {
                "id": f"AIU-{self._next_id:05d}",
                "at": datetime.now(UTC).isoformat(),
                "feature": feature,
                "model": model,
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "costUsd": price_usd(model, input_tokens, output_tokens),
                "latencyMs": latency_ms,
                "ok": ok,
            }
            self._next_id += 1
            self._records.append(record)
            if len(self._records) > MAX_RECORDS:
                del self._records[: len(self._records) - MAX_RECORDS]
            return dict(record)

    def records(self) -> list[Row]:
        with self._lock:
            return [dict(record) for record in self._records]

    def summary(self) -> Row:
        """Per-feature and total spend — the shape the cost dashboard consumes."""
        totals: dict[str, Row] = {
            "rerank": dict(_EMPTY_TOTALS),
            "agent_order": dict(_EMPTY_TOTALS),
        }
        total = dict(_EMPTY_TOTALS)
        for record in self.records():
            bucket = totals.get(str(record["feature"]))
            for target in (bucket, total):
                if target is None:
                    continue
                target["calls"] += 1
                target["inputTokens"] += record["inputTokens"]
                target["outputTokens"] += record["outputTokens"]
                target["costUsd"] += record["costUsd"]
        return {"byFeature": totals, "total": total}

    def clear(self) -> None:
        """Test and demo helper."""
        with self._lock:
            self._records.clear()
            self._next_id = 1


_ledger: UsageLedger | None = None


def get_usage_ledger() -> UsageLedger:
    global _ledger
    if _ledger is None:
        _ledger = UsageLedger()
    return _ledger


def reset_usage_ledger() -> None:
    """Drop the ledger so the next call builds a fresh one. Used by the test fixtures."""
    global _ledger
    _ledger = None
