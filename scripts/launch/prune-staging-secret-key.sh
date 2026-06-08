#!/usr/bin/env bash
# Remove a stray key from voxa-staging/voxa-secrets (Enclii provision merges only; no delete API).
#
# Prefers break-glass SSH + kubectl. Safe to dry-run.
#
# Usage:
#   ./scripts/launch/prune-staging-secret-key.sh TEST_PROBE --dry-run
#   ./scripts/launch/prune-staging-secret-key.sh TEST_PROBE

set -euo pipefail

KEY="${1:?Usage: $0 KEY [--dry-run]}"
DRY_RUN=false
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=true

NS="${VOXA_STAGING_NAMESPACE:-voxa-staging}"
SECRET="${VOXA_STAGING_SECRET:-voxa-secrets}"
SSH_HOST="${VOXA_SSH_HOST:-ssh.madfam.io}"
KUBECTL="${VOXA_KUBECTL:-sudo /usr/local/bin/k3s kubectl}"

remote_cmd=$(cat <<EOF
${KUBECTL} get secret ${SECRET} -n ${NS} -o jsonpath='{.data.${KEY}}' | wc -c
EOF
)

if ! key_len="$(ssh -o ConnectTimeout=15 -o BatchMode=yes "${SSH_HOST}" "${remote_cmd}" 2>/dev/null)"; then
  echo "SSH/kubectl unavailable. Remove manually:" >&2
  echo "  ${KUBECTL} patch secret ${SECRET} -n ${NS} --type=json \\" >&2
  echo "    -p='[{\"op\":\"remove\",\"path\":\"/data/${KEY}\"}]'" >&2
  exit 2
fi

if [[ "${key_len// /}" == "0" ]]; then
  echo "Key ${KEY} not present in ${NS}/${SECRET} (nothing to do)."
  exit 0
fi

if [[ "${DRY_RUN}" == true ]]; then
  echo "Would remove ${KEY} from ${NS}/${SECRET} (present)."
  exit 0
fi

ssh -o ConnectTimeout=15 -o BatchMode=yes "${SSH_HOST}" \
  "${KUBECTL} patch secret ${SECRET} -n ${NS} --type=json -p='[{\"op\":\"remove\",\"path\":\"/data/${KEY}\"}]'"
echo "Removed ${KEY} from ${NS}/${SECRET}."
