#!/usr/bin/env bash
# Verify production voxa-web Janua OAuth callback (same flow as staging verify).
#
# Usage:
#   OIDC_CLIENT_ID='jnc_…' OIDC_CLIENT_SECRET='jns_…' \
#   JANUA_TEST_EMAIL='…' JANUA_TEST_PASSWORD='…' \
#     ./scripts/launch/verify-prod-web-oidc.sh

set -euo pipefail

export VOXA_STAGING_WEB_URL="${VOXA_PROD_WEB_URL:-https://voxa.madfam.io}"
export VOXA_STAGING_CALLBACK_URL="${VOXA_PROD_CALLBACK_URL:-${VOXA_STAGING_WEB_URL}/auth/callback}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec "${ROOT}/scripts/launch/verify-staging-web-oidc.sh"
