#!/usr/bin/env bash
# Verify staging API reports Redis-backed WebSocket sync (E4).
#
# Usage:
#   ./scripts/launch/verify-staging-redis.sh
#   REQUIRE_REDIS=1 ./scripts/launch/verify-staging-redis.sh

set -euo pipefail

API_BASE="${VOXA_STAGING_API_URL:-https://voxa-api-staging.madfam.io}"
REQUIRE_REDIS="${REQUIRE_REDIS:-0}"

ready_body="$(curl -sf "${API_BASE}/health/ready" 2>/dev/null || true)"
if [[ -z "${ready_body}" ]]; then
  echo "FAIL staging API /health/ready unreachable" >&2
  exit 1
fi

sync_hub="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('syncHub','unknown'))" <<<"${ready_body}")"
echo "INFO staging syncHub=${sync_hub} (${API_BASE})"

if [[ "${sync_hub}" == "redis" ]]; then
  echo "OK   Staging syncHub is redis (multi-replica co-edit ready)"
  exit 0
fi

if [[ "${REQUIRE_REDIS}" == "1" ]]; then
  echo "FAIL Staging syncHub is '${sync_hub}' — set REDIS_URL in cluster secrets" >&2
  exit 1
fi

echo "WARN Staging syncHub is '${sync_hub}' (expected redis after REDIS_URL rollout)"
exit 0
