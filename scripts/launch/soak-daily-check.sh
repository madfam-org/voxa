#!/usr/bin/env bash
# Daily staging soak health checks for Voxa commercial GA.
#
# Usage:
#   ./scripts/launch/soak-daily-check.sh
#   ./scripts/launch/soak-daily-check.sh --log docs/launch/SOAK_LOG.md
#
# Exit 0 when all checks pass; non-zero on failure.

set -euo pipefail

API_BASE="${VOXA_STAGING_API_URL:-https://voxa-api-staging.madfam.io}"
WEB_BASE="${VOXA_STAGING_WEB_URL:-https://voxa-staging.madfam.io}"
LOG_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --log)
      LOG_FILE="${2:?--log requires a path}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

fail=0
stamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
day="$(date -u +%Y-%m-%d)"

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "OK   ${name}"
  else
    echo "FAIL ${name}" >&2
    fail=1
  fi
}

ready_body="$(curl -sf "${API_BASE}/health/ready" 2>/dev/null || true)"
check "API /health/ready" test -n "${ready_body}"
check "API store=postgres" grep -q '"store":"postgres"' <<<"${ready_body}"
check "API authEnforced=true" grep -q '"authEnforced":true' <<<"${ready_body}"

boards_code="$(curl -sS -o /dev/null -w '%{http_code}' "${API_BASE}/v1/boards" 2>/dev/null || echo 000)"
check "API GET /v1/boards → 401" test "${boards_code}" = "401"

web_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/api/health" 2>/dev/null || echo 000)"
check "Web /api/health → 200" test "${web_code}" = "200"

health_body="$(curl -sf "${WEB_BASE}/api/health" 2>/dev/null || true)"
check "Web oidcClientSecretSet" grep -q '"oidcClientSecretSet":true' <<<"${health_body}"

landing_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/" 2>/dev/null || echo 000)"
check "GET / landing → 200" test "${landing_code}" = "200"

demo_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/demo" 2>/dev/null || echo 000)"
check "GET /demo → 200" test "${demo_code}" = "200"

echo "---"
echo "Staging soak @ ${stamp}"
echo "  API: ${API_BASE}"
echo "  Web: ${WEB_BASE}"

if [[ -n "${LOG_FILE}" ]]; then
  mkdir -p "$(dirname "${LOG_FILE}")"
  status=$([[ "${fail}" -eq 0 ]] && echo pass || echo **FAIL**)
  line="| ${day} | ${status} | ${boards_code} | ${web_code} | ${stamp} |"
  if ! grep -q "| ${day} |" "${LOG_FILE}" 2>/dev/null; then
    echo "${line}" >> "${LOG_FILE}"
    echo "Appended to ${LOG_FILE}"
  else
    echo "Log already has entry for ${day}; skip append"
  fi
fi

exit "${fail}"
