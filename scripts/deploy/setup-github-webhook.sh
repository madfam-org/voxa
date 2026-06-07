#!/usr/bin/env bash
# Register the Enclii GitHub webhook on madfam-org/voxa.
#
# Requires: gh CLI with admin:repo_hook scope, ENCLII_WEBHOOK_SECRET from platform ops.
#
# Usage:
#   ENCLII_WEBHOOK_SECRET='…' ./scripts/deploy/setup-github-webhook.sh
#
# See enclii/docs/guides/WEBHOOK_SETUP_GUIDE.md

set -euo pipefail

REPO="${REPO:-madfam-org/voxa}"
PAYLOAD_URL="${PAYLOAD_URL:-https://api.enclii.dev/v1/webhooks/github}"
SECRET="${ENCLII_WEBHOOK_SECRET:?Set ENCLII_WEBHOOK_SECRET (GitHub webhook secret shared with Enclii)}"

existing="$(gh api "repos/${REPO}/hooks" --jq '.[] | select(.config.url=="'"${PAYLOAD_URL}"'") | .id' 2>/dev/null || true)"
if [[ -n "${existing}" ]]; then
  echo "Webhook already registered (id ${existing})"
  exit 0
fi

gh api "repos/${REPO}/hooks" \
  -f name='web' \
  -f active=true \
  -f 'events[]=push' \
  -f 'events[]=pull_request' \
  -f 'events[]=release' \
  -f "config[url]=${PAYLOAD_URL}" \
  -f 'config[content_type]=json' \
  -f "config[secret]=${SECRET}" \
  -f 'config[insecure_ssl]=0'

echo "Registered GitHub webhook → ${PAYLOAD_URL}"
