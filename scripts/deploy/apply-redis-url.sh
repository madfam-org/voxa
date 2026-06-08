#!/usr/bin/env bash
# Operator helper to roll out REDIS_URL for Voxa API (prod + staging).
#
# Usage:
#   ./scripts/deploy/apply-redis-url.sh
#   REDIS_URL='redis://redis.data.svc.cluster.local:6379/0' ./scripts/deploy/apply-redis-url.sh --print-only

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE="${ROOT}/deploy/secrets-template.yaml"
REDIS_URL="${REDIS_URL:-redis://redis.data.svc.cluster.local:6379/0}"
PRINT_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --print-only)
      PRINT_ONLY=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

echo "== Voxa REDIS_URL rollout =="
echo "Template: ${TEMPLATE}"
echo "REDIS_URL: ${REDIS_URL}"
echo ""
echo "1. Merge REDIS_URL into cluster secret (see deploy/secrets-template.yaml):"
echo "     REDIS_URL: ${REDIS_URL}"
echo "2. Apply via Enclii/Vault ESO (do not commit real secrets):"
echo "     enclii onboard --secrets-file deploy/secrets-template.yaml"
echo "3. Restart API deployments:"
echo "     ${ROOT}/scripts/deploy/restart-voxa-api.sh"
echo "4. Verify:"
echo "     ./scripts/launch/verify-staging-redis.sh"
echo "     REQUIRE_REDIS=1 ./scripts/launch/verify-prod-redis.sh"
echo ""

if [[ "${PRINT_ONLY}" -eq 1 ]]; then
  exit 0
fi

if [[ ! -f "${TEMPLATE}" ]]; then
  echo "FAIL missing ${TEMPLATE}" >&2
  exit 1
fi

grep -q 'REDIS_URL:' "${TEMPLATE}" && echo "OK   REDIS_URL key present in secrets template"
