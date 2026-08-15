# syntax=docker/dockerfile:1

# The BestRx API.
#
# This image is the deployment artifact: the prod stage is what runs on EC2, and the dev stage is
# what docker-compose runs locally. Not a Lambda package — the process holds SSE connections open.
#
# The build context is the repo root, not ./backend, because the JSON fixtures live in
# frontend/src/data and Docker cannot copy from outside its context. See docker-compose.yml.

# ── Base ────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS base

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Bytecode compiled at build time rather than on every start; nothing written back at runtime.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/usr/local

WORKDIR /app

# Manifest first so the dependency layer caches across source edits.
COPY backend/pyproject.toml ./
RUN uv pip install --system \
    fastapi pydantic "uvicorn[standard]" boto3 fastmcp anthropic


# ── Development ─────────────────────────────────────────────────────────────────
FROM base AS dev

# pytest here so `task test:backend` runs inside the container.
RUN uv pip install --system pytest pytest-asyncio httpx "moto[dynamodb,sqs]" ruff

COPY backend/app ./app
COPY backend/tests ./tests
COPY backend/scripts ./scripts

# The fixtures are the frontend's. Copying them in rather than committing a second set keeps one
# copy under version control; backend/data is gitignored for the same reason.
COPY frontend/src/data/*.json ./data/

EXPOSE 8000

# --reload picks up edits through the bind mount in docker-compose.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


# ── Production ──────────────────────────────────────────────────────────────────
FROM base AS prod

COPY backend/app ./app
COPY frontend/src/data/*.json ./data/

# Non-root: nothing here writes to the filesystem.
RUN useradd --create-home --uid 1000 bestrx \
    && chown -R bestrx:bestrx /app
USER bestrx

# Render assigns a port at runtime; locally it is 8000. Both paths read $PORT so one image serves
# either without a rebuild.
ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import os,urllib.request,sys; sys.exit(0 if urllib.request.urlopen(f\"http://localhost:{os.environ.get('PORT','8000')}/health\", timeout=2).status == 200 else 1)"

# One worker on purpose. SSE subscribers are held in this process's memory, so a second worker would
# serve a client that never receives events written by the first. Scaling past one instance needs a
# shared broker (Redis pub/sub) rather than more workers.
#
# Shell form so $PORT expands, with exec so uvicorn replaces the shell as PID 1 and receives
# SIGTERM directly — otherwise the platform's stop signal is swallowed and shutdown waits for the
# kill timeout, dropping open SSE connections uncleanly.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
