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

manifest_code="$(curl -sS -L -o /dev/null -w '%{http_code}' "${WEB_BASE}/manifest.webmanifest" 2>/dev/null || echo 000)"
check "GET /manifest.webmanifest → 200" test "${manifest_code}" = "200"

icon_code="$(curl -sS -L -o /dev/null -w '%{http_code}' "${WEB_BASE}/icons/icon.svg" 2>/dev/null || echo 000)"
check "GET /icons/icon.svg → 200" test "${icon_code}" = "200"

echo "== Sync hub =="
ready_body="$(curl -sf "${API_BASE}/health/ready" 2>/dev/null || echo '{}')"
sync_hub="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('syncHub',''))" <<<"${ready_body}")"
if [[ -z "${sync_hub}" ]]; then
  echo "SKIP API syncHub field (post-GA REDIS_URL scaling)"
elif [[ "${sync_hub}" == "local" || "${sync_hub}" == "redis" ]]; then
  echo "OK   API reports syncHub mode (${sync_hub})"
else
  echo "FAIL API reports unexpected syncHub mode (${sync_hub})" >&2
  fail=1
fi

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

    # Consent is a server-side record per user and purpose (PUT /v1/consents);
    # no request header grants it.
    put_consent() {
      curl -sS -o /dev/null -w '%{http_code}' -X PUT "${API_BASE}/v1/consents" \
        -H "Authorization: Bearer ${token}" \
        -H 'Content-Type: application/json' \
        -d "{\"consents\":$1}"
    }
    check "PUT /v1/consents ai_processing=false → 200" test "$(put_consent '{"ai_processing":false}')" = "200"
    ai_no_consent="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE}/v1/ai/predict/text" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -d '{"profileId":"soak","recentUtterances":[],"partialText":"I want","locale":"en-US"}')"
    check "POST /v1/ai/predict/text without consent → 403" test "${ai_no_consent}" = "403"

    check "PUT /v1/consents ai_processing=true → 200" test "$(put_consent '{"ai_processing":true}')" = "200"
    ai_with_consent="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE}/v1/ai/predict/text" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -d '{"profileId":"soak","recentUtterances":[],"partialText":"I want","locale":"en-US"}')"
    check "POST /v1/ai/predict/text with consent → 200/402" test "${ai_with_consent}" = "200" -o "${ai_with_consent}" = "402"

    check "PUT /v1/consents usage_analytics=true → 200" test "$(put_consent '{"usage_analytics":true}')" = "200"
    demo_activation_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE}/v1/events/activations" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -d '{"boardId":"demo-core","buttonId":"want"}')"
    check "POST /v1/events/activations on demo-core → 403" test "${demo_activation_code}" = "403"

    echo "== Demo board is read-only =="
    demo_put_code="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "${API_BASE}/v1/boards/demo-core" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      -d '{}')"
    check "PUT /v1/boards/demo-core → 403" test "${demo_put_code}" = "403"

    obf_file="${ROOT}/fixtures/soak/minimal.obf"
    demo_import_code="$(curl -sS -o /dev/null -w '%{http_code}' \
      -X POST "${API_BASE}/v1/boards/demo-core/import/obf" \
      -H "Authorization: Bearer ${token}" \
      -H 'Content-Type: application/json' \
      --data-binary @"${obf_file}")"
    check "POST demo-core OBF import → 403" test "${demo_import_code}" = "403"

    echo "== Owned board =="
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

    if [[ "${create_code}" != "201" ]]; then
      echo "SKIP owned-board checks (board limit reached for the soak account: ${create_code})"
    else
      activation_code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE}/v1/events/activations" \
        -H "Authorization: Bearer ${token}" \
        -H 'Content-Type: application/json' \
        -d "{\"boardId\":\"${soak_board_id}\",\"buttonId\":\"want\"}")"
      check "POST /v1/events/activations with usage_analytics → 201" test "${activation_code}" = "201"

      summary_code="$(curl -sS -o /dev/null -w '%{http_code}' \
        "${API_BASE}/v1/events/activations/summary?boardId=${soak_board_id}&days=7" \
        -H "Authorization: Bearer ${token}")"
      check "GET /v1/events/activations/summary (owner) → 200" test "${summary_code}" = "200"

      delete_history_code="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE \
        "${API_BASE}/v1/events/activations?boardId=${soak_board_id}" \
        -H "Authorization: Bearer ${token}")"
      check "DELETE /v1/events/activations (owner) → 200" test "${delete_history_code}" = "200"

      echo "== Authenticated OBF round-trip =="
      import_code="$(curl -sS -o /dev/null -w '%{http_code}' \
        -X POST "${API_BASE}/v1/boards/${soak_board_id}/import/obf" \
        -H "Authorization: Bearer ${token}" \
        -H 'Content-Type: application/json' \
        --data-binary @"${obf_file}")"
      check "POST OBF import (owner) → 200" test "${import_code}" = "200"

      export_body="$(curl -sS "${API_BASE}/v1/boards/${soak_board_id}/export/obf" \
        -H "Authorization: Bearer ${token}")"
      check "GET OBF export non-empty" test -n "${export_body}"
      check "OBF export contains the board id" grep -q "${soak_board_id}" <<<"${export_body}"

      echo "== Co-edit version guard =="
      board_body="$(curl -sS "${API_BASE}/v1/boards/${soak_board_id}" \
        -H "Authorization: Bearer ${token}")"
      current_version="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('version', 1))" <<<"${board_body}")"
      stale_version=$((current_version > 1 ? current_version - 1 : 0))
      conflict_payload="$(python3 -c "
import json, sys
board = json.load(sys.stdin)
board['expectedVersion'] = ${stale_version}
print(json.dumps(board))
" <<<"${board_body}")"
      conflict_code="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT "${API_BASE}/v1/boards/${soak_board_id}" \
        -H "Authorization: Bearer ${token}" \
        -H 'Content-Type: application/json' \
        -d "${conflict_payload}")"
      check "PUT owned board stale version → 409" test "${conflict_code}" = "409"

      delete_code="$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE "${API_BASE}/v1/boards/${soak_board_id}" \
        -H "Authorization: Bearer ${token}")"
      check "DELETE owned soak board → 204" test "${delete_code}" = "204"
    fi
  fi
fi

echo "---"
if [[ "${fail}" -eq 0 ]]; then
  echo "Soak scenarios passed (auth OBF: $([[ "${WITH_AUTH}" == true ]] && echo yes || echo skipped — use --with-auth))"
else
  echo "Soak scenarios FAILED"
fi
exit "${fail}"
