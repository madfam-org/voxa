#!/usr/bin/env bash
# Production commercial GA gate checks for voxa.madfam.io.
#
# Usage:
#   ./scripts/launch/verify-prod-ga.sh
#   ./scripts/launch/verify-prod-web-oidc.sh   # optional OAuth callback (needs env creds)

set -euo pipefail

API_BASE="${VOXA_PROD_API_URL:-https://voxa-api.madfam.io}"
WEB_BASE="${VOXA_PROD_WEB_URL:-https://voxa.madfam.io}"

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

echo "== Production API =="
ready_body="$(curl -sf "${API_BASE}/health/ready" 2>/dev/null || true)"
check "API /health/ready" test -n "${ready_body}"
check "API store=postgres" grep -q '"store":"postgres"' <<<"${ready_body}"
check "API authEnforced=true" grep -q '"authEnforced":true' <<<"${ready_body}"
if grep -q '"syncHub"' <<<"${ready_body}"; then
  sync_hub="$(python3 -c "import json,sys; print(json.load(sys.stdin).get('syncHub','unknown'))" <<<"${ready_body}")"
  echo "INFO API syncHub=${sync_hub}"
fi

boards_code="$(curl -sS -o /dev/null -w '%{http_code}' "${API_BASE}/v1/boards" 2>/dev/null || echo 000)"
check "API GET /v1/boards → 401" test "${boards_code}" = "401"

echo "== Production web =="
health_body="$(curl -sf "${WEB_BASE}/api/health" 2>/dev/null || true)"
check "Web /api/health" test -n "${health_body}"
check "Web oidcClientSecretSet" grep -q '"oidcClientSecretSet":true' <<<"${health_body}"

landing_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/" 2>/dev/null || echo 000)"
demo_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/demo" 2>/dev/null || echo 000)"
signin_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/auth/signin" 2>/dev/null || echo 000)"
check "GET / landing → 200" test "${landing_code}" = "200"
check "GET /demo → 200" test "${demo_code}" = "200"
check "GET /auth/signin → 200" test "${signin_code}" = "200"

manifest_code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}/manifest.webmanifest" 2>/dev/null || echo 000)"
check "GET /manifest.webmanifest → 200" test "${manifest_code}" = "200"

echo "== Legal pages =="
for path in /legal/privacy /legal/terms /legal/accessibility; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "${WEB_BASE}${path}" 2>/dev/null || echo 000)"
  check "GET ${path} → 200" test "${code}" = "200"
done

echo "---"
echo "Prod GA gate @ $(date -u +%Y-%m-%dT%H:%M:%SZ)"
exit "${fail}"
