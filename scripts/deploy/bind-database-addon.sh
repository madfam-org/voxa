#!/usr/bin/env bash
# Poll Enclii until a database addon is ready, bind DATABASE_URL to voxa-api, sync Argo.
#
# Requires: curl, python3, Enclii API token in ENCLII_TOKEN (or login via enclii CLI).
#
# Usage:
#   ENCLII_TOKEN='…' ./scripts/deploy/bind-database-addon.sh voxa c3ea79f2-e05e-4567-8f10-d9d98a0fc2dd 5df18423-044a-4dde-88a7-721727f6974b voxa-services

set -euo pipefail

PROJECT="${1:?project slug}"
ADDON_ID="${2:?addon uuid}"
SERVICE_ID="${3:?voxa-api service uuid}"
ARGO_APP="${4:-voxa-services}"
API="${ENCLII_API_URL:-https://api.enclii.dev}"
TOKEN="${ENCLII_TOKEN:?Set ENCLII_TOKEN}"

auth=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

for i in $(seq 1 60); do
  curl -sS -X POST "${API}/v1/addons/${ADDON_ID}/refresh" "${auth[@]}" >/dev/null || true
  status="$(curl -sS "${API}/v1/addons/${ADDON_ID}" "${auth[@]}" | python3 -c "import json,sys; print(json.load(sys.stdin).get('status','unknown'))")"
  echo "[$i/60] addon status: ${status}"
  if [[ "${status}" == "ready" ]]; then
    break
  fi
  if [[ "${status}" == "failed" || "${status}" == "error" ]]; then
    echo "Addon failed provisioning" >&2
    exit 1
  fi
  sleep 10
done

if [[ "${status:-}" != "ready" ]]; then
  echo "Timed out waiting for addon ready" >&2
  exit 1
fi

bind_code="$(curl -sS -o /tmp/voxa-bind.json -w '%{http_code}' -X POST \
  "${API}/v1/addons/${ADDON_ID}/bindings" \
  "${auth[@]}" \
  -d "{\"service_id\":\"${SERVICE_ID}\",\"env_var_name\":\"DATABASE_URL\"}")"

echo "bind HTTP ${bind_code}"
cat /tmp/voxa-bind.json
echo

if [[ "${bind_code}" != "201" && "${bind_code}" != "200" && "${bind_code}" != "409" ]]; then
  exit 1
fi

sync_code="$(curl -sS -o /tmp/voxa-sync.json -w '%{http_code}' -X POST \
  "${API}/v1/ops/apps/sync" \
  "${auth[@]}" \
  -d "{\"application\":\"${ARGO_APP}\",\"reason\":\"Apply DATABASE_URL binding\",\"args\":{\"target\":\"${ARGO_APP}\"}}")"

echo "sync HTTP ${sync_code}"
cat /tmp/voxa-sync.json
echo

echo "Verify: curl -sS https://voxa-api.madfam.io/health/ready"
