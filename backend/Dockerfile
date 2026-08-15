# syntax=docker/dockerfile:1

# FastAPI, mirroring the frontend's dev/prod split.
#
# The build context is the repo root, not ./backend, because the JSON fixtures live in
# frontend/src/data and Docker cannot copy from outside its context. See docker-compose.yml.

# ── Base ────────────────────────────────────────────────────────────────────────
# Matches the Lambda runtime (python3.12) so a dependency that works here works deployed.
FROM python:3.12-slim AS base

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Bytecode compiled at build time rather than on each cold start; no .pyc written back into a
# read-only layer at runtime.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/usr/local

WORKDIR /app

# Manifest first so the dependency layer caches across source edits.
COPY backend/pyproject.toml ./
RUN uv pip install --system \
    fastapi pydantic "uvicorn[standard]" mangum boto3


# ── Development ─────────────────────────────────────────────────────────────────
FROM base AS dev

# pytest and the push dependencies, so `docker compose exec backend pytest` works.
RUN uv pip install --system pytest httpx "moto[dynamodb,sqs]" ruff pywebpush

COPY backend/app ./app
COPY backend/lambdas ./lambdas
COPY backend/tests ./tests
COPY backend/scripts ./scripts

# The fixtures are the frontend's. Copying them in rather than committing a second set keeps one
# copy under version control; backend/data is gitignored for the same reason.
COPY frontend/src/data/*.json ./data/

EXPOSE 8000

# --reload picks up edits through the bind mount in docker-compose.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]


# ── Production ──────────────────────────────────────────────────────────────────
# Not how this deploys — AWS runs the Lambda package built by scripts/build.sh. This image exists so
# the container runs the same way anywhere, and to catch packaging problems locally.
FROM base AS prod

COPY backend/app ./app
COPY frontend/src/data/*.json ./data/

# Non-root: nothing here needs to write to the filesystem.
RUN useradd --create-home --uid 1000 bestrx \
    && chown -R bestrx:bestrx /app
USER bestrx

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=2).status == 200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
