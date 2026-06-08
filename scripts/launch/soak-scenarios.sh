#!/usr/bin/env bash
# Staging soak scenario checks (automated subset of STAGING_SOAK.md).
#
# Usage:
#   ./scripts/launch/soak-scenarios.sh
#   VOXA_TEST_ACCESS_TOKEN='…' ./scripts/launch/soak-scenarios.sh --with-auth
#
# VOXA_TEST_ACCESS_TOKEN must be a Janua JWT with audience `voxa` (from web sign-in session).
# Platform admin login tokens are not accepted by voxa-api.
#
# Runs daily health checks plus legal pages, auth gates, and optional Janua + OBF round-trip.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_BASE="${VOXA_STAGING_API_URL:-https://voxa-api-staging.madfam.io}"
WEB_BASE="${VOXA_STAGING_WEB_URL:-https://voxa-staging.madfam.io}"
WITH_AUTH=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-auth)
      WITH_AUTH=true
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

echo "== Daily health =="
"${ROOT}/scripts/launch/soak-daily-check.sh"

fail=0
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

echo "== Legal & trust pages =="
for path in /legal/privacy /legal/terms /legal/accessibility; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}${path}" 2>/dev/null || echo 000)"
  check "GET ${path} → 200" test "${code}" = "200"
done

echo "== Auth surfaces =="
signin_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/auth/signin" 2>/dev/null || echo 000)"
check "GET /auth/signin → 200" test "${signin_code}" = "200"

home_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/" 2>/dev/null || echo 000)"
# With Janua enforced, / redirects to sign-in (307) — both are healthy.
check "GET / (communicator or auth redirect)" test "${home_code}" = "200" -o "${home_code}" = "307" -o "${home_code}" = "302"

echo "== API auth gates =="
for path in /v1/ai/predict/text /v1/ai/predict/symbols /v1/billing/entitlement; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${API_BASE}${path}" 2>/dev/null || echo 000)"
  check "GET ${path} unauthenticated → 401" test "${code}" = "401"
done

if [[ "${WITH_AUTH}" == true ]]; then
  if [[ -z "${VOXA_TEST_ACCESS_TOKEN:-}" ]]; then
    echo "SKIP auth OBF (--with-auth requires VOXA_TEST_ACCESS_TOKEN from Janua voxa session)" >&2
    echo "  Sign in at ${WEB_BASE}/auth/signin → copy accessToken from /api/auth/session" >&2
  else
    token="${VOXA_TEST_ACCESS_TOKEN}"
    echo "== Authenticated API + OBF round-trip =="
    boards_code="$(curl -sS -o /dev/null -w '%{http_code}' "${API_BASE}/v1/boards" \
      -H "Authorization: Bearer ${token}")"
    check "GET /v1/boards authenticated → 200" test "${boards_code}" = "200"

    obf_file="${ROOT}/fixtures/soak/minimal.obf"
    import_code="$(curl -sS -o /tmp/voxa-obf-import.json -w '%{http_code}' \
      -X POST "${API_BASE}/v1/boards/demo-core/import/obf" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      --data-binary @"${obf_file}")"
    check "POST OBF import → 200" test "${import_code}" = "200"

    export_body="$(curl -sS "${API_BASE}/v1/boards/demo-core/export/obf" \
      -H "Authorization: Bearer ${token}")"
    check "GET OBF export non-empty" test -n "${export_body}"
    check "OBF export contains soak-minimal id" grep -q 'soak-minimal' <<<"${export_body}"
  fi
fi

echo "---"
if [[ "${fail}" -eq 0 ]]; then
  echo "Soak scenarios passed (auth OBF: $([[ "${WITH_AUTH}" == true ]] && echo yes || echo skipped — use --with-auth))"
else
  echo "Soak scenarios FAILED"
fi
exit "${fail}"
