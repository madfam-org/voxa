#!/usr/bin/env bash
# Verify the staging soak log has enough consecutive green calendar days.
#
# Usage:
#   ./scripts/launch/verify-soak-window.sh
#   ./scripts/launch/verify-soak-window.sh --required 7 --start 2026-06-12
#
# Exit 0 when the log contains `required` consecutive pass days starting at `start`.

set -euo pipefail

LOG_FILE="${VOXA_SOAK_LOG:-docs/launch/SOAK_LOG.md}"
REQUIRED=7
START_DATE="2026-06-12"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --required)
      REQUIRED="${2:?--required needs a number}"
      shift 2
      ;;
    --start)
      START_DATE="${2:?--start needs YYYY-MM-DD}"
      shift 2
      ;;
    --log)
      LOG_FILE="${2:?--log needs a path}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ ! -f "${LOG_FILE}" ]]; then
  echo "FAIL missing soak log: ${LOG_FILE}" >&2
  exit 1
fi

pass_for_day() {
  local day="$1"
  grep -E "\\| ${day} \\|" "${LOG_FILE}" | grep -q '| pass |'
}

next_day() {
  python3 -c "from datetime import date, timedelta; print((date.fromisoformat('${1}') + timedelta(days=1)).isoformat())"
}

check_date="${START_DATE}"
for ((i = 0; i < REQUIRED; i++)); do
  if pass_for_day "${check_date}"; then
    echo "OK   ${check_date} (day $((i + 1))/${REQUIRED})"
  else
    echo "FAIL missing green soak log for ${check_date} (need ${REQUIRED} days from ${START_DATE})" >&2
    exit 1
  fi
  if [[ "${i}" -lt $((REQUIRED - 1)) ]]; then
    check_date="$(next_day "${check_date}")"
  fi
done

echo "---"
echo "Soak window complete: ${REQUIRED} consecutive days from ${START_DATE}"
