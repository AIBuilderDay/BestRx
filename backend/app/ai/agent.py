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
import time
from typing import Any

from fastmcp import Client
from fastmcp.exceptions import ToolError

from ..config import Settings
from ..mcp_server import mcp
from .client import get_client
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
e.g. "Added 1 Hospital Bed (Sample Vendor 1) for Harold B."
If you could not safely resolve the patient or the product, reply with exactly NO_MATCH and
nothing else."""

NO_MATCH = "NO_MATCH"


async def _tool_definitions(client: Client) -> list[Row]:
    """The allowed MCP tools, in the shape the Messages API takes."""
    return [
        {
            "name": tool.name,
            "description": tool.description or "",
            "input_schema": tool.inputSchema,
        }
        for tool in await client.list_tools()
        if tool.name in ALLOWED_TOOLS
    ]


async def _run_tool(client: Client, name: str, arguments: Row) -> tuple[str, bool]:
    """Call one MCP tool. Returns (text for the model, is_error).

    A refused or failed tool is reported back to the model rather than raised: it can pick a
    different offer or ask a different question, which is more useful than ending the turn.
    """
    if name not in ALLOWED_TOOLS:
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


def _find_line(cart: Row | None, keys: set[tuple[str, str]]) -> Row | None:
    """The first line matching one of `keys`, as {offerId, patientId}. None when nothing matches."""
    if not cart or not keys:
        return None
    for line in cart.get("lines") or []:
        key = (str(line.get("offerId")), str(line.get("patientId")))
        if key in keys:
            return {"offerId": key[0], "patientId": key[1]}
    return None


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
    # The roster the model may choose from, by label rather than full name.
    roster = [{"id": p["id"], "label": patient_label(p)} for p in patients]

    user_content = json.dumps(
        {
            "command": command,
            "userId": user_id,
            "patients": roster,
            # Present only when the command named exactly one patient — extra clinical context for
            # ranking, already stripped of anything identifying.
            "patientContext": patient_context,
        }
    )

    messages: list[Row] = [{"role": "user", "content": user_content}]
    tool_calls: list[Row] = []
    summary = ""
    cart: Row | None = None
    # The (offerId, patientId) the cart gained, so the drawer can spotlight the right row. Derived
    # by diffing rather than trusting line order, which `update_cart` does not promise.
    lines_before: set[tuple[str, str]] = set()
    added: Row | None = None

    try:
        async with Client(mcp) as mcp_client:
            tools = await _tool_definitions(mcp_client)

            for _ in range(settings.ai_max_tool_turns):
                response = await client.messages.create(
                    model=settings.ai_model,
                    max_tokens=1500,
                    system=SYSTEM_PROMPT,
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
                    text, is_error = await _run_tool(mcp_client, block.name, arguments)
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
                                new_keys = keys - lines_before
                                added = _find_line(cart, new_keys)
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
        return {"summary": summary, "cart": None, "added": None, "toolCalls": tool_calls}
    return {"summary": summary, "cart": cart, "added": added, "toolCalls": tool_calls}
