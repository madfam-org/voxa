#!/usr/bin/env bash
# Obtain a Voxa-audience Janua access token for staging soak (--with-auth).
#
# Requires OIDC client credentials (confidential client). Does not print the token
# unless --print is passed.
#
# Usage:
#   OIDC_CLIENT_ID='jnc_…' OIDC_CLIENT_SECRET='jns_…' \
#     ./scripts/launch/fetch-staging-access-token.sh --print
#
#   VOXA_TEST_ACCESS_TOKEN="$(./scripts/launch/fetch-staging-access-token.sh)" \
#     ./scripts/launch/soak-scenarios.sh --with-auth

set -euo pipefail

ISSUER="${JANUA_ISSUER_URL:-https://auth.madfam.io}"
CLIENT_ID="${OIDC_CLIENT_ID:-${NEXT_PUBLIC_OIDC_CLIENT_ID:-}}"
CLIENT_SECRET="${OIDC_CLIENT_SECRET:-}"
REDIRECT_URI="${VOXA_STAGING_CALLBACK_URL:-https://voxa-staging.madfam.io/auth/callback}"
EMAIL="${JANUA_TEST_EMAIL:-}"
PASSWORD="${JANUA_TEST_PASSWORD:-}"
PRINT=false
COOKIE_JAR="$(mktemp)"
trap 'rm -f "${COOKIE_JAR}"' EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --print) PRINT=true; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${CLIENT_ID}" || -z "${CLIENT_SECRET}" ]]; then
  echo "Set OIDC_CLIENT_ID and OIDC_CLIENT_SECRET (Voxa Janua confidential client)." >&2
  exit 1
fi
if [[ -z "${EMAIL}" || -z "${PASSWORD}" ]]; then
  echo "Set JANUA_TEST_EMAIL and JANUA_TEST_PASSWORD for the OAuth login-form step." >&2
  exit 1
fi

verifier="$(openssl rand -base64 32 | tr -d '=' | tr '/+' '_-' | cut -c1-43)"
challenge="$(printf '%s' "${verifier}" | openssl dgst -sha256 -binary | openssl base64 | tr -d '=' | tr '/+' '_-')"
state="$(openssl rand -hex 16)"

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
if [[ -z "${auth_request_id}" ]]; then
  echo "Could not resolve OAuth auth_request_id from Janua authorize redirect." >&2
  exit 1
fi

auth_headers="$(curl -sS -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" -D - -o /tmp/voxa-oauth-body.html \
  -X POST "${ISSUER}/api/v1/auth/login-form" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "email=${EMAIL}" \
  --data-urlencode "password=${PASSWORD}" \
  --data-urlencode "auth_request_id=${auth_request_id}" \
  --data-urlencode "client_id=${CLIENT_ID}" \
  --data-urlencode 'client_name=Voxa')"
auth_path="$(printf '%s' "${auth_headers}" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r' | tail -1)"
if [[ "${auth_path}" == /* ]]; then
  auth_path="${ISSUER}${auth_path}"
fi

consent_html="$(curl -sS -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" "${auth_path}")"
if grep -q 'name="csrf_token"' <<<"${consent_html}"; then
  consent_auth="$(sed -n 's/.*name="auth_request_id" value="\([^"]*\)".*/\1/p' <<<"${consent_html}" | head -1)"
  consent_csrf="$(sed -n 's/.*name="csrf_token" value="\([^"]*\)".*/\1/p' <<<"${consent_html}" | head -1)"
  callback_headers="$(curl -sS -c "${COOKIE_JAR}" -b "${COOKIE_JAR}" -D - -o /dev/null \
    -X POST "${ISSUER}/api/v1/oauth/consent" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode "auth_request_id=${consent_auth}" \
    --data-urlencode "csrf_token=${consent_csrf}" \
    --data-urlencode 'action=allow')"
  callback_url="$(printf '%s' "${callback_headers}" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r' | tail -1)"
else
  callback_url="$(printf '%s' "${auth_headers}" | awk 'tolower($1)=="location:" {print $2}' | tr -d '\r' | tail -1)"
fi

code="$(python3 - <<PY
import urllib.parse
q=urllib.parse.parse_qs(urllib.parse.urlparse('''${callback_url}''').query)
print(q.get('code',[''])[0])
PY
)"
if [[ -z "${code}" ]]; then
  echo "OAuth authorization code not received." >&2
  exit 1
fi

token_json="$(curl -sS -X POST "${ISSUER}/api/v1/oauth/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=authorization_code' \
  --data-urlencode "code=${code}" \
  --data-urlencode "redirect_uri=${REDIRECT_URI}" \
  --data-urlencode "client_id=${CLIENT_ID}" \
  --data-urlencode "client_secret=${CLIENT_SECRET}" \
  --data-urlencode "code_verifier=${verifier}")"

access_token="$(python3 - <<PY
import json, sys
d=json.loads('''${token_json}''')
print(d.get('access_token',''))
PY
)"
if [[ -z "${access_token}" ]]; then
  echo "Token exchange failed: ${token_json}" >&2
  exit 1
fi

if [[ "${PRINT}" == true ]]; then
  printf '%s\n' "${access_token}"
else
  printf '%s' "${access_token}"
fi
