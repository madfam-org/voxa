#!/usr/bin/env bash
# Register the Voxa OAuth client in Janua (auth.madfam.io).
# Run once per environment set; safe to re-run (409 = already exists).
#
# Usage:
#   JANUA_ADMIN_EMAIL='admin@madfam.io' JANUA_ADMIN_PASSWORD='…' \
#     ./scripts/deploy/register-janua-oauth-client.sh
#
# Optional overrides:
#   JANUA_API_URL=https://auth.madfam.io
#   VOXA_CLIENT_ID=voxa

set -euo pipefail

JANUA_API_URL="${JANUA_API_URL:-https://auth.madfam.io}"
CLIENT_ID="${VOXA_CLIENT_ID:-voxa}"

if [[ -z "${JANUA_ADMIN_EMAIL:-}" || -z "${JANUA_ADMIN_PASSWORD:-}" ]]; then
  echo "Set JANUA_ADMIN_EMAIL and JANUA_ADMIN_PASSWORD" >&2
  exit 1
fi

login_resp="$(curl -sS -X POST "${JANUA_API_URL}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${JANUA_ADMIN_EMAIL}\",\"password\":\"${JANUA_ADMIN_PASSWORD}\"}")"

token="$(echo "${login_resp}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('access_token') or d.get('token') or '')")"
if [[ -z "${token}" ]]; then
  echo "Janua login failed: ${login_resp}" >&2
  exit 1
fi

payload="$(cat <<EOF
{
  "client_id": "${CLIENT_ID}",
  "name": "Voxa",
  "description": "Voxa AAC platform (web)",
  "redirect_uris": [
    "https://voxa.madfam.io/auth/callback",
    "https://voxa-app.madfam.io/auth/callback",
    "https://voxa-staging.madfam.io/auth/callback",
    "https://voxa-app-staging.madfam.io/auth/callback",
    "http://localhost:3000/auth/callback"
  ],
  "allowed_scopes": ["openid", "profile", "email", "offline_access"],
  "grant_types": ["authorization_code", "refresh_token"],
  "is_confidential": true,
  "website_url": "https://voxa.madfam.io"
}
EOF
)"

create_resp="$(curl -sS -w '\n%{http_code}' -X POST "${JANUA_API_URL}/api/v1/oauth/clients" \
  -H "Authorization: Bearer ${token}" \
  -H 'Content-Type: application/json' \
  -d "${payload}")"

body="$(echo "${create_resp}" | head -n -1)"
code="$(echo "${create_resp}" | tail -n 1)"

if [[ "${code}" == "201" ]]; then
  echo "Created OAuth client '${CLIENT_ID}'"
  echo "${body}" | python3 -m json.tool
  echo ""
  echo "Save client_secret to Enclii secrets (OIDC_CLIENT_SECRET) and GitHub if needed."
elif [[ "${code}" == "409" ]]; then
  echo "OAuth client '${CLIENT_ID}' already exists (409)."
else
  echo "Failed (${code}): ${body}" >&2
  exit 1
fi
