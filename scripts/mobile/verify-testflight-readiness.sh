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
check "Preview uses internal distribution" grep -A20 '"preview"' "${MOBILE}/eas.json" | grep -q '"distribution": "internal"'

if grep -q 'REPLACE_WITH' "${MOBILE}/eas.json"; then
  if [[ "${REQUIRE_SUBMIT}" == "1" ]]; then
    check "Submit credentials (no REPLACE_WITH placeholders)" false
  else
    warn_if "Submit credentials configured (replace REPLACE_WITH in eas.json)" false
  fi
else
  check "Submit credentials (no REPLACE_WITH placeholders)" true
fi

warn_if "Google Play service account JSON present" test -f "${MOBILE}/secrets/google-play-service-account.json"

echo "---"
if [[ "${fail}" -eq 0 ]]; then
  echo "TestFlight readiness check passed${warn:+ (with warnings)}"
  echo "Manual: cd apps/mobile && eas build --profile preview --platform ios"
  exit 0
fi

echo "TestFlight readiness check FAILED"
exit 1
