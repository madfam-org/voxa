#!/usr/bin/env bash
# Verify the deployed web app does not run Next's image optimizer
# (GHSA-2xp9-vwfh-vxw4 defence in depth): /_next/image must answer 404.
# apps/web/next.config.ts sets images.unoptimized; CI proves the build, this
# proves what the host actually serves. Retries while a rollout replaces pods.
#
# Usage:
#   ./scripts/launch/verify-prod-image-optimizer.sh
#   VOXA_PROD_WEB_URL=https://voxa-staging.madfam.io ./scripts/launch/verify-prod-image-optimizer.sh

set -euo pipefail

WEB_BASE="${VOXA_PROD_WEB_URL:-https://voxa.madfam.io}"
ATTEMPTS="${VOXA_IMAGE_VERIFY_ATTEMPTS:-18}"
SLEEP_SEC="${VOXA_IMAGE_VERIFY_SLEEP_SEC:-20}"
PROBE="${WEB_BASE}/_next/image?url=%2Ffavicon.ico&w=64&q=75"

echo "== Image optimizer off (${WEB_BASE}/_next/image) =="
status=000
for i in $(seq 1 "${ATTEMPTS}"); do
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${PROBE}" 2>/dev/null || true)"
  if [ "${status}" = "404" ]; then
    echo "OK   /_next/image -> 404"
    exit 0
  fi
  echo "[${i}/${ATTEMPTS}] /_next/image -> ${status}, expected 404"
  if [ "${i}" -lt "${ATTEMPTS}" ]; then
    sleep "${SLEEP_SEC}"
  fi
done
echo "FAIL /_next/image returned HTTP ${status}, expected 404 (image optimizer enabled)" >&2
exit 1
