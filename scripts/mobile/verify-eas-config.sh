#!/usr/bin/env bash
# Validate Expo/EAS mobile packaging before preview or store builds.
#
# Usage:
#   ./scripts/mobile/verify-eas-config.sh
#   REQUIRE_LINKED=1 ./scripts/mobile/verify-eas-config.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="${ROOT}/apps/mobile"
REQUIRE_LINKED="${REQUIRE_LINKED:-0}"

fail=0
warn=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "OK   ${name}"
  else
    echo "FAIL ${name}" >&2
    fail=1
  fi
}

warn_if() {
  local name="$1"
  shift
  if "$@"; then
    echo "OK   ${name}"
  else
    echo "WARN ${name}" >&2
    warn=1
  fi
}

project_id="$(node -p "require('${MOBILE}/app.json').expo.extra.eas.projectId")"
if [[ "${project_id}" == REPLACE_WITH* ]]; then
  if [[ "${REQUIRE_LINKED}" == "1" ]]; then
    check "EAS project linked (extra.eas.projectId)" false
  else
    warn_if "EAS project linked (run: cd apps/mobile && npx eas init)" false
  fi
else
  check "EAS project linked (extra.eas.projectId)" test -n "${project_id}"
fi

check "iOS bundle identifier set" grep -q '"bundleIdentifier": "io.madfam.voxa"' "${MOBILE}/app.json"
check "Android package set" grep -q '"package": "io.madfam.voxa"' "${MOBILE}/app.json"
check "App icon present" test -f "${MOBILE}/assets/icon.png"
check "Adaptive icon present" test -f "${MOBILE}/assets/adaptive-icon.png"
check "Preview profile uses staging API" grep -q 'voxa-api-staging.madfam.io' "${MOBILE}/eas.json"
check "Production profile uses prod API" grep -q 'voxa-api.madfam.io' "${MOBILE}/eas.json"
check "Deep link scheme voxa://" grep -q '"scheme": "voxa"' "${MOBILE}/app.json"

echo "---"
if [[ "${fail}" -eq 0 ]]; then
  echo "EAS config verification passed${warn:+ (with warnings)}"
  exit 0
fi

echo "EAS config verification FAILED"
exit 1
