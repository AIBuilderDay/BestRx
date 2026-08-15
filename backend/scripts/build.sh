#!/usr/bin/env bash
#
# Build the three Lambda deployment packages into backend/build/.
#
# Terraform zips what this produces; it does not build anything itself. Run this before
# `terraform apply`, and again after changing any handler.
#
#   ./scripts/build.sh
#
# Dependencies are installed for linux/arm64 because the Lambdas run on Graviton — building on an
# Apple Silicon Mac without --python-platform silently produces macOS binaries that fail at runtime.
# Verify with: file build/push/_cffi_backend*.so  ->  "ELF 64-bit ... ARM aarch64"

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${BACKEND_DIR}/build"
FRONTEND_DATA="${BACKEND_DIR}/../frontend/src/data"

PLATFORM="aarch64-manylinux2014"
PY_VERSION="3.12"

log() { printf '\033[0;34m==>\033[0m %s\n' "$1"; }

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"/{api,push,sse}

# ── Fixtures ────────────────────────────────────────────────────────────────────
# The JSON tables are the frontend's. Copy them at build time rather than committing a second copy
# that silently drifts.
log "Syncing fixtures from frontend/src/data"
mkdir -p "${BACKEND_DIR}/data"
cp "${FRONTEND_DATA}"/*.json "${BACKEND_DIR}/data/"

# ── API ─────────────────────────────────────────────────────────────────────────
log "Building the API package"
cp -R "${BACKEND_DIR}/app" "${BUILD_DIR}/api/app"
cp -R "${BACKEND_DIR}/data" "${BUILD_DIR}/api/data"
find "${BUILD_DIR}/api" -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true

uv pip install \
  --target "${BUILD_DIR}/api" \
  --python-platform "${PLATFORM}" \
  --python-version "${PY_VERSION}" \
  --quiet \
  fastapi pydantic mangum

# boto3 ships in the Lambda runtime already; bundling it wastes ~10MB of package size.

# ── Push Lambda ─────────────────────────────────────────────────────────────────
log "Building the push package"
cp "${BACKEND_DIR}/lambdas/push/handler.py" "${BUILD_DIR}/push/"

# http-ece (a pywebpush dependency) is source-only, so --only-binary would fail to resolve here.
# It is pure Python, so there is nothing platform-specific to get wrong.
uv pip install \
  --target "${BUILD_DIR}/push" \
  --python-platform "${PLATFORM}" \
  --python-version "${PY_VERSION}" \
  --quiet \
  pywebpush

# ── SSE Lambda ──────────────────────────────────────────────────────────────────
log "Bundling the SSE Lambda"
(
  cd "${BACKEND_DIR}/lambdas/sse"
  if [ ! -d node_modules ]; then
    npm install --silent
  fi
  npm run build --silent
  cp dist/index.mjs "${BUILD_DIR}/sse/index.mjs"
)

log "Done."
du -sh "${BUILD_DIR}"/* | sed 's/^/    /'
