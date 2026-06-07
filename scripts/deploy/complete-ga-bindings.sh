#!/usr/bin/env bash
# Wait for Enclii Postgres addons to become ready, bind DATABASE_URL, sync Argo, verify store.
#
# Usage:
#   ENCLII_TOKEN='…' ./scripts/deploy/complete-ga-bindings.sh
#
# Optional overrides:
#   ENCLII_API_URL=https://api.enclii.dev

set -euo pipefail

API="${ENCLII_API_URL:-https://api.enclii.dev}"
TOKEN="${ENCLII_TOKEN:?Set ENCLII_TOKEN}"

PROD_ADDON="${PROD_ADDON:-c3ea79f2-e05e-4567-8f10-d9d98a0fc2dd}"
PROD_SERVICE="${PROD_SERVICE:-5df18423-044a-4dde-88a7-721727f6974b}"
PROD_APP="${PROD_APP:-voxa-services}"
PROD_HEALTH="${PROD_HEALTH:-https://voxa-api.madfam.io/health/ready}"

STAGING_ADDON="${STAGING_ADDON:-7f9d8c3c-5c24-4914-96cb-612bc37f9fdd}"
STAGING_SERVICE="${STAGING_SERVICE:-4acac80d-eda8-48f2-91cb-e55d47044c58}"
STAGING_APP="${STAGING_APP:-voxa-staging-services}"
STAGING_HEALTH="${STAGING_HEALTH:-https://voxa-api-staging.madfam.io/health/ready}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bind_env() {
  local label="$1" addon="$2" service="$3" app="$4" health_url="$5"
  echo "=== ${label}: waiting for addon ${addon} ==="
  "${SCRIPT_DIR}/bind-database-addon.sh" voxa "${addon}" "${service}" "${app}"
  echo "=== ${label}: verifying ${health_url} ==="
  for i in $(seq 1 18); do
    body="$(curl -sS "${health_url}" || true)"
    echo "[$i/18] ${body}"
    if echo "${body}" | grep -q '"store":"postgres"'; then
      echo "${label}: postgres store confirmed"
      return 0
    fi
    sleep 10
  done
  echo "${label}: timed out waiting for store=postgres" >&2
  return 1
}

bind_env "production" "${PROD_ADDON}" "${PROD_SERVICE}" "${PROD_APP}" "${PROD_HEALTH}"
bind_env "staging" "${STAGING_ADDON}" "${STAGING_SERVICE}" "${STAGING_APP}" "${STAGING_HEALTH}"

echo "GA database bindings complete."
