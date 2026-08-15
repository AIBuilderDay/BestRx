"""The ordering agent: turn "order a hospital bed for Harold" into a filled cart.

Unlike rerank, this is a tool loop rather than a single shot. The model is handed this process's
own MCP tools and queries the catalog itself — so every product, price, and patient it acts on is a
row the store actually returned, not something it recalled. The cart write goes through the same
`update_cart` tool an external MCP client would use, which validates the offer, the patient, and the
arrangement server-side. There is no path here that writes a cart line the catalog disputes.

The agent only fills the cart. A human always reviews and confirms checkout — `checkout_cart` is
deliberately withheld from the tool set below.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any

from fastmcp import Client
from fastmcp.exceptions import ToolError

from .. import fixtures
from ..config import Settings
from ..mcp_server import mcp
from .client import get_client
from .facts import offer_facts
from .sanitize import find_mentioned_patients, patient_label, sanitize_patient
from .usage import get_usage_ledger

Row = dict[str, Any]

# The tools the agent may call. Reads, plus the two cart writes it needs to add a line — and
# nothing that dispatches an order. `checkout_cart`, `create_order`, and `update_order_status` are
# absent on purpose: a nurse confirms checkout in the UI, an agent never does it for them.
ALLOWED_TOOLS = frozenset(
    {
        "list_products",
        "list_equipment",
        "list_patients",
        "get_patient",
        "list_vendors",
        "list_reviews",
        "list_inventory",
        "get_cart",
        "update_cart",
    }
)

# The tools a fully-briefed turn still needs. When the patient is already resolved here and
# candidate offers are in the prompt, the lookup tools are dead weight: their schemas ship on every
# turn and the model spends a round trip re-fetching what it was handed. Narrowing the set is what
# turns a five-call order into a two-call one.
BRIEFED_TOOLS = frozenset({"get_cart", "update_cart"})

# How many candidate offers to brief. Enough that a real choice is on the table (vendor, price,
# delivery) without pasting the storefront into the prompt.
BRIEF_OFFER_LIMIT = 8

# Words that carry no signal when matching a command against a product name.
_STOPWORDS = frozenset(
    {
        "order", "please", "get", "a", "an", "the", "for", "and", "with", "to", "of",
        "me", "we", "need", "want", "some", "new", "one", "two", "his", "her", "their",
        "buy", "rent", "cheapest", "fastest", "best", "from", "in", "on", "at", "by",
    }
)

SYSTEM_PROMPT = """You turn a hospice nurse's plain-English order command into cart lines, using
the tools provided.

Work in this order:
1. Resolve the patient. The command names them informally ("Harold", "Mrs. Okafor"). Use
   `list_patients` and match on the name. If you cannot identify exactly one patient the nurse
   could have meant, stop and report NO_MATCH.
2. Find the equipment with `list_products`. Prefer in-stock offers, then faster delivery, then
   better nurse rating, then lower price. An explicit preference in the command — cheapest, a
   named vendor, fastest delivery — overrides those defaults. If nothing in the catalog matches
   what was asked for, stop and report NO_MATCH.
3. Read the nurse's current cart with `get_cart`, then call `update_cart` with the complete set of
   lines: every line already in the cart, plus the new one. `update_cart` is a whole-cart replace,
   so omitting an existing line deletes it.

Rules:
- Quantity defaults to 1 unless the command says otherwise. Never order more than 10 of anything.
- Use "month" as the unit to rent and "purchase" to buy. Rent unless the command says to buy or
  the offer is only sold outright.
- Never invent a product, a price, a patient, or an id. Everything you act on must have come back
  from a tool.
- Never call a tool you were not given.

When you are done, reply with a single sentence a nurse can skim to confirm what you understood,
e.g. "Added 1 Hospital Bed (Alpine Home Medical) for Harold B."
If you could not safely resolve the patient or the product, reply with exactly NO_MATCH and
nothing else."""

# Used when the patient is already resolved and candidate offers are already in the prompt. Same
# rules and same read-back contract — only steps 1 and 2 change, because they are already done.
BRIEFED_SYSTEM_PROMPT = """You turn a hospice nurse's plain-English order command into cart lines,
using the tools provided.

The patient has already been resolved for you: use `patientContext.id` as the patientId. Candidate
offers from the catalog are in `candidateOffers` — pick from those by `offerId`.

Work in this order:
1. Choose the offer in `candidateOffers` that best matches the command. Prefer in-stock offers,
   then faster delivery, then better nurse rating, then lower price. An explicit preference in the
   command — cheapest, a named vendor, fastest delivery — overrides those defaults. If none of the
   candidates is what the nurse asked for, stop and report NO_MATCH.
2. Read the nurse's current cart with `get_cart`, then call `update_cart` with the complete set of
   lines: every line already in the cart, plus the new one. `update_cart` is a whole-cart replace,
   so omitting an existing line deletes it.

Rules:
- Quantity defaults to 1 unless the command says otherwise. Never order more than 10 of anything.
- Use "month" as the unit to rent and "purchase" to buy. Rent unless the command says to buy or
  the offer is only sold outright.
- Never invent a product, a price, a patient, or an id. Only use ids present in `candidateOffers`
  and `patientContext`.
- Never call a tool you were not given.

When you are done, reply with a single sentence a nurse can skim to confirm what you understood,
e.g. "Added 1 Hospital Bed (Alpine Home Medical) for Harold B."
If you could not safely resolve the patient or the product, reply with exactly NO_MATCH and
nothing else."""

NO_MATCH = "NO_MATCH"


async def _tool_definitions(client: Client, allowed: frozenset[str]) -> list[Row]:
    """The allowed MCP tools, in the shape the Messages API takes."""
    return [
        {
            "name": tool.name,
            "description": tool.description or "",
            "input_schema": tool.inputSchema,
        }
        for tool in await client.list_tools()
        if tool.name in allowed
    ]


async def _run_tool(
    client: Client, name: str, arguments: Row, allowed: frozenset[str]
) -> tuple[str, bool]:
    """Call one MCP tool. Returns (text for the model, is_error).

    A refused or failed tool is reported back to the model rather than raised: it can pick a
    different offer or ask a different question, which is more useful than ending the turn.
    """
    if name not in allowed:
        return f"Tool {name} is not available.", True
    try:
        result = await client.call_tool(name, arguments)
    except ToolError as exc:
        return str(exc), True
    except Exception as exc:  # noqa: BLE001 - the model gets the message, the loop keeps going
        return f"{name} failed: {exc}", True
    if result.data is not None:
        return json.dumps(result.data, default=str), False
    return "\n".join(block.text for block in result.content if block.type == "text"), False


def _line_keys(cart: Row | None) -> set[tuple[str, str]]:
    """Identity of each cart line — what a diff between two carts compares."""
    if not cart:
        return set()
    return {
        (str(line.get("offerId")), str(line.get("patientId")))
        for line in cart.get("lines") or []
    }


def _find_lines(cart: Row | None, keys: set[tuple[str, str]]) -> list[Row]:
    """Every line matching `keys`, as {offerId, patientId}, in cart order."""
    if not cart or not keys:
        return []
    return [
        {"offerId": key[0], "patientId": key[1]}
        for line in cart.get("lines") or []
        if (key := (str(line.get("offerId")), str(line.get("patientId")))) in keys
    ]


def _candidate_offers(command: str) -> list[Row]:
    """Offers whose name, category, or description overlaps the command, best overlap first.

    A deterministic prefilter, not a ranking: it decides what the model is shown, and the model
    still chooses. Returns [] when nothing overlaps, which the caller treats as "not briefed" and
    falls back to the full tool loop rather than briefing the model on an empty catalog.
    """
    words = {
        word
        for word in re.split(r"[^a-z0-9]+", command.lower())
        if len(word) > 2 and word not in _STOPWORDS
    }
    if not words:
        return []

    scored: list[tuple[int, int, Row]] = []
    for index, offer in enumerate(fixtures.vendor_offers()):
        haystack = " ".join(
            str(offer.get(field) or "")
            for field in ("productName", "category", "description", "hcpcs")
        ).lower()
        score = sum(1 for word in words if word in haystack)
        if score:
            # Index breaks ties so the order is stable rather than dependent on dict ordering.
            scored.append((-score, index, offer))

    scored.sort(key=lambda row: (row[0], row[1]))
    ids = [offer["id"] for _, _, offer in scored[:BRIEF_OFFER_LIMIT]]
    # `description` is the long marketing blurb — the model does not need it to pick between eight
    # already-relevant offers, and it is the bulk of the payload.
    return [
        {key: value for key, value in fact.items() if key != "description"}
        for fact in offer_facts(ids)
    ]


def _resolve_patient_context(command: str, patients: list[Row]) -> Row | None:
    """Sanitized context for the patient the command names, when it names exactly one.

    Matching happens here, deterministically — patient names never go to the model to be matched.
    """
    mentioned = find_mentioned_patients(command, patients)
    return sanitize_patient(mentioned[0]) if len(mentioned) == 1 else None


async def run_agent_order(
    settings: Settings,
    *,
    command: str,
    user_id: str,
    patients: list[Row],
) -> Row:
    """Fill the user's cart from `command`.

    Returns {"summary", "cart", "toolCalls"}. `cart` is None when the model reported NO_MATCH or
    never wrote one — the caller shows plain search results instead, and never a dead end.
    """
    client = get_client(settings)
    started = time.perf_counter()
    input_tokens = 0
    output_tokens = 0

    patient_context = _resolve_patient_context(command, patients)
    candidates = _candidate_offers(command)
    # Both halves of the lookup work are already done here: the patient was matched
    # deterministically and the offers were prefiltered from the same catalog the tools read. So
    # brief the model instead of making it spend a round trip per lookup.
    briefed = patient_context is not None and bool(candidates)

    payload: Row = {
        "command": command,
        "userId": user_id,
        # Present only when the command named exactly one patient — extra clinical context for
        # ranking, already stripped of anything identifying.
        "patientContext": patient_context,
    }
    if briefed:
        payload["candidateOffers"] = candidates
    else:
        # The roster the model may choose from, by label rather than full name.
        payload["patients"] = [{"id": p["id"], "label": patient_label(p)} for p in patients]

    user_content = json.dumps(payload)

    messages: list[Row] = [{"role": "user", "content": user_content}]
    tool_calls: list[Row] = []
    summary = ""
    cart: Row | None = None
    # Every (offerId, patientId) the cart gained, so the drawer can spotlight all of them — one
    # command can add several lines, and across several `update_cart` turns. Derived by diffing
    # rather than trusting line order, which `update_cart` does not promise.
    lines_before: set[tuple[str, str]] = set()
    added_keys: set[tuple[str, str]] = set()

    try:
        async with Client(mcp) as mcp_client:
            tools = await _tool_definitions(mcp_client, BRIEFED_TOOLS if briefed else ALLOWED_TOOLS)
            # The system prompt and tool schemas are byte-identical across every turn of every
            # order, so mark the end of that prefix cacheable. Turns 2+ of this order, and every
            # later order, read it from cache instead of re-sending it.
            if tools:
                tools[-1] = {**tools[-1], "cache_control": {"type": "ephemeral"}}

            for _ in range(settings.ai_max_tool_turns):
                response = await client.messages.create(
                    model=settings.ai_model,
                    max_tokens=1500,
                    system=BRIEFED_SYSTEM_PROMPT if briefed else SYSTEM_PROMPT,
                    tools=tools,
                    messages=messages,
                )
                input_tokens += response.usage.input_tokens
                output_tokens += response.usage.output_tokens

                summary = " ".join(
                    block.text.strip() for block in response.content if block.type == "text"
                ).strip()

                if response.stop_reason != "tool_use":
                    break

                messages.append({"role": "assistant", "content": response.content})
                results: list[Row] = []
                for block in response.content:
                    if block.type != "tool_use":
                        continue
                    arguments = block.input if isinstance(block.input, dict) else {}
                    text, is_error = await _run_tool(
                        mcp_client, block.name, arguments, BRIEFED_TOOLS if briefed else ALLOWED_TOOLS
                    )
                    tool_calls.append({"tool": block.name, "ok": not is_error})
                    # The cart the model wrote is what the frontend renders — take it from the
                    # tool result rather than refetching, so the response is a single round trip.
                    if block.name in {"update_cart", "get_cart"} and not is_error:
                        try:
                            cart = json.loads(text)
                        except json.JSONDecodeError:
                            cart = None
                        else:
                            keys = _line_keys(cart)
                            if block.name == "get_cart":
                                # The state the agent read before writing: the diff baseline.
                                lines_before = keys
                            else:
                                added_keys |= keys - lines_before
                                # A line the agent added then removed is no longer a highlight.
                                added_keys &= keys
                                lines_before = keys
                    results.append(
                        {
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": text,
                            "is_error": is_error,
                        }
                    )
                messages.append({"role": "user", "content": results})
    except Exception:
        get_usage_ledger().record(
            feature="agent_order",
            model=settings.ai_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=round((time.perf_counter() - started) * 1000),
            ok=False,
        )
        raise

    get_usage_ledger().record(
        feature="agent_order",
        model=settings.ai_model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=round((time.perf_counter() - started) * 1000),
        ok=True,
    )

    # NO_MATCH, or a turn that talked without ever writing: either way there is no cart to show.
    if NO_MATCH in summary or cart is None or not cart.get("lines"):
        return {"summary": summary, "cart": None, "added": [], "toolCalls": tool_calls}
    return {
        "summary": summary,
        "cart": cart,
        "added": _find_lines(cart, added_keys),
        "toolCalls": tool_calls,
    }
