#!/usr/bin/env bash
# Verify production API reports Redis-backed WebSocket sync (E4).
#
# Usage:
#   ./scripts/launch/verify-prod-redis.sh
#   REQUIRE_REDIS=1 ./scripts/launch/verify-prod-redis.sh
#
# Apply REDIS_URL using deploy/secrets-template.yaml before requiring redis mode.

set -euo pipefail

API_BASE="${VOXA_PROD_API_URL:-https://voxa-api.madfam.io}"
REQUIRE_REDIS="${REQUIRE_REDIS:-0}"

ready_body="$(curl -sf "${API_BASE}/health/ready" 2>/dev/null || true)"
if [[ -z "${ready_body}" ]]; then
  echo "FAIL prod API /health/ready unreachable" >&2
  exit 1
fi

sync_hub="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('syncHub','unknown'))" <<<"${ready_body}")"
echo "INFO prod syncHub=${sync_hub} (${API_BASE})"

if [[ "${sync_hub}" == "redis" ]]; then
  echo "OK   Production syncHub is redis (multi-replica co-edit ready)"
  exit 0
fi

if [[ "${REQUIRE_REDIS}" == "1" ]]; then
  echo "FAIL Production syncHub is '${sync_hub}' — set REDIS_URL in cluster secrets" >&2
  echo "  See deploy/secrets-template.yaml and docs/launch/GA_STATUS.md" >&2
  exit 1
fi

echo "WARN Production syncHub is '${sync_hub}' (expected redis after REDIS_URL rollout)"
echo "  Ops: apply REDIS_URL → verify with REQUIRE_REDIS=1 ./scripts/launch/verify-prod-redis.sh"
exit 0
