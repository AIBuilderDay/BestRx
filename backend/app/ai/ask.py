"""The question agent: answer "where is Harold's bed?" from the store, not from memory.

The sibling of `agent.py`. Same MCP client into this process's own tools, same "never invent a row"
contract — but read-only, and it answers rather than writes. Every tool in `ALLOWED_TOOLS` is
annotated `readOnlyHint`, so a question can never move an order, fill a cart, or edit a note.

Two things happen between the tools and the model that do not happen for an external MCP client:

*Scoping.* Tool arguments are forced to the asking user's hospice, so a nurse cannot ask their way
into another network's orders — the model does not get to choose whose data it reads.

*Sanitization.* Patient rows are passed through `sanitize_patient` before the model sees them, the
same shape rerank and the ordering agent use. Names, DOBs and street addresses never leave this
process; the model reasons about "Harold B., 78, ZIP 84095".

Citations are derived, not claimed: ids are collected from the rows the tools actually returned and
kept only if the answer text mentions them. The model cannot cite a row it never read.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from typing import Any

from fastmcp import Client
from fastmcp.exceptions import ToolError

from .. import fixtures
from ..config import Settings
from ..mcp_server import mcp
from .client import get_client
from .sanitize import patient_label, sanitize_patient
from .usage import get_usage_ledger

Row = dict[str, Any]

# Read-only tools, across all three tables a nurse asks about: the catalog, orders, and patients
# (with the notes and EMR events that explain them). Nothing here writes.
ALLOWED_TOOLS = frozenset(
    {
        "list_patients",
        "get_patient",
        "list_orders",
        "get_order",
        "list_patient_notes",
        "list_emr_events",
        "list_products",
        "list_equipment",
        "list_vendors",
        "list_inventory",
        "list_reviews",
        "list_budgets",
        "get_allowed_transitions",
    }
)

# Arguments forced to the asking user's own organisation, per tool and per org type. The model may
# filter further; it may not widen. A tool absent from a map has no such dimension — the catalog is
# shared, and a vendor has no view of another network's patients or budgets (see `_deny`).
_HOSPICE_ARGS: dict[str, str] = {
    "list_patients": "hospiceId",
    "list_orders": "hospiceId",
    "list_budgets": "hospiceId",
}

_VENDOR_ARGS: dict[str, str] = {
    "list_orders": "vendorId",
    "list_products": "vendorId",
    "list_inventory": "vendorId",
}

# Tools a vendor user may not call at all: patient charts and hospice budgets are not theirs to
# read, and neither carries a vendor dimension to scope by.
_VENDOR_DENIED = frozenset(
    {"list_patients", "get_patient", "list_patient_notes", "list_emr_events", "list_budgets"}
)

SYSTEM_PROMPT = """You answer a hospice nurse's question about their own DME operation, using the
tools provided.

The tools read the live store: patients and their charts, orders and their delivery timelines, the
priced vendor catalog, budgets, and vendor stock. Call whatever you need — the tools are read-only
and cheap. Prefer filtering by id over scanning a whole table.

Rules:
- Answer only from what the tools returned. Never state a price, a status, a date, an id, or a
  patient detail that did not come back from a tool. If the tools do not support an answer, say so
  plainly.
- Patients are identified by a short label ("Harold B.") and an id. Use the label when referring to
  someone; never guess a full name.
- Cite the rows you used by writing their ids inline — order ids look like DME-10023, patients like
  PT-88421, offers like OFR-002. The interface turns those into links.
- Order statuses are: ordered, dispatched, in_transit, delivered (delivery), and pickup_triggered,
  picked_up (pickup).
- Costs matter to this reader: when the question is about money, give the figure the tools returned
  and say what it covers.

Answer in at most three short sentences. No preamble, no restating the question — a nurse is
reading this on a phone between visits."""

# Ids the answer may cite, by table. Shapes are fixed by the fixtures (see mcp_server's
# instructions), so a regex is enough to find them in prose.
_ID_PATTERNS: dict[str, re.Pattern[str]] = {
    "order": re.compile(r"\bDME-\d{4,6}\b"),
    "patient": re.compile(r"\bPT-\d{3,6}\b"),
    "offer": re.compile(r"\bOFR-\d{2,4}\b"),
}


@dataclass(frozen=True)
class OrgScope:
    """Whose data this question may reach, resolved from the asking user before the loop starts."""

    org_type: str
    org_id: str

    @property
    def hospice_id(self) -> str | None:
        """The hospice whose patients and budgets are in scope, or None for a vendor user."""
        return self.org_id if self.org_type == "hospice" else None

    def denies(self, tool: str) -> bool:
        return self.org_type == "vendor" and tool in _VENDOR_DENIED

    def apply(self, tool: str, arguments: Row) -> Row:
        """Force this org's filter onto a tool call. The model cannot widen its own scope."""
        args = _VENDOR_ARGS if self.org_type == "vendor" else _HOSPICE_ARGS
        key = args.get(tool)
        if key is None or not self.org_id:
            return arguments
        return {**arguments, key: self.org_id}


def _sanitize_payload(value: Any) -> Any:
    """Replace any patient row anywhere in a tool result with its sanitized form.

    Tool results are shaped by the tool — a bare list for `list_patients`, a single row for
    `get_patient`, nested rows elsewhere — so this walks the structure rather than assuming one.
    A patient row is recognised by the fields that make it identifying in the first place.
    """
    if isinstance(value, list):
        return [_sanitize_payload(item) for item in value]
    if isinstance(value, dict):
        if "firstName" in value and "lastName" in value:
            return sanitize_patient(value)
        return {key: _sanitize_payload(item) for key, item in value.items()}
    return value


async def _tool_definitions(client: Client, scope: OrgScope) -> list[Row]:
    """The tools this user may call, in the shape the Messages API takes.

    A tool their org may not read is left out of the list rather than refused on call: the model
    never sees it, so it never spends a turn being told no.
    """
    return [
        {
            "name": tool.name,
            "description": tool.description or "",
            "input_schema": tool.inputSchema,
        }
        for tool in await client.list_tools()
        if tool.name in ALLOWED_TOOLS and not scope.denies(tool.name)
    ]


async def _run_tool(client: Client, name: str, arguments: Row, scope: OrgScope) -> tuple[str, bool]:
    """Call one read-only MCP tool, scoped and sanitized. Returns (text for the model, is_error).

    A failed tool is reported back to the model rather than raised: it can ask a different question,
    which is more useful to the nurse than ending the turn with nothing.
    """
    if name not in ALLOWED_TOOLS or scope.denies(name):
        return f"Tool {name} is not available.", True
    try:
        result = await client.call_tool(name, scope.apply(name, arguments))
    except ToolError as exc:
        return str(exc), True
    except Exception as exc:  # noqa: BLE001 - the model gets the message, the loop keeps going
        return f"{name} failed: {exc}", True
    if result.data is not None:
        return json.dumps(_sanitize_payload(result.data), default=str), False
    return "\n".join(block.text for block in result.content if block.type == "text"), False


def _collect_ids(text: str, seen: dict[str, set[str]]) -> None:
    """Record every citable id appearing in one tool result, by kind."""
    for kind, pattern in _ID_PATTERNS.items():
        seen[kind].update(pattern.findall(text))


def _order_source(order_id: str) -> Row | None:
    order = fixtures.find_by("orders", "id", order_id)
    if order is None:
        return None
    first = (order.get("equipment") or [{}])[0]
    item = first.get("name") or first.get("hcpcs") or "equipment"
    return {
        "kind": "order",
        "id": order_id,
        "label": f"{order_id} · {item}",
        "meta": str(order.get("status", "")).replace("_", " "),
        "to": f"/orders/{order_id}",
    }


def _patient_source(patient_id: str) -> Row | None:
    patient = fixtures.find_by("patients", "id", patient_id)
    if patient is None:
        return None
    diagnosis = (patient.get("primaryDiagnosis") or {}).get("description") or ""
    return {
        "kind": "patient",
        "id": patient_id,
        "label": patient_label(patient),
        "meta": diagnosis,
        "to": f"/patients/{patient_id}",
    }


def _offer_source(offer_id: str) -> Row | None:
    offer = fixtures.find_by("vendor_offers", "id", offer_id)
    if offer is None:
        return None
    vendor = fixtures.find_by("vendors", "id", offer.get("vendorId", "")) or {}
    return {
        "kind": "offer",
        "id": offer_id,
        "label": str(offer.get("productName") or offer_id),
        "meta": str(vendor.get("name") or ""),
        "to": f"/catalog?offer={offer_id}",
    }


_SOURCE_BUILDERS = {
    "order": _order_source,
    "patient": _patient_source,
    "offer": _offer_source,
}

# Enough rows to follow up on without turning the answer panel into a second list view.
SOURCE_LIMIT = 6


def _sources(answer: str, seen: dict[str, set[str]]) -> list[Row]:
    """The rows the answer cites — only ids a tool actually returned, in the order mentioned.

    Two filters, both deliberate: an id the model wrote but never read is dropped (it invented it),
    and an id it read but never mentioned is dropped (it was not part of the answer).
    """
    mentioned: list[tuple[int, str, str]] = []
    for kind, pattern in _ID_PATTERNS.items():
        for match in pattern.finditer(answer):
            if match.group() in seen[kind]:
                mentioned.append((match.start(), kind, match.group()))
    mentioned.sort()

    sources: list[Row] = []
    used: set[str] = set()
    for _, kind, row_id in mentioned:
        if row_id in used:
            continue
        source = _SOURCE_BUILDERS[kind](row_id)
        if source is None:
            continue
        used.add(row_id)
        sources.append(source)
        if len(sources) == SOURCE_LIMIT:
            break
    return sources


async def run_ask(
    settings: Settings,
    *,
    question: str,
    user_id: str,
    scope: OrgScope,
) -> Row:
    """Answer `question` from the store, within `scope`.

    Returns {"answer", "sources", "toolCalls"}. `answer` is empty when the model said nothing at
    all — the caller falls back to deterministic search rather than showing an empty panel.
    """
    client = get_client(settings)
    started = time.perf_counter()
    input_tokens = 0
    output_tokens = 0

    payload: Row = {"question": question, "userId": user_id, "hospiceId": scope.hospice_id}
    messages: list[Row] = [{"role": "user", "content": json.dumps(payload)}]
    tool_calls: list[Row] = []
    seen: dict[str, set[str]] = {kind: set() for kind in _ID_PATTERNS}
    answer = ""

    try:
        async with Client(mcp) as mcp_client:
            tools = await _tool_definitions(mcp_client, scope)
            # The system prompt and tool schemas are byte-identical on every turn of every question,
            # so mark the end of that prefix cacheable — later turns read it from cache.
            if tools:
                tools[-1] = {**tools[-1], "cache_control": {"type": "ephemeral"}}

            for _ in range(settings.ai_max_tool_turns):
                response = await client.messages.create(
                    model=settings.ai_model,
                    max_tokens=1000,
                    system=SYSTEM_PROMPT,
                    tools=tools,
                    messages=messages,
                )
                input_tokens += response.usage.input_tokens
                output_tokens += response.usage.output_tokens

                answer = " ".join(
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
                    text, is_error = await _run_tool(mcp_client, block.name, arguments, scope)
                    tool_calls.append({"tool": block.name, "ok": not is_error})
                    if not is_error:
                        _collect_ids(text, seen)
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
            feature="ask",
            model=settings.ai_model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=round((time.perf_counter() - started) * 1000),
            ok=False,
        )
        raise

    get_usage_ledger().record(
        feature="ask",
        model=settings.ai_model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        latency_ms=round((time.perf_counter() - started) * 1000),
        ok=True,
    )

    return {"answer": answer, "sources": _sources(answer, seen), "toolCalls": tool_calls}
