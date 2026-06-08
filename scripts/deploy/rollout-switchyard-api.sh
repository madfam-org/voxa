#!/usr/bin/env bash
# Recycle switchyard-api pods so ENCLII_GITHUB_WEBHOOK_SECRET reloads after rotation.
#
# Enclii POST /v1/services/:id/restart may not roll pods when Argo self-heal reverts
# enclii.dev/restartedAt. Prefer kubectl rollout restart via cluster break-glass when SSH works.
#
# When the cluster is CPU-saturated, new pods stay Pending. Use --via-enclii-scale to scale
# switchyard-api to 1 replica, restart, verify webhook, then scale back to 2.
#
# Usage:
#   ./scripts/deploy/rollout-switchyard-api.sh
#   ENCLII_TOKEN='…' ./scripts/deploy/rollout-switchyard-api.sh --via-enclii-scale
#   ENCLII_TOKEN='…' ./scripts/deploy/rollout-switchyard-api.sh --via-enclii
#
# Requires Cloudflare Access for SSH (cloudflared access login ssh.madfam.io).

set -euo pipefail

SWITCHYARD_SERVICE_ID="${SWITCHYARD_SERVICE_ID:-4080ddc2-7ec7-4eaf-bbf4-00884d7b38b3}"
API="${ENCLII_API_URL:-https://api.enclii.dev}"
WEBHOOK_URL="${ENCLII_WEBHOOK_URL:-${API}/v1/webhooks/github}"
TARGET_REPLICAS="${SWITCHYARD_TARGET_REPLICAS:-2}"
SCALE_DOWN_REPLICAS="${SWITCHYARD_SCALE_DOWN_REPLICAS:-1}"

mode="${1:-ssh}"

if [[ "${mode}" == "--via-enclii" || "${mode}" == "--via-enclii-scale" ]]; then
  TOKEN="${ENCLII_TOKEN:?Set ENCLII_TOKEN for ${mode}}"
  auth=(-H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json")

  if [[ "${mode}" == "--via-enclii-scale" ]]; then
    echo "Scaling switchyard-api to ${SCALE_DOWN_REPLICAS} replica(s) to free cluster CPU …"
    curl -sS -X POST "${API}/v1/services/${SWITCHYARD_SERVICE_ID}/scale" "${auth[@]}" \
      -d "{\"replicas\":${SCALE_DOWN_REPLICAS},\"env\":\"production\"}" \
      | python3 -m json.tool
    sleep 20
  fi

  curl -sS -X POST "${API}/v1/services/${SWITCHYARD_SERVICE_ID}/restart" "${auth[@]}" \
    -H "Content-Type: application/json" \
    -d '{"reason":"Reload ENCLII_GITHUB_WEBHOOK_SECRET for Voxa GA"}' \
    | python3 -m json.tool

  if [[ "${mode}" == "--via-enclii-scale" ]]; then
    echo "Waiting for webhook ping to return 200 …"
    body='{"zen":"test"}'
    secret="${ENCLII_WEBHOOK_SECRET:-}"
    for _ in $(seq 1 12); do
      sleep 10
      if [[ -n "${secret}" ]]; then
        sig="sha256=$(printf '%s' "${body}" | openssl dgst -sha256 -hmac "${secret}" | awk '{print $2}')"
        code=$(curl -sS -o /tmp/enclii-webhook.json -w '%{http_code}' -X POST "${WEBHOOK_URL}" \
          -H 'Content-Type: application/json' -H 'X-GitHub-Event: ping' \
          -H "X-Hub-Signature-256: ${sig}" -d "${body}")
        echo "  webhook HTTP ${code} $(cat /tmp/enclii-webhook.json)"
        if [[ "${code}" == "200" ]]; then
          break
        fi
      fi
    done

    echo "Scaling switchyard-api back to ${TARGET_REPLICAS} replica(s) …"
    curl -sS -X POST "${API}/v1/services/${SWITCHYARD_SERVICE_ID}/scale" "${auth[@]}" \
      -d "{\"replicas\":${TARGET_REPLICAS},\"env\":\"production\"}" \
      | python3 -m json.tool
  else
    echo "If webhook ping still 401, run --via-enclii-scale or kubectl rollout restart."
  fi
  exit 0
fi

echo "Rolling restart switchyard-api via ssh.madfam.io …"
ssh ssh.madfam.io 'sudo /usr/local/bin/k3s kubectl rollout restart deployment/switchyard-api -n enclii'
ssh ssh.madfam.io 'sudo /usr/local/bin/k3s kubectl rollout status deployment/switchyard-api -n enclii --timeout=180s'

echo "Redeliver GitHub hook ping on madfam-org/voxa and expect HTTP 200."
