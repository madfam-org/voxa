#!/usr/bin/env bash
# Validate mobile packaging is ready for TestFlight / Play internal preview builds.
#
# Usage:
#   ./scripts/mobile/verify-testflight-readiness.sh
#   REQUIRE_LINKED=1 ./scripts/mobile/verify-testflight-readiness.sh
#   REQUIRE_SUBMIT=1 ./scripts/mobile/verify-testflight-readiness.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="${ROOT}/apps/mobile"
REQUIRE_LINKED="${REQUIRE_LINKED:-0}"
REQUIRE_SUBMIT="${REQUIRE_SUBMIT:-0}"

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

echo "== TestFlight / Play internal readiness =="

REQUIRE_LINKED="${REQUIRE_LINKED}" "${ROOT}/scripts/mobile/verify-eas-config.sh"
echo ""

check "Preview profile configured" grep -q '"preview"' "${MOBILE}/eas.json"
preview_is_internal() {
  [[ "$(node -p "require('${MOBILE}/eas.json').build.preview.distribution")" == "internal" ]]
}
check "Preview uses internal distribution" preview_is_internal

# Store submission ids and keys come from the environment (see
# scripts/mobile/eas-submit-env.mjs); nothing is committed to eas.json.
if [[ "${REQUIRE_SUBMIT}" == "1" ]]; then
  check "Store submission settings present" node "${ROOT}/scripts/mobile/eas-submit-env.mjs" --check --platform all
else
  warn_if "Store submission settings present (ASC_* and GOOGLE_PLAY_* variables)" \
    node "${ROOT}/scripts/mobile/eas-submit-env.mjs" --check --platform all
fi

echo "---"
if [[ "${fail}" -eq 0 ]]; then
  if [[ "${warn}" -eq 1 ]]; then
    echo "TestFlight readiness check passed (with warnings)"
  else
    echo "TestFlight readiness check passed"
  fi
  echo "Manual: cd apps/mobile && eas build --profile preview --platform ios"
  exit 0
fi

echo "TestFlight readiness check FAILED"
exit 1
