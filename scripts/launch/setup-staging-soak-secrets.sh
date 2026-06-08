#!/usr/bin/env bash
# Configure GitHub Actions secrets for staging authenticated soak (e2e-smoke workflow).
#
# Usage (values from password manager / Enclii voxa-secrets — never commit):
#   VOXA_STAGING_OIDC_CLIENT_ID='jnc_…' \
#   VOXA_STAGING_OIDC_CLIENT_SECRET='jns_…' \
#   VOXA_STAGING_TEST_EMAIL='…' \
#   VOXA_STAGING_TEST_PASSWORD='…' \
#     ./scripts/launch/setup-staging-soak-secrets.sh
#
# Requires: gh CLI authenticated with repo admin on madfam-org/voxa

set -euo pipefail

REPO="${GITHUB_REPO:-madfam-org/voxa}"

required=(VOXA_STAGING_OIDC_CLIENT_ID VOXA_STAGING_OIDC_CLIENT_SECRET VOXA_STAGING_TEST_EMAIL VOXA_STAGING_TEST_PASSWORD)
for var in "${required[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Set ${var}" >&2
    exit 1
  fi
done

gh secret set VOXA_STAGING_OIDC_CLIENT_ID --repo "${REPO}" --body "${VOXA_STAGING_OIDC_CLIENT_ID}"
gh secret set VOXA_STAGING_OIDC_CLIENT_SECRET --repo "${REPO}" --body "${VOXA_STAGING_OIDC_CLIENT_SECRET}"
gh secret set VOXA_STAGING_TEST_EMAIL --repo "${REPO}" --body "${VOXA_STAGING_TEST_EMAIL}"
gh secret set VOXA_STAGING_TEST_PASSWORD --repo "${REPO}" --body "${VOXA_STAGING_TEST_PASSWORD}"

echo "Configured staging soak secrets on ${REPO}"
gh secret list --repo "${REPO}" | grep VOXA_STAGING || true
