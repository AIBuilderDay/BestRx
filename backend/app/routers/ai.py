"""AI endpoints: ranked search, the ordering agent, and what they have cost so far.

These used to be model calls made from the browser through the Vite dev server's proxy, which meant
AI worked in development and silently did not in production. They live here now: the key stays
server-side, and the agent reaches the catalog through this process's own MCP tools.

Failure is a first-class outcome. Without a key the endpoints answer 503; when the model fails they
answer 502. Both are states the frontend already handles by showing plain deterministic search, so
a broken model degrades the page rather than breaking it.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from ..ai.agent import run_agent_order
from ..ai.ask import OrgScope, run_ask
from ..ai.client import AiUnavailable
from ..ai.facts import assignable_patients, known_offer_ids
from ..ai.rerank import rerank_offers
from ..ai.sanitize import find_mentioned_patients, patient_label, sanitize_patient
from ..ai.usage import get_usage_ledger
from ..config import Settings, get_settings
from ..fixtures import find_by
from ..schemas import AgentOrderRequest, AskRequest, RerankRequest

router = APIRouter(prefix="/ai", tags=["ai"])


def _unavailable(exc: AiUnavailable) -> HTTPException:
    return HTTPException(status_code=503, detail=str(exc))


def _upstream(exc: Exception) -> HTTPException:
    return HTTPException(status_code=502, detail=f"AI request failed: {exc}")


@router.post("/rerank")
async def rerank(
    payload: RerankRequest,
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Rank the given offers for a query. The response is always a permutation of what was sent."""
    offer_ids = known_offer_ids(payload.offerIds)
    if not offer_ids:
        return {"orderedOfferIds": [], "reasons": {}, "patientLabel": None}

    # Deterministic, server-side patient matching: a name only becomes context when the query
    # names exactly one patient, and only in its sanitized form.
    pool = assignable_patients(payload.hospiceId)
    mentioned = find_mentioned_patients(payload.query, pool)
    patient = sanitize_patient(mentioned[0]) if len(mentioned) == 1 else None

    try:
        result = await rerank_offers(
            settings, query=payload.query, offer_ids=offer_ids, patient=patient
        )
    except AiUnavailable as exc:
        raise _unavailable(exc) from exc
    except Exception as exc:
        raise _upstream(exc) from exc

    return {**result, "patientLabel": patient_label(mentioned[0]) if patient else None}


@router.post("/order")
async def agent_order(
    payload: AgentOrderRequest,
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Fill the user's cart from a plain-English command.

    `cart` is null when the agent could not safely resolve a patient or a product — the caller
    falls back to showing search results rather than guessing on the nurse's behalf.
    """
    user = find_by("users", "id", payload.userId)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {payload.userId} not found")

    try:
        return await run_agent_order(
            settings,
            command=payload.command,
            user_id=payload.userId,
            patients=assignable_patients(user.get("orgId")),
        )
    except AiUnavailable as exc:
        raise _unavailable(exc) from exc
    except Exception as exc:
        raise _upstream(exc) from exc


@router.post("/ask")
async def ask(
    payload: AskRequest,
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    """Answer a question about orders, patients, or the catalog from the store's own rows.

    Read-only: the agent behind this reaches the same MCP tools the ordering agent does, minus
    every write. `sources` are the rows the answer cites, so the nurse can open what it read.
    """
    user = find_by("users", "id", payload.userId)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User {payload.userId} not found")

    try:
        return await run_ask(
            settings,
            question=payload.question,
            user_id=payload.userId,
            # Scope comes from the stored user, never from the request: a hospice user reads their
            # own network, a vendor dispatcher reads their own orders and stock.
            scope=OrgScope(
                org_type=str(user.get("orgType", "")), org_id=str(user.get("orgId", ""))
            ),
        )
    except AiUnavailable as exc:
        raise _unavailable(exc) from exc
    except Exception as exc:
        raise _upstream(exc) from exc


@router.get("/usage")
def usage() -> dict[str, Any]:
    """Every AI call this process has made, and what it cost. In memory; a restart clears it."""
    ledger = get_usage_ledger()
    return {"records": ledger.records(), "summary": ledger.summary()}
