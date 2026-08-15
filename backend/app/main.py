"""BestRx API.

FastAPI in a container — on EC2 in AWS, and under docker-compose locally. Not Lambda: this process
holds SSE connections open, which a request/response function cannot do.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .routers import carts, catalog, orders, push, stream
from .schemas import HealthResponse
from .store import get_store


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # A status change may be handled on a worker thread, but subscriber queues belong to the loop.
    # Binding it here lets the store hand events across that boundary safely.
    get_store().bind_loop(asyncio.get_running_loop())
    yield


app = FastAPI(
    title="BestRx API",
    description="Hospice DME ordering: catalog, orders, and live order status.",
    version="0.2.0",
    lifespan=lifespan,
)

_settings = get_settings()

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
app.include_router(push.router)
app.include_router(stream.router)


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Liveness, plus which notification paths are actually wired."""
    return HealthResponse(
        status="ok",
        pushEnabled=settings.push_enabled,
        subscriptionsPersisted=settings.subscriptions_persisted,
        streamClients=get_store().subscriber_count,
    )
