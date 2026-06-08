#!/usr/bin/env bash
# Run all pre-GA declaration checks in order (staging soak + prod gate + soak window).
#
# Usage:
#   ./scripts/launch/verify-declaration-day.sh
#   ./scripts/launch/verify-declaration-day.sh --start 2026-06-08 --required 7
#
# Optional authenticated soak (requires Janua admin creds):
#   JANUA_ADMIN_EMAIL='…' JANUA_ADMIN_PASSWORD='…' \
#     ./scripts/launch/verify-declaration-day.sh --with-auth-soak

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

LOG_FILE="${VOXA_SOAK_LOG:-docs/launch/SOAK_LOG.md}"
REQUIRED=7
START_DATE="2026-06-08"
WITH_AUTH_SOAK=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --required)
      REQUIRED="${2:?--required needs a number}"
      shift 2
      ;;
    --start)
      START_DATE="${2:?--start needs YYYY-MM-DD}"
      shift 2
      ;;
    --log)
      LOG_FILE="${2:?--log needs a path}"
      shift 2
      ;;
    --with-auth-soak)
      WITH_AUTH_SOAK=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

fail=0
step() {
  local name="$1"
  shift
  echo ""
  echo "== ${name} =="
  if "$@"; then
    echo "OK   ${name}"
  else
    echo "FAIL ${name}" >&2
    fail=1
  fi
}

step "Staging daily soak" \
  "${ROOT}/scripts/launch/soak-daily-check.sh" --log "${LOG_FILE}"

step "Staging scenario soak" "${ROOT}/scripts/launch/soak-scenarios.sh"

if [[ "${WITH_AUTH_SOAK}" == true ]]; then
  if [[ -z "${JANUA_ADMIN_EMAIL:-}" || -z "${JANUA_ADMIN_PASSWORD:-}" ]]; then
    echo "FAIL authenticated soak requested but JANUA_ADMIN_EMAIL/PASSWORD unset" >&2
    fail=1
  else
    step "Authenticated bootstrap soak" \
      "${ROOT}/scripts/launch/bootstrap-authenticated-soak.sh"
  fi
else
  echo ""
  echo "== Authenticated bootstrap soak =="
  echo "SKIP (pass --with-auth-soak to run bootstrap-authenticated-soak.sh)"
fi

step "Production GA gate" "${ROOT}/scripts/launch/verify-prod-ga.sh"

step "Soak window (${REQUIRED} days from ${START_DATE})" \
  "${ROOT}/scripts/launch/verify-soak-window.sh" --required "${REQUIRED}" --start "${START_DATE}" --log "${LOG_FILE}"

echo ""
echo "== Soak operator summary =="
"${ROOT}/scripts/launch/soak-status.sh" --required "${REQUIRED}" --start "${START_DATE}" --log "${LOG_FILE}" || true

echo ""
echo "---"
if [[ "${fail}" -eq 0 ]]; then
  echo "Declaration-day checks passed @ $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Next: sign docs/launch/GA_DECLARATION.md and run gh workflow run e2e-smoke.yml"
else
  echo "Declaration-day checks failed — resolve items above before signing GA_DECLARATION.md"
fi

exit "${fail}"
