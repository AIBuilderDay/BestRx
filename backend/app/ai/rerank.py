"""Smart search: ask the model to re-order catalog offers for a query and, when the query names
one, a sanitized patient.

Single-shot with structured output rather than a tool loop: search is the latency-critical path —
a nurse is waiting on results — and the model needs no data beyond the offers it is ranking. The
offer ids are locked in a schema enum, so the model cannot answer with an id we do not have.

Contract with callers: on ANY failure this raises, the router answers 502, and the frontend keeps
the deterministic order it already rendered. AI is an enhancement, never a dependency.
"""

from __future__ import annotations

import json
import time
from typing import Any

from ..config import Settings
from .client import get_client
from .facts import offer_facts
from .usage import get_usage_ledger

Row = dict[str, Any]

SYSTEM_PROMPT = """You rank durable medical equipment offers for a hospice nurse's search.
Order the offers best-first for THIS query and, when given, THIS patient. Weigh, in roughly this
order:
1. Clinical fit for the query and the patient's diagnosis, age, and status.
2. Delivery speed — a patient pending discharge needs equipment before the discharge time; closer
   ZIP and shorter lead time win.
3. Nurse rating, then price.
Only use the data provided. Never invent products, prices, or delivery times.
Give a short plain-English reason (max 12 words) for each of your top choices; reasons must only
cite facts present in the data.
Reasons are read by nurses — never mention internal ids like OFR-001; name products or vendors
instead."""


def ranking_schema(offer_ids: list[str]) -> Row:
    """Every id the model may answer with, as an enum it cannot step outside of."""
    return {
        "type": "object",
        "properties": {
            "ranking": {
                "type": "array",
                "description": "Every offer id, best match first.",
                "items": {
                    "type": "object",
                    "properties": {
                        "offerId": {"type": "string", "enum": offer_ids},
                        "reason": {
                            "type": "string",
                            "description": "Short plain-English why, max 12 words.",
                        },
                    },
                    "required": ["offerId", "reason"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["ranking"],
        "additionalProperties": False,
    }


def apply_ranking(input_ids: list[str], model_ranking: list[Row]) -> Row:
    """Pure and testable: turn the model's ranking into a safe permutation of the input ids.

    Unknown and duplicate ids are dropped, and anything the model forgot is appended in its
    original position order — so the caller always gets back exactly the ids it sent.
    """
    valid = set(input_ids)
    seen: set[str] = set()
    ordered: list[str] = []
    reasons: dict[str, str] = {}
    for entry in model_ranking:
        offer_id = entry.get("offerId")
        if not isinstance(offer_id, str) or offer_id not in valid or offer_id in seen:
            continue
        seen.add(offer_id)
        ordered.append(offer_id)
        reason = str(entry.get("reason") or "").strip()
        if reason:
            reasons[offer_id] = reason
    ordered.extend(offer_id for offer_id in input_ids if offer_id not in seen)
    return {"orderedOfferIds": ordered, "reasons": reasons}


async def rerank_offers(
    settings: Settings,
    *,
    query: str,
    offer_ids: list[str],
    patient: Row | None,
) -> Row:
    """Rank `offer_ids` for `query`. Raises on any model failure; the caller falls back."""
    if not offer_ids:
        return {"orderedOfferIds": [], "reasons": {}}

    client = get_client(settings)
    started = time.perf_counter()
    try:
        response = await client.messages.create(
            model=settings.ai_model,
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            output_config={
                "format": {"type": "json_schema", "schema": ranking_schema(offer_ids)}
            },
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "offers": offer_facts(offer_ids),
                            "query": query,
                            # Sanitized upstream: no name, no DOB, ZIP-level location only.
                            "patient": patient,
                        }
                    ),
                }
            ],
        )
    except Exception:
        get_usage_ledger().record(
            feature="rerank",
            model=settings.ai_model,
            input_tokens=0,
            output_tokens=0,
            latency_ms=round((time.perf_counter() - started) * 1000),
            ok=False,
        )
        raise

    get_usage_ledger().record(
        feature="rerank",
        model=settings.ai_model,
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
        latency_ms=round((time.perf_counter() - started) * 1000),
        ok=True,
    )

    text = next((block.text for block in response.content if block.type == "text"), None)
    if not text:
        raise ValueError("rerank: no text block in response")
    parsed = json.loads(text)
    ranking = parsed.get("ranking") if isinstance(parsed, dict) else None
    if not isinstance(ranking, list):
        raise ValueError("rerank: response did not match schema")
    return apply_ranking(offer_ids, ranking)
