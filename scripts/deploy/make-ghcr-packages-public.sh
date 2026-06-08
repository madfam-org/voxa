#!/usr/bin/env bash
# Set Voxa GHCR container packages to public visibility (org admin).
#
# Requires GitHub CLI authenticated with read:packages and admin:org (or package admin).
#
# Usage:
#   ./scripts/deploy/make-ghcr-packages-public.sh
#   ./scripts/deploy/make-ghcr-packages-public.sh --check
#
# After success:
#   1. Remove k8s/production/signature-policyexception.yaml and k8s/staging/signature-policyexception.yaml
#   2. Remove references from k8s/*/kustomization.yaml
#   3. Commit, push, verify Argo sync

set -euo pipefail

ORG="${GHCR_ORG:-madfam-org}"
# GHCR image paths are ghcr.io/madfam-org/voxa/voxa-{api,web}
PACKAGES=(voxa%2Fvoxa-api voxa%2Fvoxa-web)
CHECK_ONLY=false

if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
fi

for pkg in "${PACKAGES[@]}"; do
  echo "== ${ORG}/${pkg} =="
  if ! visibility="$(gh api "orgs/${ORG}/packages/container/${pkg}" --jq '.visibility' 2>&1)"; then
    echo "${visibility}" >&2
    echo "Hint: gh auth refresh -s read:packages" >&2
    exit 1
  fi
  echo "  visibility: ${visibility}"
  if [[ "${CHECK_ONLY}" == true ]]; then
    if [[ "${visibility}" != "public" ]]; then
      echo "  not public yet" >&2
      exit 1
    fi
    continue
  fi
  if [[ "${visibility}" == "public" ]]; then
    echo "  already public"
    continue
  fi
  gh api -X PATCH "orgs/${ORG}/packages/container/${pkg}" \
    -f visibility=public \
    --jq '{name, visibility, updated_at}'
  echo "  set to public"
done

if [[ "${CHECK_ONLY}" == true ]]; then
  echo "All packages public."
else
  cat <<EOF

Next steps:
  1. ./scripts/deploy/make-ghcr-packages-public.sh --check
  2. Remove k8s/*/signature-policyexception.yaml and kustomization entries
  3. Push and verify voxa-services / voxa-staging-services Synced
EOF
fi
