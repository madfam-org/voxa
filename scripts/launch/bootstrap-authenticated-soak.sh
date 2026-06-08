#!/usr/bin/env bash
# Bootstrap authenticated staging soak: rotate Janua OIDC secret, sync to K8s, set GitHub secrets.
#
# Uses Janua admin login for OAuth client rotate + Enclii API (Janua Bearer works).
# Does not print secret values.
#
# Usage:
#   JANUA_ADMIN_EMAIL='…' JANUA_ADMIN_PASSWORD='…' \
#     ./scripts/launch/bootstrap-authenticated-soak.sh
#
# Optional:
#   SKIP_JANUA_ROTATE=1   # use existing cluster OIDC_CLIENT_SECRET (must export OIDC_CLIENT_SECRET)
#   SKIP_GH_SECRETS=1
#   GITHUB_REPO=madfam-org/voxa

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API="${ENCLII_API_URL:-https://api.enclii.dev}"
REPO="${GITHUB_REPO:-madfam-org/voxa}"
CLIENT_ID="${VOXA_PRODUCTION_CLIENT_ID:-jnc_4qRWyI-ul_GL28hrSxrX7AvIyotFMBuB}"

if [[ -z "${JANUA_ADMIN_EMAIL:-}" || -z "${JANUA_ADMIN_PASSWORD:-}" ]]; then
  echo "Set JANUA_ADMIN_EMAIL and JANUA_ADMIN_PASSWORD" >&2
  exit 1
fi

echo "== Janua admin login =="
login_resp="$(curl -sS -X POST "https://auth.madfam.io/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"${JANUA_ADMIN_EMAIL}\",\"password\":\"${JANUA_ADMIN_PASSWORD}\"}")"
ENCLII_TOKEN="$(echo "${login_resp}" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print((d.get('tokens') or {}).get('access_token') or d.get('access_token') or '')
")"
if [[ -z "${ENCLII_TOKEN}" ]]; then
  echo "Janua login failed" >&2
  exit 1
fi

if [[ "${SKIP_JANUA_ROTATE:-}" != "1" ]]; then
  echo "== Rotate Janua OAuth client secret (production client) =="
  rotate_out="$(mktemp)"
  JANUA_ADMIN_EMAIL="${JANUA_ADMIN_EMAIL}" JANUA_ADMIN_PASSWORD="${JANUA_ADMIN_PASSWORD}" \
    "${ROOT}/scripts/deploy/register-janua-oauth-client.sh" --rotate-secret >"${rotate_out}"
  OIDC_CLIENT_SECRET="$(python3 - <<PY
import json, re, os
text=open("${rotate_out}").read()
try:
    start=text.index('{')
    depth=0
    for i,ch in enumerate(text[start:], start):
        if ch=='{': depth+=1
        elif ch=='}':
            depth-=1
            if depth==0:
                d=json.loads(text[start:i+1])
                print(d.get('client_secret',''))
                break
    else:
        raise ValueError('no json')
except Exception:
    m=re.search(r'"client_secret"\s*:\s*"([^"]+)"', text)
    print(m.group(1) if m else '')
PY
)"
  rm -f "${rotate_out}"
  if [[ -z "${OIDC_CLIENT_SECRET}" ]]; then
    echo "Failed to extract client_secret from rotate output" >&2
    exit 1
  fi
  echo "Rotated Janua client secret (not printed)."
else
  OIDC_CLIENT_SECRET="${OIDC_CLIENT_SECRET:?Set OIDC_CLIENT_SECRET when SKIP_JANUA_ROTATE=1}"
  echo "== Skip Janua rotate; using provided OIDC_CLIENT_SECRET =="
fi

apply_k8s_secret() {
  local ns="$1"
  echo "== Apply OIDC_CLIENT_SECRET to ${ns}/voxa-secrets =="
  export APPLY_NS="${ns}" APPLY_SECRET="${OIDC_CLIENT_SECRET}"
  curl -sS -X POST "${API}/v1/admin/provision/secrets" \
    -H "Authorization: Bearer ${ENCLII_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d "$(python3 - <<'PY'
import json, os
print(json.dumps({
  'namespace': os.environ['APPLY_NS'],
  'secret_name': 'voxa-secrets',
  'secrets': [{'key': 'OIDC_CLIENT_SECRET', 'value': os.environ['APPLY_SECRET']}],
}))
PY
)" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status', d))"
}

apply_k8s_secret voxa
apply_k8s_secret voxa-staging

restart_web() {
  local id="$1" label="$2"
  echo "== Restart ${label} voxa-web (${id}) =="
  curl -sS -X POST "${API}/v1/services/${id}/restart" \
    -H "Authorization: Bearer ${ENCLII_TOKEN}" \
    -H 'Content-Type: application/json' \
    -d '{"env":"production","reason":"Reload OIDC_CLIENT_SECRET after Janua rotate"}' \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status', d.get('message', d)))"
}

restart_web "3bbcb7f7-ebf2-4c89-bb42-a8953831312c" "prod"
restart_web "80560128-37a7-462e-a053-bac495241f47" "staging"

if [[ "${SKIP_GH_SECRETS:-}" != "1" ]]; then
  echo "== GitHub Actions secrets (${REPO}) =="
  gh secret set VOXA_STAGING_OIDC_CLIENT_ID --repo "${REPO}" --body "${CLIENT_ID}"
  gh secret set VOXA_STAGING_OIDC_CLIENT_SECRET --repo "${REPO}" --body "${OIDC_CLIENT_SECRET}"
  gh secret set VOXA_STAGING_TEST_EMAIL --repo "${REPO}" --body "${JANUA_ADMIN_EMAIL}"
  gh secret set VOXA_STAGING_TEST_PASSWORD --repo "${REPO}" --body "${JANUA_ADMIN_PASSWORD}"
  echo "GitHub secrets configured."
fi

echo "== Verify web OAuth (staging sign-in callback) =="
if ! "${ROOT}/scripts/launch/verify-staging-web-oidc.sh"; then
  echo "WARN: staging web OAuth verify failed (curl cookie simulation; see Playwright staging-auth-ux for browser soak)" >&2
fi

echo "== Verify authenticated soak =="
export OIDC_CLIENT_ID="${CLIENT_ID}"
export OIDC_CLIENT_SECRET
export JANUA_TEST_EMAIL="${JANUA_ADMIN_EMAIL}"
export JANUA_TEST_PASSWORD="${JANUA_ADMIN_PASSWORD}"
export VOXA_TEST_ACCESS_TOKEN="$("${ROOT}/scripts/launch/fetch-staging-access-token.sh")"
"${ROOT}/scripts/launch/soak-scenarios.sh" --with-auth

echo ""
echo "Done. Trigger CI: gh workflow run e2e-smoke.yml --repo ${REPO}"
