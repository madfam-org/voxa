#!/usr/bin/env bash
# Deactivate duplicate Janua OAuth clients named "Voxa" (keep production client).
#
# Safe to dry-run first. Production client id defaults to GitHub variable value.
#
# Usage:
#   JANUA_ADMIN_EMAIL='…' JANUA_ADMIN_PASSWORD='…' \
#     ./scripts/deploy/cleanup-duplicate-janua-voxa-clients.sh --dry-run
#
#   … ./scripts/deploy/cleanup-duplicate-janua-voxa-clients.sh

set -euo pipefail

JANUA_API_URL="${JANUA_API_URL:-https://auth.madfam.io}"
KEEP_CLIENT_ID="${VOXA_PRODUCTION_CLIENT_ID:-jnc_4qRWyI-ul_GL28hrSxrX7AvIyotFMBuB}"
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      sed -n '1,12p' "$0"
      exit 0
      ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
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

list_resp="$(curl -sS "${JANUA_API_URL}/api/v1/oauth/clients/admin/all?search=Voxa" \
  -H "Authorization: Bearer ${token}")"

export JANUA_TOKEN="${token}"
export JANUA_API_URL
export KEEP_CLIENT_ID
export LIST_JSON="${list_resp}"
export DRY_RUN="${DRY_RUN}"

python3 - <<'PY'
import json, os, subprocess, sys

keep = os.environ["KEEP_CLIENT_ID"]
dry_run = os.environ.get("DRY_RUN") == "true"
token = os.environ["JANUA_TOKEN"]
api = os.environ["JANUA_API_URL"]

items = json.loads(os.environ["LIST_JSON"])
if isinstance(items, dict):
    items = items.get("items") or items.get("clients") or []
if isinstance(items, dict):
    items = items.get("items", [])

targets = [
    c for c in items
    if c.get("name") == "Voxa"
    and c.get("client_id") != keep
    and c.get("is_active") is not False
]

print(f"Keeping: {keep}")
print(f"Deactivate candidates: {len(targets)}")
for c in targets:
    cid = c.get("client_id")
    uuid = c.get("id")
    print(f"  - {cid} ({uuid})")
    if dry_run:
        continue
    patch = subprocess.run([
        "curl", "-sS", "-o", "/dev/null", "-w", "%{http_code}",
        "-X", "PATCH", f"{api}/api/v1/oauth/clients/{uuid}",
        "-H", f"Authorization: Bearer {token}",
        "-H", "Content-Type: application/json",
        "-d", '{"is_active": false}',
    ], capture_output=True, text=True)
    code = patch.stdout.strip() or patch.stderr.strip()
    if code not in {"200", "201"}:
        print(f"    FAIL deactivate {cid}: HTTP {code}", file=sys.stderr)
        sys.exit(1)
    print(f"    deactivated {cid}")

if dry_run:
    print("Dry run complete — no changes made.")
PY
