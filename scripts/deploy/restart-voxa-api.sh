#!/usr/bin/env bash
# Rolling-restart voxa-api via Enclii (picks up deployment env + image after Argo sync).
#
# Argo may show Synced while pods still run an old ReplicaSet template. After API
# deploys, verify health/ready.authEnforced; if missing, run this script.
#
# Usage:
#   ENCLII_TOKEN='…' ./scripts/deploy/restart-voxa-api.sh
#   ENCLII_TOKEN='…' ./scripts/deploy/restart-voxa-api.sh staging
#   ENCLII_TOKEN='…' ./scripts/deploy/restart-voxa-api.sh all

set -euo pipefail

API="${ENCLII_API_URL:-https://api.enclii.dev}"
TOKEN="${ENCLII_TOKEN:?Set ENCLII_TOKEN}"

PROD_SERVICE_ID="${VOXA_API_SERVICE_ID:-5df18423-044a-4dde-88a7-721727f6974b}"
STAGING_SERVICE_ID="${VOXA_STAGING_API_SERVICE_ID:-4acac80d-eda8-48f2-91cb-e55d47044c58}"

target="${1:-all}"

restart_service() {
  local id="$1"
  local label="$2"
  local body
  body="$(python3 -c "import json; print(json.dumps({'env':'production','reason':'Voxa API rollout restart (${label})'}))")"
  echo "Restarting ${label} (service ${id})…"
  curl -sS -X POST "${API}/v1/services/${id}/restart" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "${body}" | python3 -m json.tool
}

case "${target}" in
  prod|production)
    restart_service "${PROD_SERVICE_ID}" "prod"
    ;;
  staging)
    restart_service "${STAGING_SERVICE_ID}" "staging"
    ;;
  all)
    restart_service "${PROD_SERVICE_ID}" "prod"
    restart_service "${STAGING_SERVICE_ID}" "staging"
    ;;
  *)
    echo "Usage: $0 [prod|staging|all]" >&2
    exit 1
    ;;
esac

echo ""
echo "Verify:"
echo "  curl -sS https://voxa-api.madfam.io/health/ready"
echo "  curl -sS -o /dev/null -w '%{http_code}\\n' https://voxa-api.madfam.io/v1/boards  # expect 401"
