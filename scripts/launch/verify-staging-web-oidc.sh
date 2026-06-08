#!/usr/bin/env bash
# Verify staging voxa-web can complete Janua OAuth (OIDC_CLIENT_SECRET loaded in pods).
#
# Simulates the browser callback using a Netscape cookie jar (HttpOnly PKCE/state cookies).
#
# Usage:
#   OIDC_CLIENT_ID='jnc_…' OIDC_CLIENT_SECRET='jns_…' \
#   JANUA_TEST_EMAIL='…' JANUA_TEST_PASSWORD='…' \
#     ./scripts/launch/verify-staging-web-oidc.sh

set -euo pipefail

WEB_BASE="${VOXA_STAGING_WEB_URL:-https://voxa-staging.madfam.io}"
ISSUER="${JANUA_ISSUER_URL:-https://auth.madfam.io}"
CLIENT_ID="${OIDC_CLIENT_ID:-${NEXT_PUBLIC_OIDC_CLIENT_ID:-}}"
CLIENT_SECRET="${OIDC_CLIENT_SECRET:-}"
REDIRECT_URI="${VOXA_STAGING_CALLBACK_URL:-${WEB_BASE}/auth/callback}"
EMAIL="${JANUA_TEST_EMAIL:-}"
PASSWORD="${JANUA_TEST_PASSWORD:-}"
COOKIE_JAR="$(mktemp)"
trap 'rm -f "${COOKIE_JAR}"' EXIT

if [[ -z "${CLIENT_ID}" || -z "${CLIENT_SECRET}" || -z "${EMAIL}" || -z "${PASSWORD}" ]]; then
  echo "Set OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, JANUA_TEST_EMAIL, JANUA_TEST_PASSWORD" >&2
  exit 1
fi

verifier="$(openssl rand -base64 32 | tr -d '=' | tr '/+' '_-' | cut -c1-43)"
challenge="$(printf '%s' "${verifier}" | openssl dgst -sha256 -binary | openssl base64 | tr -d '=' | tr '/+' '_-')"
state="$(openssl rand -hex 16)"
state_payload="$(python3 - <<PY
import json
print(json.dumps({"state": "${state}", "redirect_to": "/"}))
PY
)"
expiry="$(( $(date +%s) + 1800 ))"

# curl reads/writes HttpOnly cookies when the jar uses the #HttpOnly_ prefix.
cat >"${COOKIE_JAR}" <<EOF
# Netscape HTTP Cookie File
#HttpOnly_.voxa-staging.madfam.io	TRUE	/	TRUE	${expiry}	voxa_pkce_verifier	${verifier}
#HttpOnly_.voxa-staging.madfam.io	TRUE	/	TRUE	${expiry}	voxa_oidc_state	${state_payload}
EOF

auth_qs="$(python3 - <<PY
import urllib.parse
print(urllib.parse.urlencode({
  'response_type': 'code',
  'client_id': '${CLIENT_ID}',
  'redirect_uri': '${REDIRECT_URI}',
  'scope': 'openid email profile offline_access',
  'state': '${state}',
  'code_challenge': '${challenge}',
  'code_challenge_method': 'S256',
}))
PY
)"

login_headers="$(curl -sS -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" -D - -o /dev/null \
  "${ISSUER}/api/v1/oauth/authorize?${auth_qs}")"
login_path="$(printf '%s' "${login_headers}" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r' | tail -1)"
auth_request_id="$(python3 - <<PY
import urllib.parse
q=urllib.parse.parse_qs(urllib.parse.urlparse('''${login_path}''').query)
print(q.get('auth_request_id',[''])[0])
PY
)"

auth_headers="$(curl -sS -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" -D - -o /dev/null \
  -X POST "${ISSUER}/api/v1/auth/login-form" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "email=${EMAIL}" \
  --data-urlencode "password=${PASSWORD}" \
  --data-urlencode "auth_request_id=${auth_request_id}" \
  --data-urlencode "client_id=${CLIENT_ID}" \
  --data-urlencode 'client_name=Voxa')"
auth_path="$(printf '%s' "${auth_headers}" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r' | tail -1)"
[[ "${auth_path}" == /* ]] && auth_path="${ISSUER}${auth_path}"

if [[ "${auth_path}" == *'/oauth/authorize'* ]]; then
  authorize_headers="$(curl -sS -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" -D - -o /dev/null \
    --max-redirs 0 "${auth_path}" || true)"
  callback_url="$(printf '%s' "${authorize_headers}" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r' | tail -1)"
else
  callback_url="${auth_path}"
fi

code="$(python3 - <<PY
import urllib.parse
q=urllib.parse.parse_qs(urllib.parse.urlparse('''${callback_url}''').query)
print(q.get('code',[''])[0])
PY
)"
if [[ -z "${code}" ]]; then
  echo "No authorization code for web callback verify." >&2
  exit 1
fi

callback_headers="$(curl -sS -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" -D - -o /dev/null \
  --max-redirs 0 "${callback_url}" || true)"
final_location="$(printf '%s' "${callback_headers}" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r' | tail -1)"

if [[ "${final_location}" == *token_exchange_failed* ]] || [[ "${final_location}" == *state_mismatch* ]] || [[ "${callback_url}" == *error=* ]]; then
  echo "Web OAuth callback failed: ${final_location:-${callback_url}}" >&2
  exit 1
fi

session_code="$(curl -sS -b "${COOKIE_JAR}" -o /dev/null -w '%{http_code}' "${WEB_BASE}/api/auth/session")"
if [[ "${session_code}" != "200" ]]; then
  echo "Web session not established after callback (HTTP ${session_code})." >&2
  exit 1
fi

echo "OK   staging web OAuth callback + session"
