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

# Scene UI strings across es (default), en, and fr demo bundles.
DEMO_SCENE_MARKERS='Try Voxa|Core vocabulary|Prueba Voxa|Vocabulario|Essayez Voxa|Vocabulaire de base'

demo_has_scene_ui() {
  grep -qE "${DEMO_SCENE_MARKERS}" <<<"$1"
}

demo_has_arasaac() {
  grep -q 'static\.arasaac' <<<"$1"
}

extract_demo_chunk() {
  grep -oE 'app/(%5Blocale%5D|\[locale\]|demo)/demo/page-[a-f0-9]+\.js|app/demo/page-[a-f0-9]+\.js' <<<"$1" | head -1 || true
}

check_demo_bundle() {
  local html chunk body
  html="$(curl -sf "${WEB_BASE}/demo" 2>/dev/null || true)"
  if [ -z "${html}" ]; then
    echo "Could not fetch ${WEB_BASE}/demo" >&2
    return 1
  fi

  chunk="$(extract_demo_chunk "${html}")"
  if [ -z "${chunk}" ]; then
    echo "No demo page chunk reference in HTML" >&2
    return 1
  fi

  if demo_has_arasaac "${html}" && demo_has_scene_ui "${html}"; then
    echo "OK   demo page HTML includes ARASAAC pictograms and new scene UI"
    return 0
  fi

  body="$(curl -sf "${WEB_BASE}/_next/static/chunks/${chunk}" 2>/dev/null || true)"
  if [ -z "${body}" ]; then
    echo "Could not fetch demo chunk ${chunk}" >&2
    return 1
  fi

  if demo_has_arasaac "${body}" && demo_has_scene_ui "${body}"; then
    echo "OK   demo bundle ${chunk} includes ARASAAC pictograms and new scene UI"
    return 0
  fi

  if demo_has_arasaac "${html}" || demo_has_arasaac "${body}"; then
    if demo_has_scene_ui "${html}" || demo_has_scene_ui "${body}"; then
      echo "OK   demo bundle ${chunk} includes ARASAAC pictograms and scene UI (split HTML/chunk)"
      return 0
    fi
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
echo "Hint: ENCLII_TOKEN=… ./scripts/deploy/sync-voxa-services.sh && ./scripts/deploy/restart-voxa-web.sh prod" >&2
exit 1
