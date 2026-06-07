#!/usr/bin/env bash
# Configure optional GitHub Actions secrets for Voxa deploy workflows.
# Usage:
#   ENCLII_CALLBACK_TOKEN='<token>' ./scripts/deploy/setup-github-secrets.sh
#
# ENCLII_CALLBACK_TOKEN is the ArgoCD webhook secret (shared across MADFAM repos).
# See enclii/docs/guides/DEPLOYMENT_TRACKING.md for how to obtain it.

set -euo pipefail

REPO="${REPO:-madfam-org/voxa}"

if [[ -n "${ENCLII_CALLBACK_TOKEN:-}" ]]; then
  gh secret set ENCLII_CALLBACK_TOKEN --repo "${REPO}" --body "${ENCLII_CALLBACK_TOKEN}"
  echo "Set ENCLII_CALLBACK_TOKEN on ${REPO}"
else
  echo "Skip ENCLII_CALLBACK_TOKEN (env var not set). Lifecycle callbacks will no-op until configured."
fi

echo "Done. Deploy workflows use GITHUB_TOKEN for GHCR and digest commits."
