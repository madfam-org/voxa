#!/usr/bin/env bash
# Verify that Auth.js builds its URLs on a public web host (anonymous GETs only).
#
# One web deployment serves the landing host and the app host. Behind the
# tunnel the Next standalone server hands route handlers a request URL on its
# bind address (0.0.0.0:3000); if Auth.js ever builds its URLs from that again,
# every sign-in comes back to https://0.0.0.0:3000/auth/signin?error=... For
# each host given, this checks:
#
#   1. GET https://<host>/api/auth/providers -> 200, and janua.callbackUrl is
#      https://<allowed>/api/auth/callback/janua
#   2. GET https://<host>/api/auth/callback/janua?code=probe&state=probe
#      (anonymous, not followed) -> 302/303 whose Location is on
#      https://<allowed>/
#   3. neither body nor Location mentions 0.0.0.0
#
# <allowed> is any host given on the command line (or in
# VOXA_AUTH_ALLOWED_HOSTS, comma-separated); that loose mode passed while
# voxa#50 pinned AUTH_URL to the landing host. With VERIFY_SAME_HOST=1,
# <allowed> must be the host that was asked: sign-in stays on each host. The
# manifests set no AUTH_URL since voxa#52, so the web deploy workflows and the
# CI axe job run it strict; scripts/launch/deploy-contract.test.mjs keeps their
# host lists equal to each manifest's AUTH_PUBLIC_HOSTS.
#
# No cookie, no session, no sign-in: the callback probe carries no state
# cookie, so Auth.js answers with its error redirect, which is what is checked.
# Retries while a rollout replaces pods.
#
# Usage:
#   ./scripts/launch/verify-auth-public-origin.sh voxa.madfam.io voxa-app.madfam.io
#   VERIFY_SAME_HOST=1 ./scripts/launch/verify-auth-public-origin.sh voxa.madfam.io voxa-app.madfam.io
#   # Against a local server (CI): connect there and send the host as the tunnel does
#   VOXA_AUTH_CONNECT_URL=http://127.0.0.1:3000 ./scripts/launch/verify-auth-public-origin.sh voxa-app.madfam.io

set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "usage: verify-auth-public-origin.sh <host> [<host>...]" >&2
  exit 2
fi

CONNECT="${VOXA_AUTH_CONNECT_URL:-}"
ATTEMPTS="${VOXA_AUTH_VERIFY_ATTEMPTS:-6}"
SLEEP_SEC="${VOXA_AUTH_VERIFY_SLEEP_SEC:-20}"
SAME_HOST="${VERIFY_SAME_HOST:-0}"
if [ -n "${VOXA_AUTH_ALLOWED_HOSTS:-}" ]; then
  IFS=',' read -r -a ALLOWED <<<"${VOXA_AUTH_ALLOWED_HOSTS// /}"
else
  ALLOWED=("$@")
fi

body="$(mktemp)"
headers="$(mktemp)"
trap 'rm -f "${body}" "${headers}"' EXIT

# GET <host> <path>: writes ${body} and ${headers}, prints the status code.
fetch() {
  local host="$1" path="$2"
  if [ -n "${CONNECT}" ]; then
    curl -sS -o "${body}" -D "${headers}" -w '%{http_code}' --max-time 15 \
      -H "Host: ${host}" -H "X-Forwarded-Host: ${host}" -H "X-Forwarded-Proto: https" \
      "${CONNECT}${path}" 2>/dev/null || true
  else
    curl -sS -o "${body}" -D "${headers}" -w '%{http_code}' --max-time 15 \
      -H 'Accept: application/json' "https://${host}${path}" 2>/dev/null || true
  fi
}

location() {
  tr -d '\r' <"${headers}" | awk 'tolower($1) == "location:" { print $2 }' | tail -n 1
}

# The host of an https URL, or empty.
https_host() {
  case "$1" in
    https://*)
      local rest="${1#https://}"
      printf '%s' "${rest%%/*}"
      ;;
  esac
}

# Whether <found> is acceptable for a check that asked <asked>.
acceptable_host() {
  local asked="$1" found="$2" allowed
  [ -n "${found}" ] || return 1
  if [ "${SAME_HOST}" = "1" ]; then
    [ "${found}" = "${asked}" ]
    return
  fi
  for allowed in "${ALLOWED[@]}"; do
    [ "${found}" = "${allowed}" ] && return 0
  done
  return 1
}

expectation() {
  if [ "${SAME_HOST}" = "1" ]; then
    printf 'https://%s/ (VERIFY_SAME_HOST=1)' "$1"
  else
    printf 'one of: %s' "${ALLOWED[*]}"
  fi
}

# One full check of one host; prints the reason and returns 1 on failure.
check_host() {
  local host="$1" code callback cb_host loc loc_host

  code="$(fetch "${host}" /api/auth/providers)"
  if [ "${code}" != "200" ]; then
    echo "${host}: /api/auth/providers -> HTTP ${code}, expected 200"
    return 1
  fi
  if grep -q '0\.0\.0\.0' "${body}"; then
    echo "${host}: /api/auth/providers names 0.0.0.0 (bind address leaked into Auth.js URLs)"
    return 1
  fi
  callback="$(jq -r '.janua.callbackUrl // "none"' "${body}" 2>/dev/null || echo unreadable)"
  cb_host="$(https_host "${callback}")"
  if ! acceptable_host "${host}" "${cb_host}" || [ "${callback}" != "https://${cb_host}/api/auth/callback/janua" ]; then
    echo "${host}: callbackUrl=${callback}, expected https://<host>/api/auth/callback/janua on $(expectation "${host}")"
    return 1
  fi

  code="$(fetch "${host}" '/api/auth/callback/janua?code=probe&state=probe')"
  loc="$(location)"
  if [ "${code}" != "302" ] && [ "${code}" != "303" ]; then
    echo "${host}: anonymous callback probe -> HTTP ${code}, expected a 302/303 error redirect"
    return 1
  fi
  case "${loc}" in
    *0.0.0.0*)
      echo "${host}: callback probe Location=${loc} (bind address)"
      return 1
      ;;
  esac
  loc_host="$(https_host "${loc}")"
  if ! acceptable_host "${host}" "${loc_host}"; then
    echo "${host}: callback probe Location=${loc:-none}, expected https://<host>/... on $(expectation "${host}")"
    return 1
  fi

  echo "OK   ${host}: callbackUrl=${callback}; callback probe -> ${code} ${loc}"
  return 0
}

failed=0
for host in "$@"; do
  echo "== Auth.js public origin on ${host}${CONNECT:+ (via ${CONNECT})}$([ "${SAME_HOST}" = "1" ] && echo ' (same host)') =="
  for i in $(seq 1 "${ATTEMPTS}"); do
    if reason="$(check_host "${host}")"; then
      echo "${reason}"
      continue 2
    fi
    echo "[${i}/${ATTEMPTS}] ${reason}"
    if [ "${i}" -lt "${ATTEMPTS}" ]; then
      sleep "${SLEEP_SEC}"
    fi
  done
  echo "::error title=Sign-in leaves ${host}::${reason}. Auth.js is not building its URLs on a public host: sign-in on ${host} fails on the way back from Janua. Check AUTH_PUBLIC_HOSTS in the web manifest (src/lib/public-origin.ts, docs/auth/JANUA.md)." >&2
  failed=1
done
exit "${failed}"
