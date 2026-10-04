#!/usr/bin/env bash
# Validate Expo/EAS mobile packaging before preview or store builds.
#
# Store and EAS identifiers are never committed. apps/mobile/app.config.js reads
# the EAS project id from EAS_PROJECT_ID and refuses to resolve without it when
# VOXA_REQUIRE_EAS_PROJECT=1 (the mobile workflows) or on an EAS Build worker.
# This script asserts that behaviour with a throwaway, all-zero UUID.
#
# Usage:
#   ./scripts/mobile/verify-eas-config.sh
#   REQUIRE_LINKED=1 ./scripts/mobile/verify-eas-config.sh   # EAS_PROJECT_ID must be set

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOBILE="${ROOT}/apps/mobile"
REQUIRE_LINKED="${REQUIRE_LINKED:-0}"
SAMPLE_PROJECT_ID="00000000-0000-0000-0000-000000000000"

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

# Evaluate app.config.js in a clean environment (only PATH/HOME plus the given
# variables) and print one field, or THROW:<message> when the config throws.
resolve_config() {
  local field="$1"
  shift
  env -i PATH="${PATH}" HOME="${HOME}" "$@" node -e '
    const field = process.argv[1];
    try {
      const config = require(process.argv[2])();
      const value = field.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), config);
      process.stdout.write(value === undefined ? "<unset>" : String(value));
    } catch (error) {
      process.stdout.write(`THROW:${error.message}`);
    }
  ' "${field}" "${MOBILE}/app.config.js"
}

no_placeholders() {
  ! grep -q 'REPLACE_WITH' "${MOBILE}/app.json" "${MOBILE}/eas.json" "${MOBILE}/app.config.js"
}

no_committed_project_id() {
  [[ "$(node -p "JSON.stringify(require('${MOBILE}/app.json').expo.extra.eas ?? null)")" == "null" ]]
}

config_resolves_without_project() {
  [[ "$(resolve_config extra.eas.projectId)" == "<unset>" ]]
}

config_requires_project_in_ci() {
  [[ "$(resolve_config extra.eas.projectId VOXA_REQUIRE_EAS_PROJECT=1)" == THROW:EAS_PROJECT_ID\ is\ not\ set* ]]
}

config_requires_project_on_eas_worker() {
  [[ "$(resolve_config extra.eas.projectId EAS_BUILD=true)" == THROW:EAS_PROJECT_ID\ is\ not\ set* ]]
}

config_reads_project_from_env() {
  [[ "$(resolve_config extra.eas.projectId VOXA_REQUIRE_EAS_PROJECT=1 EAS_PROJECT_ID="${SAMPLE_PROJECT_ID}")" == "${SAMPLE_PROJECT_ID}" ]]
}

config_reads_project_on_eas_worker() {
  [[ "$(resolve_config extra.eas.projectId EAS_BUILD=true EAS_BUILD_PROJECT_ID="${SAMPLE_PROJECT_ID}")" == "${SAMPLE_PROJECT_ID}" ]]
}

config_rejects_malformed_project() {
  [[ "$(resolve_config extra.eas.projectId EAS_PROJECT_ID=not-a-uuid)" == THROW:EAS_PROJECT_ID\ must\ be* ]]
}

submit_reads_keys_from_env() {
  node -e '
    const submit = require(process.argv[1]).submit;
    const ios = submit.preview.ios;
    const android = submit.preview.android;
    const ok =
      ios.ascApiKeyPath === "$ASC_API_KEY_PATH" &&
      ios.ascApiKeyId === "$ASC_API_KEY_ID" &&
      ios.ascApiKeyIssuerId === "$ASC_API_KEY_ISSUER_ID" &&
      ios.ascAppId === undefined && ios.appleId === undefined && ios.appleTeamId === undefined &&
      android.serviceAccountKeyPath === "$GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH" &&
      submit.production.extends === "preview";
    process.exit(ok ? 0 : 1);
  ' "${MOBILE}/eas.json"
}

check "No REPLACE_WITH placeholders in app.json, eas.json or app.config.js" no_placeholders
check "No EAS project id committed in app.json" no_committed_project_id
check "Config resolves without EAS_PROJECT_ID for local use" config_resolves_without_project
check "Config throws without EAS_PROJECT_ID when VOXA_REQUIRE_EAS_PROJECT=1" config_requires_project_in_ci
check "Config throws without a project id on an EAS Build worker" config_requires_project_on_eas_worker
check "Config reads extra.eas.projectId from EAS_PROJECT_ID" config_reads_project_from_env
check "Config reads EAS_BUILD_PROJECT_ID on an EAS Build worker" config_reads_project_on_eas_worker
check "Config rejects a malformed EAS_PROJECT_ID" config_rejects_malformed_project
check "Submit profiles read store keys from the environment" submit_reads_keys_from_env

if [[ -n "${EAS_PROJECT_ID:-}" ]]; then
  check "EAS_PROJECT_ID resolves in app.config.js" \
    test "$(resolve_config extra.eas.projectId VOXA_REQUIRE_EAS_PROJECT=1 EAS_PROJECT_ID="${EAS_PROJECT_ID}")" == "${EAS_PROJECT_ID}"
elif [[ "${REQUIRE_LINKED}" == "1" ]]; then
  check "EAS project linked (EAS_PROJECT_ID set)" false
else
  warn_if "EAS project linked (set EAS_PROJECT_ID; see docs/launch/MOBILE_GA.md)" false
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
  if [[ "${warn}" -eq 1 ]]; then
    echo "EAS config verification passed (with warnings)"
  else
    echo "EAS config verification passed"
  fi
  exit 0
fi

echo "EAS config verification FAILED"
exit 1
