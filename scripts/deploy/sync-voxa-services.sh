#!/usr/bin/env bash
# Sync the Voxa production ArgoCD application via Enclii.
#
# Usage:
#   ENCLII_TOKEN='…' ./scripts/deploy/sync-voxa-services.sh
#   ENCLII_TOKEN='…' ./scripts/deploy/sync-voxa-services.sh voxa-staging-services
#
# Optional:
#   ENCLII_REVISION=abc123…  # pin Git revision for sync

set -euo pipefail

API="${ENCLII_API_URL:-https://api.enclii.dev}"
TOKEN="${ENCLII_TOKEN:?Set ENCLII_TOKEN}"
APP="${1:-voxa-services}"
REVISION="${ENCLII_REVISION:-}"
export APP REVISION

payload="$(python3 - <<'PY'
import json, os
args = {"target": os.environ["APP"]}
if os.environ.get("REVISION"):
    args["revision"] = os.environ["REVISION"]
print(json.dumps({
    "application": os.environ["APP"],
    "reason": f"Sync {os.environ['APP']} GitOps state",
    "args": args,
}))
PY
)"

echo "Syncing Argo application ${APP}…"
/usr/bin/curl -sS -X POST "${API}/v1/ops/apps/sync" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "${payload}" | python3 -m json.tool

echo ""
echo "Next: ./scripts/deploy/restart-voxa-web.sh prod && ./scripts/launch/verify-prod-demo.sh"
