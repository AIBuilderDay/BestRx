#!/usr/bin/env bash
#
# Build the API image, push it to ECR, and restart the container on EC2.
#
#   ./scripts/deploy.sh
#
# Reads the repository URL and instance id from Terraform outputs, so `terraform apply` must have
# run first. Builds for linux/arm64 to match the Graviton instance — an amd64 image will pull fine
# and then fail to start with an exec format error.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INFRA_DIR="${REPO_ROOT}/infra"

AWS_REGION="${AWS_REGION:-us-east-2}"
AWS_PROFILE="${AWS_PROFILE:-default}"

log() { printf '\033[0;34m==>\033[0m %s\n' "$1"; }

ECR_URL="$(terraform -chdir="${INFRA_DIR}" output -raw ecr_repository_url)"
INSTANCE_ID="$(terraform -chdir="${INFRA_DIR}" output -raw instance_id)"

log "Logging in to ${ECR_URL%%/*}"
aws ecr get-login-password --region "${AWS_REGION}" --profile "${AWS_PROFILE}" \
  | docker login --username AWS --password-stdin "${ECR_URL%%/*}"

# The build context is the repo root: the JSON fixtures live in frontend/src/data and Docker cannot
# copy from outside its context.
log "Building for linux/arm64"
docker build \
  --platform linux/arm64 \
  -f "${REPO_ROOT}/backend/Dockerfile" \
  --target prod \
  -t "${ECR_URL}:latest" \
  "${REPO_ROOT}"

log "Pushing"
docker push "${ECR_URL}:latest"

log "Restarting the container on ${INSTANCE_ID}"
COMMAND_ID="$(aws ssm send-command \
  --instance-ids "${INSTANCE_ID}" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["systemctl restart bestrx-api"]' \
  --region "${AWS_REGION}" \
  --profile "${AWS_PROFILE}" \
  --query 'Command.CommandId' \
  --output text)"

aws ssm wait command-executed \
  --command-id "${COMMAND_ID}" \
  --instance-id "${INSTANCE_ID}" \
  --region "${AWS_REGION}" \
  --profile "${AWS_PROFILE}" 2>/dev/null || true

API_URL="$(terraform -chdir="${INFRA_DIR}" output -raw api_url)"
log "Waiting for ${API_URL}/health"
for _ in $(seq 1 30); do
  if curl -sf "${API_URL}/health" >/dev/null 2>&1; then
    log "Deployed."
    curl -s "${API_URL}/health"
    echo
    exit 0
  fi
  sleep 2
done

echo "The API did not answer within 60s. Check the container:"
echo "  terraform -chdir=${INFRA_DIR} output -json commands | jq -r .api_logs"
exit 1
