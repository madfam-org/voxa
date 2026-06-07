#!/usr/bin/env bash
# Provision Voxa on shared MADFAM Postgres (data namespace) and inject DATABASE_URL.
#
# Requires Enclii admin API token. Does NOT print passwords.
#
# Usage:
#   ENCLII_TOKEN='…' ./scripts/deploy/provision-shared-postgres.sh
#
# Optional:
#   VOXA_DB_PASSWORD='…' VOXA_STAGING_DB_PASSWORD='…'  # reuse existing creds
#   ENCLII_API_URL=https://api.enclii.dev

set -euo pipefail

API="${ENCLII_API_URL:-https://api.enclii.dev}"
TOKEN="${ENCLII_TOKEN:?Set ENCLII_TOKEN}"

auth=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

rand_pw() {
  python3 - <<'PY'
import secrets, string
alphabet = string.ascii_letters + string.digits + "!@#"
print(secrets.token_urlsafe(24) + "Aa1!")
PY
}

VOXA_PW="${VOXA_DB_PASSWORD:-$(rand_pw)}"
STAGING_PW="${VOXA_STAGING_DB_PASSWORD:-$(rand_pw)}"

provision_db() {
  local db="$1" role="$2" pw="$3"
  curl -sS -X POST "${API}/v1/admin/provision/postgres" "${auth[@]}" \
    -d "{\"namespace\":\"data\",\"spec\":{\"database_name\":\"${db}\",\"role_name\":\"${role}\",\"role_password\":\"${pw}\",\"extensions\":[\"uuid-ossp\",\"pgcrypto\"]}}" \
    | python3 -c "import json,sys; j=json.load(sys.stdin); print(j.get('status','error'), j.get('database', j.get('error','')))"
}

database_url() {
  local role="$1" pw="$2" db="$3"
  python3 - <<PY
import urllib.parse
role=${role@Q}
pw=${pw@Q}
db=${db@Q}
print('postgresql://'+urllib.parse.quote(role,safe='')+':'+urllib.parse.quote(pw,safe='')+'@postgres.data.svc.cluster.local:5432/'+db+'?sslmode=disable')
PY
}

apply_secret() {
  local ns="$1" url="$2"
  curl -sS -X POST "${API}/v1/admin/provision/secrets" "${auth[@]}" \
    -d "{\"namespace\":\"${ns}\",\"secret_name\":\"voxa-secrets\",\"secrets\":[{\"key\":\"DATABASE_URL\",\"value\":\"${url}\"}]}" \
    >/dev/null
  echo "Applied DATABASE_URL to ${ns}/voxa-secrets"
}

echo "Provisioning shared Postgres databases…"
provision_db voxa voxa "${VOXA_PW}"
provision_db voxa_staging voxa_staging "${STAGING_PW}"

PROD_URL="$(database_url voxa "${VOXA_PW}" voxa)"
STAGING_URL="$(database_url voxa_staging "${STAGING_PW}" voxa_staging)"

apply_secret voxa "${PROD_URL}"
apply_secret voxa-staging "${STAGING_URL}"

for app in voxa-services voxa-staging-services; do
  curl -sS -X POST "${API}/v1/ops/apps/sync" "${auth[@]}" \
    -d "{\"application\":\"${app}\",\"reason\":\"Apply shared Postgres DATABASE_URL\",\"dry_run\":false,\"args\":{\"target\":\"${app}\"}}" \
    >/dev/null
  echo "Synced Argo app ${app}"
done

cat <<EOF

Next: commit a pod-template restart annotation (or rollout restart) so API pods
reload envFrom secrets, then verify:

  curl -sS https://voxa-api.madfam.io/health/ready
  # expect "store":"postgres"

PgBouncer: if platform ops add voxa/voxa_staging to pgbouncer-config, switch
DATABASE_URL host to pgbouncer.data.svc.cluster.local:6432.
EOF
