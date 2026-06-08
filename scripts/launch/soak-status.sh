#!/usr/bin/env bash
# GA soak operator summary — progress, missing days, declaration checklist.
#
# Usage:
#   ./scripts/launch/soak-status.sh
#   ./scripts/launch/soak-status.sh --required 7 --start 2026-06-08

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_FILE="${VOXA_SOAK_LOG:-docs/launch/SOAK_LOG.md}"
REQUIRED=7
START_DATE="2026-06-08"
DECLARE_DATE="2026-06-15"

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
    --declare)
      DECLARE_DATE="${2:?--declare needs YYYY-MM-DD}"
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

echo "== GA soak status =="
echo "Log: ${LOG_FILE}"
echo "Window: ${REQUIRED} consecutive pass days from ${START_DATE}"
echo "Declaration target: ${DECLARE_DATE}"
echo ""

"${ROOT}/scripts/launch/soak-window-progress.sh" --required "${REQUIRED}" --start "${START_DATE}" --log "${LOG_FILE}" || true

echo ""
echo "== Missing pass days =="
python3 - "${LOG_FILE}" "${START_DATE}" "${REQUIRED}" <<'PY'
import sys
from datetime import date, timedelta

log_path, start, required = sys.argv[1], sys.argv[2], int(sys.argv[3])
try:
    text = open(log_path, encoding="utf-8").read()
except OSError:
    print("(no soak log yet)")
    raise SystemExit(0)

def has_pass(day: str) -> bool:
    for line in text.splitlines():
        if f"| {day} |" in line and "| pass |" in line:
            return True
    return False

day = date.fromisoformat(start)
missing = []
for i in range(required):
    label = day.isoformat()
    if has_pass(label):
        print(f"OK   {label}")
    else:
        print(f"MISS {label}")
        missing.append(label)
    day += timedelta(days=1)

if missing:
    print("")
    print(f"Next action: ensure CI e2e-smoke cron passes on {missing[0]} (UTC)")
else:
    print("")
    print("All window days logged — ready for verify-declaration-day.sh")
PY

echo ""
echo "== Quick commands =="
echo "  ./scripts/launch/soak-daily-check.sh --log ${LOG_FILE}"
echo "  ./scripts/launch/verify-declaration-day.sh --required ${REQUIRED} --start ${START_DATE}"
