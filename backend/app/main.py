"""BestRx API.

FastAPI served two ways from one app object: `uvicorn app.main:app` locally, and through Mangum on
Lambda behind an API Gateway HTTP API in AWS.
"""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings, get_settings
from .routers import catalog, orders, push
from .schemas import HealthResponse

app = FastAPI(
    title="BestRx API",
    description="Hospice DME ordering: catalog, orders, and order status notifications.",
    version="0.1.0",
)

_settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(orders.router)
app.include_router(catalog.router)
app.include_router(push.router)


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Liveness plus which storage and notification paths are actually wired."""
    return HealthResponse(
        status="ok",
        storage="dynamodb" if settings.use_dynamodb else "memory",
        pushEnabled=settings.push_enabled,
    )


# Lambda entrypoint. Imported lazily so local runs do not need mangum installed.
try:
    from mangum import Mangum

    handler = Mangum(app, lifespan="off")
except ImportError:  # pragma: no cover - local development without the Lambda dependency
    handler = None
