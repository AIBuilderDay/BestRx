"""The MCP surface mounted at /mcp.

These drive a real MCP client over the mounted ASGI app rather than calling the tool functions
directly, so the mount, the composed lifespan, and the session handshake are all covered — the
three things most likely to break and the ones a unit test of the functions would miss.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import httpx
import pytest
from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport
from fastmcp.exceptions import ToolError

from app.main import app, lifespan

USER = "USR-001"  # case manager at HSP-001
PATIENT_A = "PT-88421"
OFFER_RENTAL = "OFR-002"


def _line(qty: int) -> dict[str, Any]:
    """One rental cart line for the fixture patient."""
    return {"offerId": OFFER_RENTAL, "patientId": PATIENT_A, "qty": qty, "unit": "month"}


def _factory(**kwargs: Any) -> httpx.AsyncClient:
    """An httpx client that speaks to the mounted app in-process, no socket involved."""
    kwargs.pop("follow_redirects", None)
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
        follow_redirects=True,
        **kwargs,
    )


@asynccontextmanager
async def mcp_session() -> AsyncIterator[Client]:
    """A connected MCP client, driving the mounted app in-process.

    `lifespan` is the app's own, so entering this covers the composed lifespan — the MCP session
    manager starting alongside the store's loop binding.

    Deliberately a context manager rather than a fixture: the MCP client holds anyio cancel scopes,
    and a yield fixture can resume its teardown in a different task than it started in, which anyio
    rejects. Entering and exiting inside the test body keeps the whole session on one task.
    """
    async with lifespan(app):
        transport = StreamableHttpTransport(url="http://test/mcp/", httpx_client_factory=_factory)
        async with Client(transport) as client:
            yield client


async def test_handshake_exposes_every_tool() -> None:
    """The mount and session manager work, and the whole endpoint surface is mirrored."""
    async with mcp_session() as mcp_client:
        names = {tool.name for tool in await mcp_client.list_tools()}

        # One per endpoint family, including both write paths.
        assert {
            "list_patients",
            "list_products",
            "list_equipment",
            "list_real_vendors",
            "list_orders",
            "get_order",
            "create_order",
            "update_order_status",
            "get_cart",
            "checkout_cart",
            "list_patient_notes",
            "create_patient_note",
            "update_patient_note",
            "delete_patient_note",
            "get_ai_usage",
            "health",
        } <= names


async def test_read_tools_return_fixture_data() -> None:
    async with mcp_session() as mcp_client:
        result = await mcp_client.call_tool("list_products", {"inStock": True})

        assert result.data
        assert all(row["inStock"] is True for row in result.data)


async def test_filters_are_applied() -> None:
    async with mcp_session() as mcp_client:
        result = await mcp_client.call_tool("list_orders", {"status": "ordered"})

        assert result.data
        assert all(order["status"] == "ordered" for order in result.data)


async def test_missing_id_is_a_readable_error() -> None:
    """A model gets a sentence it can act on, not a stack trace or a null row."""
    async with mcp_session() as mcp_client:
        with pytest.raises(ToolError, match="Patient PT-nope not found"):
            await mcp_client.call_tool("get_patient", {"patientId": "PT-nope"})


async def test_rejected_transition_reports_what_is_reachable() -> None:
    """The 409 body's `allowedNext` has no HTTP equivalent here, so it goes in the message."""
    async with mcp_session() as mcp_client:
        orders = (await mcp_client.call_tool("list_orders", {"status": "ordered"})).data
        order_id = orders[0]["id"]

        with pytest.raises(ToolError, match="reachable next: dispatched"):
            await mcp_client.call_tool(
                "update_order_status", {"orderId": order_id, "status": "delivered"}
            )


async def test_get_allowed_transitions_matches_the_lifecycle() -> None:
    async with mcp_session() as mcp_client:
        orders = (await mcp_client.call_tool("list_orders", {"status": "ordered"})).data
        result = await mcp_client.call_tool("get_allowed_transitions", {"orderId": orders[0]["id"]})

        assert result.data["currentStatus"] == "ordered"
        assert result.data["allowedNext"] == ["dispatched"]


async def test_status_change_writes_through_to_the_shared_store() -> None:
    """A tool call and an HTTP request hit the same store — that is the point of mounting."""
    async with mcp_session() as mcp_client:
        orders = (await mcp_client.call_tool("list_orders", {"status": "ordered"})).data
        order_id = orders[0]["id"]

        result = await mcp_client.call_tool(
            "update_order_status", {"orderId": order_id, "status": "dispatched"}
        )
        assert result.data["order"]["status"] == "dispatched"

        fetched = (await mcp_client.call_tool("get_order", {"orderId": order_id})).data
        assert fetched["order"]["status"] == "dispatched"
        # Membership, not position: the timeline sorts by `at`, and a seeded event can carry a later
        # timestamp than a write made now.
        assert "dispatched" in [event["event"] for event in fetched["events"]]


async def test_cart_round_trip_is_priced_by_the_server() -> None:
    async with mcp_session() as mcp_client:
        await mcp_client.call_tool("update_cart", {"userId": USER, "lines": [_line(2)]})

        cart = (await mcp_client.call_tool("get_cart", {"userId": USER})).data
        assert cart["totals"]["unitCount"] == 2
        # Never echoed from the client: resolved from vendor_offers on read.
        assert cart["lines"][0]["priceUsd"] > 0


async def test_checkout_creates_orders_and_empties_the_cart() -> None:
    async with mcp_session() as mcp_client:
        await mcp_client.call_tool("update_cart", {"userId": USER, "lines": [_line(1)]})

        result = await mcp_client.call_tool("checkout_cart", {"userId": USER})
        assert len(result.data["orderIds"]) == 1

        emptied = (await mcp_client.call_tool("get_cart", {"userId": USER})).data
        assert emptied["lines"] == []


async def test_checkout_without_a_cart_is_refused() -> None:
    async with mcp_session() as mcp_client:
        with pytest.raises(ToolError, match="No cart for user"):
            await mcp_client.call_tool("checkout_cart", {"userId": USER})


async def test_checkout_of_an_emptied_cart_is_refused() -> None:
    """A cart that exists but holds nothing is a different refusal from having no cart at all."""
    async with mcp_session() as mcp_client:
        await mcp_client.call_tool("update_cart", {"userId": USER, "lines": []})

        with pytest.raises(ToolError, match="is empty"):
            await mcp_client.call_tool("checkout_cart", {"userId": USER})


async def test_note_round_trip_writes_through_to_the_shared_store() -> None:
    """A note written over MCP is the same note the REST chart reads back."""
    async with mcp_session() as mcp_client:
        created = (
            await mcp_client.call_tool(
                "create_patient_note",
                {
                    "patientId": PATIENT_A,
                    "authorId": USER,
                    "title": "Filter check",
                    "body": "Vendor to check the concentrator filter next route.",
                },
            )
        ).data
        note_id = created["id"]

        updated = (
            await mcp_client.call_tool(
                "update_patient_note",
                {"noteId": note_id, "title": "Filter checked", "body": "Vendor replaced it."},
            )
        ).data
        assert updated["title"] == "Filter checked"
        assert updated["createdAt"] == created["createdAt"]

        listed = (
            await mcp_client.call_tool("list_patient_notes", {"patientId": PATIENT_A})
        ).data
        assert note_id in [note["id"] for note in listed]

        await mcp_client.call_tool("delete_patient_note", {"noteId": note_id})
        remaining = (
            await mcp_client.call_tool("list_patient_notes", {"patientId": PATIENT_A})
        ).data
        assert note_id not in [note["id"] for note in remaining]


async def test_note_rules_reach_the_model_as_readable_errors() -> None:
    async with mcp_session() as mcp_client:
        patient = (await mcp_client.call_tool("get_patient", {"patientId": PATIENT_A})).data

        with pytest.raises(ToolError, match="patient's name"):
            await mcp_client.call_tool(
                "create_patient_note",
                {
                    "patientId": PATIENT_A,
                    "authorId": USER,
                    "title": "Delivery",
                    "body": f"{patient['firstName']} prefers mornings.",
                },
            )

        with pytest.raises(ToolError, match="Note PN-9999 not found"):
            await mcp_client.call_tool(
                "delete_patient_note", {"noteId": "PN-9999"}
            )


async def test_write_tools_are_not_annotated_read_only() -> None:
    """A client that hides destructive tools needs the annotations to be honest."""
    async with mcp_session() as mcp_client:
        tools = {tool.name: tool for tool in await mcp_client.list_tools()}

        assert tools["list_orders"].annotations.readOnlyHint is True
        assert tools["update_order_status"].annotations.readOnlyHint is False
        assert tools["checkout_cart"].annotations.readOnlyHint is False
        assert tools["list_patient_notes"].annotations.readOnlyHint is True
        assert tools["create_patient_note"].annotations.readOnlyHint is False
        assert tools["delete_patient_note"].annotations.destructiveHint is True
