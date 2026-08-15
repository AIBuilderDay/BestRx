#!/usr/bin/env bash
#
# Copy the JSON fixtures from the frontend into backend/data/.
#
# The frontend's copy is the original; backend/data is gitignored so there is only ever one set
# under version control. The Dockerfile does this itself at build time — this script is for running
# the API on the host without Docker.

set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DATA="${BACKEND_DIR}/../frontend/src/data"

mkdir -p "${BACKEND_DIR}/data"
cp "${FRONTEND_DATA}"/*.json "${BACKEND_DIR}/data/"

printf '\033[0;34m==>\033[0m Synced %s tables into backend/data/\n' \
  "$(find "${BACKEND_DIR}/data" -name '*.json' | wc -l | tr -d ' ')"
