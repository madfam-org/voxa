#!/usr/bin/env bash
# Report staging soak window progress (consecutive green days).
#
# Usage:
#   ./scripts/launch/soak-window-progress.sh
#   ./scripts/launch/soak-window-progress.sh --required 7 --start 2026-06-08

set -euo pipefail

LOG_FILE="${VOXA_SOAK_LOG:-docs/launch/SOAK_LOG.md}"
REQUIRED=7
START_DATE="2026-06-08"

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
  echo "Soak progress: 0/${REQUIRED} (missing log)"
  exit 1
fi

pass_for_day() {
  local day="$1"
  grep -E "\\| ${day} \\|" "${LOG_FILE}" | grep -q '| pass |'
}

next_day() {
  python3 -c "from datetime import date, timedelta; print((date.fromisoformat('${1}') + timedelta(days=1)).isoformat())"
}

count=0
check_date="${START_DATE}"
for ((i = 0; i < REQUIRED; i++)); do
  if pass_for_day "${check_date}"; then
    count=$((count + 1))
    check_date="$(next_day "${check_date}")"
  else
    break
  fi
done

echo "Soak progress: ${count}/${REQUIRED} consecutive days from ${START_DATE}"
if [[ "${count}" -ge "${REQUIRED}" ]]; then
  echo "Status: READY for GA declaration"
  exit 0
fi

missing_date="${check_date}"
echo "Next missing pass day: ${missing_date}"
echo "Status: IN_PROGRESS (need ${REQUIRED} consecutive pass days)"
exit 1
