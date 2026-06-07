#!/usr/bin/env bash
# Run remaining Voxa GA operator steps (requires credentials noted below).
#
# Usage:
#   ENCLII_TOKEN='…' ./scripts/deploy/complete-ga-operator.sh
#
# Optional:
#   JANUA_ADMIN_EMAIL / JANUA_ADMIN_PASSWORD — register OAuth client
#   ENCLII_CALLBACK_TOKEN — GitHub Actions lifecycle callbacks
#   ENCLII_WEBHOOK_SECRET — GitHub webhook HMAC (from enclii-github-webhook secret)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT}"

echo "==> 1/5 Verify API health"
curl -sS https://voxa-api.madfam.io/health/ready
echo
curl -sS https://voxa-api-staging.madfam.io/health/ready
echo

if [[ -n "${ENCLII_TOKEN:-}" ]]; then
  echo "==> 2/5 Shared Postgres (idempotent)"
  "${ROOT}/scripts/deploy/provision-shared-postgres.sh"
else
  echo "==> 2/5 Skip Postgres (set ENCLII_TOKEN)"
fi

if [[ -n "${JANUA_ADMIN_EMAIL:-}" && -n "${JANUA_ADMIN_PASSWORD:-}" ]]; then
  echo "==> 3/5 Register Janua OAuth client"
  "${ROOT}/scripts/deploy/register-janua-oauth-client.sh"
  echo "Add OIDC_CLIENT_SECRET to voxa-secrets via Enclii provision/secrets."
else
  echo "==> 3/5 Skip Janua client (set JANUA_ADMIN_EMAIL and JANUA_ADMIN_PASSWORD)"
fi

if [[ -n "${ENCLII_CALLBACK_TOKEN:-}" ]]; then
  echo "==> 4/5 GitHub ENCLII_CALLBACK_TOKEN"
  ENCLII_CALLBACK_TOKEN="${ENCLII_CALLBACK_TOKEN}" "${ROOT}/scripts/deploy/setup-github-secrets.sh"
else
  echo "==> 4/5 Skip callback token (see enclii/docs/guides/DEPLOYMENT_TRACKING.md)"
fi

if [[ -n "${ENCLII_WEBHOOK_SECRET:-}" ]]; then
  echo "==> 5/5 GitHub webhook"
  ENCLII_WEBHOOK_SECRET="${ENCLII_WEBHOOK_SECRET}" "${ROOT}/scripts/deploy/setup-github-webhook.sh"
else
  echo "==> 5/5 Skip webhook (see enclii/docs/guides/WEBHOOK_SETUP_GUIDE.md)"
fi

cat <<'EOF'

Manual platform items:
- GHCR packages public → remove k8s/*/signature-policyexception.yaml
- PgBouncer: add voxa / voxa_staging to pgbouncer-config (switchyard-api RBAC)
- Flip JANUA_AUTH_REQUIRED=true after OIDC_CLIENT_SECRET is in voxa-secrets

Verify:
  curl -sS https://voxa-api.madfam.io/health/ready
  open https://voxa.madfam.io/auth/signin
EOF
