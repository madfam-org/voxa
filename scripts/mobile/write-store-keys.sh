#!/usr/bin/env bash
# Write the store submission keys from CI secrets to private files under
# RUNNER_TEMP and export their paths for eas.json ("$ASC_API_KEY_PATH",
# "$GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH"). Values are never printed.
# A missing secret leaves its path unset; scripts/mobile/eas-submit-env.mjs
# then names it and fails.
#
# Inputs (environment): ASC_API_KEY_P8, GOOGLE_PLAY_SERVICE_ACCOUNT_JSON,
# RUNNER_TEMP, GITHUB_ENV.

set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is not set (run inside GitHub Actions)}"
: "${GITHUB_ENV:?GITHUB_ENV is not set (run inside GitHub Actions)}"

umask 077

if [[ -n "${ASC_API_KEY_P8:-}" ]]; then
  printf '%s\n' "${ASC_API_KEY_P8}" > "${RUNNER_TEMP}/asc-api-key.p8"
  echo "ASC_API_KEY_PATH=${RUNNER_TEMP}/asc-api-key.p8" >> "${GITHUB_ENV}"
  echo "OK   App Store Connect API key written"
else
  echo "WARN ASC_API_KEY_P8 secret is not set"
fi

if [[ -n "${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:-}" ]]; then
  printf '%s\n' "${GOOGLE_PLAY_SERVICE_ACCOUNT_JSON}" > "${RUNNER_TEMP}/google-play-service-account.json"
  echo "GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH=${RUNNER_TEMP}/google-play-service-account.json" >> "${GITHUB_ENV}"
  echo "OK   Google Play service account key written"
else
  echo "WARN GOOGLE_PLAY_SERVICE_ACCOUNT_JSON secret is not set"
fi
