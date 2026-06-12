#!/usr/bin/env bash
# Print an Enclii-compatible bearer token using Janua admin credentials.
# Enclii accepts Janua access tokens for service/ops APIs.
#
# Usage:
#   eval "$(./scripts/deploy/enclii-token-from-janua.sh)"
#   ENCLII_TOKEN='…' ./scripts/deploy/sync-voxa-services.sh

set -euo pipefail

EMAIL="${JANUA_ADMIN_EMAIL:?Set JANUA_ADMIN_EMAIL}"
PASSWORD="${JANUA_ADMIN_PASSWORD:?Set JANUA_ADMIN_PASSWORD}"

token="$(/usr/bin/curl -sS -X POST 'https://auth.madfam.io/api/v1/auth/login' \
  -H 'Content-Type: application/json' \
  -d "$(python3 - <<PY
import json, os
print(json.dumps({"email": os.environ["EMAIL"], "password": os.environ["PASSWORD"]}))
PY
)" | python3 -c "
import json, sys
body = json.load(sys.stdin)
print((body.get('tokens') or {}).get('access_token') or body.get('access_token') or '')
")"

if [ -z "${token}" ]; then
  echo 'Janua login failed' >&2
  exit 1
fi

printf 'export ENCLII_TOKEN=%q\n' "${token}"
