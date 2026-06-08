#!/usr/bin/env bash
# Link the Voxa mobile app to Expo/EAS and prepare CI TestFlight builds.
#
# Usage:
#   ./scripts/mobile/bootstrap-eas.sh
#   ./scripts/mobile/bootstrap-eas.sh --check-only
#
# Prerequisites: Expo org access, Apple Developer (for TestFlight), optional gh CLI.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="${ROOT}/apps/mobile"
CHECK_ONLY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check-only)
      CHECK_ONLY=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

echo "== Voxa mobile EAS bootstrap =="
echo ""

"${ROOT}/scripts/mobile/verify-eas-config.sh" || true
echo ""

project_id="$(node -p "require('${MOBILE}/app.json').expo.extra.eas.projectId")"
if [[ "${project_id}" == REPLACE_WITH* ]]; then
  echo "EAS project is not linked yet."
  if [[ "${CHECK_ONLY}" -eq 1 ]]; then
    echo "Run without --check-only after eas init."
    exit 1
  fi
  echo ""
  echo "Next steps (one-time, interactive):"
  echo "  cd apps/mobile"
  echo "  npx eas-cli login"
  echo "  npx eas-cli init --id   # or accept generated projectId"
  echo ""
  echo "eas init writes extra.eas.projectId into app.json — commit that change."
else
  echo "OK   EAS projectId=${project_id}"
fi

echo ""
echo "== CI preview builds (TestFlight / Play internal) =="
echo "1. Create Expo access token: https://expo.dev/settings/access-tokens"
echo "2. Store in GitHub:"
echo "     gh secret set EXPO_TOKEN --repo madfam-org/voxa"
echo "3. Trigger workflow: Actions → Mobile EAS Preview → Run workflow"
echo ""
echo "Optional after App Store Connect + Play credentials are in eas.json:"
echo "  gh variable set EAS_AUTO_SUBMIT --body true --repo madfam-org/voxa"
echo ""
echo "Verify readiness:"
echo "  REQUIRE_LINKED=1 ./scripts/mobile/verify-testflight-readiness.sh"

if [[ "${CHECK_ONLY}" -eq 1 ]]; then
  REQUIRE_LINKED=1 "${ROOT}/scripts/mobile/verify-testflight-readiness.sh" || true
fi
