#!/usr/bin/env bash
# Rolling-restart voxa-web via Enclii (picks up deployment image after Argo sync).
#
# Argo may show Synced while pods still run an old ReplicaSet template. After web
# deploys, verify /demo bundle; if stale, run this script.
#
# Usage:
#   ENCLII_TOKEN='…' ./scripts/deploy/restart-voxa-web.sh
#   ENCLII_TOKEN='…' ./scripts/deploy/restart-voxa-web.sh staging
#   ENCLII_TOKEN='…' ./scripts/deploy/restart-voxa-web.sh all

set -euo pipefail

API="${ENCLII_API_URL:-https://api.enclii.dev}"
TOKEN="${ENCLII_TOKEN:?Set ENCLII_TOKEN}"

PROD_SERVICE_ID="${VOXA_WEB_SERVICE_ID:-3bbcb7f7-ebf2-4c89-bb42-a8953831312c}"
STAGING_SERVICE_ID="${VOXA_STAGING_WEB_SERVICE_ID:-80560128-37a7-462e-a053-bac495241f47}"

target="${1:-all}"

restart_service() {
  local id="$1"
  local label="$2"
  local body
  body="$(python3 -c "import json; print(json.dumps({'env':'production','reason':'Voxa web rollout restart (${label})'}))")"
  echo "Restarting ${label} voxa-web (${id})…"
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
echo "  ./scripts/launch/verify-prod-demo.sh"
