#!/usr/bin/env bash
# Register the Voxa OAuth client in Janua (auth.madfam.io).
#
# Idempotent by default: existing client (409) is reported and left unchanged.
# Use --rotate-secret only when intentionally rolling OIDC_CLIENT_SECRET.
#
# Usage:
#   JANUA_ADMIN_EMAIL='admin@madfam.io' JANUA_ADMIN_PASSWORD='…' \
#     ./scripts/deploy/register-janua-oauth-client.sh
#
#   ./scripts/deploy/register-janua-oauth-client.sh --rotate-secret
#
# Optional overrides:
#   JANUA_API_URL=https://auth.madfam.io
#   VOXA_CLIENT_KEY=voxa
#   VOXA_AUDIENCE=voxa

set -euo pipefail

JANUA_API_URL="${JANUA_API_URL:-https://auth.madfam.io}"
CLIENT_KEY="${VOXA_CLIENT_KEY:-voxa}"
AUDIENCE="${VOXA_AUDIENCE:-voxa}"
ROTATE_SECRET=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotate-secret)
      ROTATE_SECRET=true
      shift
      ;;
    -h|--help)
      sed -n '1,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "${JANUA_ADMIN_EMAIL:-}" || -z "${JANUA_ADMIN_PASSWORD:-}" ]]; then
  echo "Set JANUA_ADMIN_EMAIL and JANUA_ADMIN_PASSWORD" >&2
  exit 1
fi

login_resp="$(curl -sS -X POST "${JANUA_API_URL}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${JANUA_ADMIN_EMAIL}\",\"password\":\"${JANUA_ADMIN_PASSWORD}\"}")"

token="$(echo "${login_resp}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
tokens = d.get('tokens') or {}
print(tokens.get('access_token') or d.get('access_token') or d.get('token') or '')
")"
if [[ -z "${token}" ]]; then
  echo "Janua login failed: ${login_resp}" >&2
  exit 1
fi

find_existing_client() {
  local list_resp client_id
  list_resp="$(curl -sS "${JANUA_API_URL}/api/v1/oauth/clients/admin/all?search=${CLIENT_KEY}" \
    -H "Authorization: Bearer ${token}")"
  client_id="$(echo "${list_resp}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
items = d.get('items') or d.get('clients') or d
if isinstance(items, dict):
    items = items.get('items', [])
matches = []
for item in items:
    key = item.get('client_key') or ''
    name = item.get('name') or ''
    if key == '${CLIENT_KEY}' or name == 'Voxa':
        matches.append(item)
if not matches:
    sys.exit(1)
# Prefer exact client_key match; fall back to first Voxa-named client
matches.sort(key=lambda x: 0 if x.get('client_key') == '${CLIENT_KEY}' else 1)
print(matches[0].get('id', ''))
")"
  echo "${client_id}"
}

payload="$(cat <<EOF
{
  "client_key": "${CLIENT_KEY}",
  "name": "Voxa",
  "description": "Voxa AAC platform (web)",
  "audience": "${AUDIENCE}",
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

create_resp="$(curl -sS -w '\nHTTP_CODE:%{http_code}' -X POST "${JANUA_API_URL}/api/v1/oauth/clients" \
  -H "Authorization: Bearer ${token}" \
  -H 'Content-Type: application/json' \
  -d "${payload}")"

code="$(echo "${create_resp}" | sed -n 's/^HTTP_CODE://p' | tail -1)"
body="$(echo "${create_resp}" | sed '/^HTTP_CODE:/d')"

if [[ "${code}" == "201" ]]; then
  echo "Created OAuth client (key=${CLIENT_KEY}, audience=${AUDIENCE})"
  echo "${body}" | python3 -m json.tool
  echo ""
  echo "Save client_id + client_secret to Enclii secrets (OIDC_CLIENT_SECRET) and GitHub vars."
  exit 0
fi

if [[ "${code}" == "409" ]]; then
  echo "OAuth client key '${CLIENT_KEY}' already exists (409)."
  client_id="$(echo "${body}" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id') or d.get('client',{}).get('id') or '')" 2>/dev/null || true)"
  if [[ -z "${client_id}" ]]; then
    client_id="$(find_existing_client || true)"
  fi
  if [[ -z "${client_id}" ]]; then
    echo "Could not resolve existing client id." >&2
    echo "${body}" >&2
    exit 1
  fi

  if [[ "${ROTATE_SECRET}" != true ]]; then
    echo "Existing client id: ${client_id}"
    echo "No changes made (pass --rotate-secret to roll OIDC_CLIENT_SECRET)."
    exit 0
  fi

  rotate_resp="$(curl -sS -w '\nHTTP_CODE:%{http_code}' -X POST \
    "${JANUA_API_URL}/api/v1/oauth/clients/${client_id}/rotate" \
    -H "Authorization: Bearer ${token}" \
    -H 'Content-Type: application/json' \
    -d '{}')"
  rotate_code="$(echo "${rotate_resp}" | sed -n 's/^HTTP_CODE://p' | tail -1)"
  rotate_body="$(echo "${rotate_resp}" | sed '/^HTTP_CODE:/d')"
  if [[ "${rotate_code}" == "200" || "${rotate_code}" == "201" ]]; then
    echo "Rotated client secret for existing client:"
    echo "${rotate_body}" | python3 -m json.tool
    echo ""
    echo "Update OIDC_CLIENT_SECRET in Enclii voxa-secrets and GitHub Actions secrets."
  else
    echo "Client exists; rotate failed (${rotate_code}): ${rotate_body}" >&2
    exit 1
  fi
  exit 0
fi

echo "Failed (${code}): ${body}" >&2
exit 1
