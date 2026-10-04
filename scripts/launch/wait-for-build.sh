#!/usr/bin/env bash
# Wait until a health endpoint serves the expected build, then exit 0.
#
# HTTP 200 alone proves nothing after a deploy: the previous pods answer it
# too. The images carry the commit they were built from (Dockerfile build arg
# GIT_SHA) and the health endpoints serve it as `build`, so this proves the new
# image is the one answering. Argo CD polls git about every 3 minutes and the
# surge rollout takes a few more, so the default wait is 12 minutes.
#
# Usage:
#   ./scripts/launch/wait-for-build.sh <health-url> <expected-sha>
#   VOXA_BUILD_WAIT_SEC=720 VOXA_BUILD_POLL_SEC=25 ./scripts/launch/wait-for-build.sh ...

set -euo pipefail

URL="${1:?usage: wait-for-build.sh <health-url> <expected-sha>}"
EXPECTED="${2:?usage: wait-for-build.sh <health-url> <expected-sha>}"
WAIT_SEC="${VOXA_BUILD_WAIT_SEC:-720}"
POLL_SEC="${VOXA_BUILD_POLL_SEC:-25}"

body="$(mktemp)"
trap 'rm -f "${body}"' EXIT

echo "== Waiting up to ${WAIT_SEC}s for ${URL} to serve build ${EXPECTED} =="
start="$(date +%s)"
deadline=$((start + WAIT_SEC))
code=000
observed=none
attempt=0
while :; do
  attempt=$((attempt + 1))
  code="$(curl -sS -o "${body}" -w '%{http_code}' --max-time 10 "${URL}" 2>/dev/null || true)"
  observed="$(jq -r '.build // "none"' "${body}" 2>/dev/null || echo none)"
  echo "[${attempt}] +$(( $(date +%s) - start ))s HTTP ${code} build=${observed}"
  if [ "${code}" = "200" ] && [ "${observed}" = "${EXPECTED}" ]; then
    echo "OK   ${URL} serves build ${EXPECTED}"
    exit 0
  fi
  if [ "$(date +%s)" -ge "${deadline}" ]; then
    break
  fi
  sleep "${POLL_SEC}"
done

echo "::error title=New build not serving::${URL} did not serve build ${EXPECTED} within ${WAIT_SEC}s: last answer HTTP ${code}, build=${observed}. The image was pushed, signed and pinned, but the host still serves another build (Argo CD sync or rollout did not land)." >&2
exit 1
