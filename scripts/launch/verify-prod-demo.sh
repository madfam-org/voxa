#!/usr/bin/env bash
# Verify production /demo serves the multi-scene visitor demo with the
# commercially clean symbol set: Mulberry Symbols (CC BY-SA 4.0) present,
# no ARASAAC (CC BY-NC-SA) reference anywhere, and the vendored SVGs served.
#
# Usage:
#   ./scripts/launch/verify-prod-demo.sh
#   VOXA_DEMO_VERIFY_ATTEMPTS=6 VOXA_DEMO_VERIFY_SLEEP_SEC=30 ./scripts/launch/verify-prod-demo.sh

set -euo pipefail

WEB_BASE="${VOXA_PROD_WEB_URL:-https://voxa.madfam.io}"
ATTEMPTS="${VOXA_DEMO_VERIFY_ATTEMPTS:-18}"
SLEEP_SEC="${VOXA_DEMO_VERIFY_SLEEP_SEC:-20}"
SAMPLE_SYMBOL="${VOXA_DEMO_SAMPLE_SYMBOL:-symbols/mulberry/want.svg}"

# Scene UI strings across es (default), en, and fr demo bundles.
DEMO_SCENE_MARKERS='Try Voxa|Core vocabulary|Prueba Voxa|Vocabulario|Essayez Voxa|Vocabulaire de base'

demo_has_scene_ui() {
  grep -qE "${DEMO_SCENE_MARKERS}" <<<"$1"
}

demo_has_mulberry() {
  grep -q '/symbols/mulberry/' <<<"$1"
}

demo_has_arasaac() {
  grep -qi 'arasaac\.org' <<<"$1"
}

sample_symbol_served() {
  local ctype
  ctype="$(curl -sf -o /dev/null -w '%{content_type}' "${WEB_BASE}/${SAMPLE_SYMBOL}" 2>/dev/null || true)"
  [[ "${ctype}" == image/svg+xml* ]]
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

  body="$(curl -sf "${WEB_BASE}/_next/static/chunks/${chunk}" 2>/dev/null || true)"
  if [ -z "${body}" ]; then
    echo "Could not fetch demo chunk ${chunk}" >&2
    return 1
  fi

  if demo_has_arasaac "${html}" || demo_has_arasaac "${body}"; then
    echo "WARN demo still references ARASAAC (${chunk}): previous build live, or a regression" >&2
    return 1
  fi
  if ! { demo_has_mulberry "${html}" || demo_has_mulberry "${body}"; }; then
    echo "WARN demo bundle ${chunk} has no Mulberry symbol references" >&2
    return 1
  fi
  if ! { demo_has_scene_ui "${html}" || demo_has_scene_ui "${body}"; }; then
    echo "WARN demo bundle ${chunk} is missing the scene UI markers" >&2
    return 1
  fi
  if ! sample_symbol_served; then
    echo "WARN ${WEB_BASE}/${SAMPLE_SYMBOL} is not served as image/svg+xml" >&2
    return 1
  fi
  echo "OK   demo ${chunk}: Mulberry symbols, scene UI, no ARASAAC; ${SAMPLE_SYMBOL} served"
  return 0
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

echo "FAIL production demo never served the Mulberry demo without ARASAAC" >&2
echo "Hint: check the web rollout through Enclii (Argo sync of the production web deployment), then re-run." >&2
exit 1
