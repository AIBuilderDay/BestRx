"""BestRx API.

FastAPI in a container — on EC2 in AWS, and under docker-compose locally. Not Lambda: this process
holds SSE connections open, which a request/response function cannot do.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware

from .config import Settings, get_settings
from .mcp_server import mcp
from .routers import ai, carts, catalog, notes, orders, push, stream
from .schemas import HealthResponse
from .services import autoadvance
from .store import get_store

_settings = get_settings()

# The MCP surface, as an ASGI app. Mounted below at /mcp — path="/" because the mount point already
# supplies the prefix.
#
# CORS is configured here rather than inherited: a mounted ASGI app is handed the raw request and
# never passes through the parent's middleware stack. The browser also has to *read* mcp-session-id
# to hold a session across calls, and a cross-origin response hides every header not listed in
# expose_headers — so the search bar would open a new session per request without it.
mcp_app = mcp.http_app(
    path="/",
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=_settings.cors_origins,
            allow_credentials=False,
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["*"],
            expose_headers=["mcp-session-id", "mcp-protocol-version"],
        )
    ],
)


@asynccontextmanager
async def lifespan(app_: FastAPI) -> AsyncIterator[None]:
    # A status change may be handled on a worker thread, but subscriber queues belong to the loop.
    # Binding it here lets the store hand events across that boundary safely.
    get_store().bind_loop(asyncio.get_running_loop())

    # Walks this session's orders forward on a timer so the demo has live status changes to show.
    # Off when AUTO_ADVANCE_SECONDS=0.
    advancer: asyncio.Task[None] | None = None
    if _settings.auto_advance_enabled:
        advancer = asyncio.create_task(autoadvance.run_loop(get_store(), _settings))

    try:
        # Mounting an ASGI app does not run its lifespan, and FastMCP's session manager is started
        # there — without this every /mcp request fails. Both must run, so ours wraps theirs.
        async with mcp_app.lifespan(app_):
            yield
    finally:
        if advancer is not None:
            advancer.cancel()


app = FastAPI(
    title="BestRx API",
    description="Hospice DME ordering: catalog, orders, and live order status.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(orders.router)
app.include_router(carts.router)
app.include_router(catalog.router)
app.include_router(notes.router)
app.include_router(push.router)
app.include_router(stream.router)
app.include_router(ai.router)

# Every endpoint above, mirrored as MCP tools for the frontend's AI-assisted search bar. Same
# process and same stores as the REST API, so a tool call and a request see identical state.
app.mount("/mcp", mcp_app)


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Liveness, plus which notification paths are actually wired."""
    return HealthResponse(
        status="ok",
        pushEnabled=settings.push_enabled,
        subscriptionsPersisted=settings.subscriptions_persisted,
        ordersPersisted=settings.orders_persisted,
        streamClients=get_store().subscriber_count,
        aiEnabled=settings.ai_enabled,
    )
