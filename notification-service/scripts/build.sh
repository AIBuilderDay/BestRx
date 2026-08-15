#!/usr/bin/env bash
#
# Build the push Lambda deployment package into notification-service/build/.
#
# Terraform zips what this produces; it does not build anything itself. Run this before
# `terraform apply`, and again after changing the handler.
#
#   ./scripts/build.sh
#
# Dependencies are installed for linux/arm64 because the Lambda runs on Graviton — building on an
# Apple Silicon Mac without --python-platform silently produces macOS binaries that fail at runtime.
# Verify with: file build/_cffi_backend*.so  ->  "ELF 64-bit ... ARM aarch64"

set -euo pipefail

SERVICE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${SERVICE_DIR}/build"

PLATFORM="aarch64-manylinux2014"
PY_VERSION="3.12"

log() { printf '\033[0;34m==>\033[0m %s\n' "$1"; }

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

log "Building the push package"
cp "${SERVICE_DIR}/handler.py" "${BUILD_DIR}/"

# http-ece (a pywebpush dependency) is source-only, so --only-binary would fail to resolve here.
# It is pure Python, so there is nothing platform-specific to get wrong.
# boto3 is omitted deliberately: it ships in the Lambda runtime and would add ~10MB.
uv pip install \
  --target "${BUILD_DIR}" \
  --python-platform "${PLATFORM}" \
  --python-version "${PY_VERSION}" \
  --quiet \
  pywebpush

log "Done."
du -sh "${BUILD_DIR}" | sed 's/^/    /'
