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
check "GET / landing → 200" test "${home_code}" = "200"

demo_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/demo" 2>/dev/null || echo 000)"
check "GET /demo → 200" test "${demo_code}" = "200"

echo "== API auth gates =="
for path in /v1/billing/entitlement; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${API_BASE}${path}" 2>/dev/null || echo 000)"
  check "GET ${path} unauthenticated → 401" test "${code}" = "401"
done
for path in /v1/ai/predict/text /v1/ai/predict/symbols; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE}${path}" \
    -H 'Content-Type: application/json' -d '{}' 2>/dev/null || echo 000)"
  check "POST ${path} unauthenticated → 401" test "${code}" = "401"
done

if [[ "${WITH_AUTH}" == true ]]; then
  if [[ -z "${VOXA_TEST_ACCESS_TOKEN:-}" ]]; then
    echo "SKIP authenticated soak (--with-auth requires VOXA_TEST_ACCESS_TOKEN)" >&2
    echo "  Use fetch-staging-access-token.sh or sign in → /api/auth/session" >&2
  else
    token="${VOXA_TEST_ACCESS_TOKEN}"
    echo "== Authenticated API =="
    boards_code="$(curl -sS -o /dev/null -w '%{http_code}' "${API_BASE}/v1/boards" \
      -H "Authorization: Bearer ${token}")"
    check "GET /v1/boards authenticated → 200" test "${boards_code}" = "200"

    entitlement_body="$(curl -sS "${API_BASE}/v1/billing/entitlement" \
      -H "Authorization: Bearer ${token}")"
    check "GET /v1/billing/entitlement has tier" grep -q '"tier"' <<<"${entitlement_body}"

    ai_no_consent="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE}/v1/ai/predict/text" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -d '{"profileId":"soak","recentUtterances":[],"partialText":"I want","locale":"en-US"}')"
    check "POST /v1/ai/predict/text without consent → 403" test "${ai_no_consent}" = "403"

    ai_with_consent="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE}/v1/ai/predict/text" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -H 'X-Voxa-AI-Consent: true' \
      -d '{"profileId":"soak","recentUtterances":[],"partialText":"I want","locale":"en-US"}')"
    check "POST /v1/ai/predict/text with consent → 200/402" test "${ai_with_consent}" = "200" -o "${ai_with_consent}" = "402"

    activation_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE}/v1/events/activations" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -H 'X-Voxa-AI-Consent: true' \
      -d '{"boardId":"demo-core","buttonId":"want","speechText":"want"}')"
    check "POST /v1/events/activations with consent → 201" test "${activation_code}" = "201"

    summary_code="$(curl -sS -o /dev/null -w '%{http_code}' \
      "${API_BASE}/v1/events/activations/summary?boardId=demo-core&days=7" \
      -H "Authorization: Bearer ${token}" \
      -H 'X-Voxa-Role: editor')"
    check "GET /v1/events/activations/summary → 200" test "${summary_code}" = "200"

    soak_board_id="soak-create-$(date +%s)"
    create_payload="$(cat <<EOF
{
  "id": "${soak_board_id}",
  "name": "Soak create test",
  "profileId": "soak-profile",
  "version": 1,
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "grid": { "rows": 2, "columns": 2, "buttons": [] }
}
EOF
)"
    create_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE}/v1/boards" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -d "${create_payload}")"
    check "POST /v1/boards create → 201/402" test "${create_code}" = "201" -o "${create_code}" = "402"

    echo "== Authenticated OBF round-trip =="
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
    check "OBF export contains demo-core board id" grep -q 'demo-core' <<<"${export_body}"
  fi
fi

echo "---"
if [[ "${fail}" -eq 0 ]]; then
  echo "Soak scenarios passed (auth OBF: $([[ "${WITH_AUTH}" == true ]] && echo yes || echo skipped — use --with-auth))"
else
  echo "Soak scenarios FAILED"
fi
exit "${fail}"
