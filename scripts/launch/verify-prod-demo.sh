#!/usr/bin/env bash
# Verify production /demo serves the ARASAAC-backed multi-scene visitor demo.
#
# Usage:
#   ./scripts/launch/verify-prod-demo.sh
#   VOXA_DEMO_VERIFY_ATTEMPTS=6 VOXA_DEMO_VERIFY_SLEEP_SEC=30 ./scripts/launch/verify-prod-demo.sh

set -euo pipefail

WEB_BASE="${VOXA_PROD_WEB_URL:-https://voxa.madfam.io}"
ATTEMPTS="${VOXA_DEMO_VERIFY_ATTEMPTS:-18}"
SLEEP_SEC="${VOXA_DEMO_VERIFY_SLEEP_SEC:-20}"

check_demo_bundle() {
  local html chunk body
  html="$(curl -sf "${WEB_BASE}/demo" 2>/dev/null || true)"
  if [ -z "${html}" ]; then
    echo "Could not fetch ${WEB_BASE}/demo" >&2
    return 1
  fi

  chunk="$(grep -oE 'app/demo/page-[a-f0-9]+\.js' <<<"${html}" | head -1 || true)"
  if [ -z "${chunk}" ]; then
    echo "No demo page chunk reference in HTML" >&2
    return 1
  fi

  body="$(curl -sf "${WEB_BASE}/_next/static/chunks/${chunk}" 2>/dev/null || true)"
  if [ -z "${body}" ]; then
    echo "Could not fetch demo chunk ${chunk}" >&2
    return 1
  fi

  if grep -q 'static\.arasaac' <<<"${body}" && grep -qE 'Try Voxa|Core vocabulary' <<<"${body}"; then
    echo "OK   demo bundle ${chunk} includes ARASAAC pictograms and new scene UI"
    return 0
  fi

  if grep -q 'Visitor demo' <<<"${body}"; then
    echo "WARN legacy Visitor demo bundle still live (${chunk})" >&2
  else
    echo "WARN demo bundle ${chunk} missing ARASAAC + scene markers" >&2
  fi
  return 1
}

echo "== Production demo bundle (${WEB_BASE}/demo) =="
for i in $(seq 1 "${ATTEMPTS}"); do
  echo "[${i}/${ATTEMPTS}]"
  if check_demo_bundle; then
    exit 0
  fi
  if [ "${i}" -lt "${ATTEMPTS}" ]; then
    sleep "${SLEEP_SEC}"
  fi
done

echo "FAIL production demo never rolled out with ARASAAC bundle" >&2
echo "Hint: sync Argo app voxa-services or run ENCLII_TOKEN=… ./scripts/deploy/restart-voxa-web.sh prod" >&2
exit 1
