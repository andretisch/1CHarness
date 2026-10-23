#!/usr/bin/env bash
# Выгрузка epf/1CHarness.epf в src/1CHarness/ (иерархический XML).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V8="${V8_PATH:-/opt/1cv8t/x86_64/8.3.27.2342/1cv8t}"
IB="${INFOBASE_PATH:-/workspace/bases/harness-empty}"
EPF="$ROOT/epf/1CHarness.epf"
OUT="$ROOT/src/1CHarness"
SKILL="$ROOT/.cursor/cc-1c-skills-reference/epf-dump/scripts/epf-dump.py"

if [[ ! -f "$EPF" ]]; then
  echo "EPF not found: $EPF" >&2
  exit 1
fi

if pgrep -f "$IB" >/dev/null 2>&1 || pgrep -f '1CHarness\.epf' >/dev/null 2>&1; then
  echo "Close 1C sessions using the infobase or EPF, then retry (configurator lock)." >&2
  exit 1
fi

export DISPLAY="${DISPLAY:-:1}"

if [[ -f "$SKILL" ]]; then
  exec python3 "$SKILL" \
    -V8Path "$V8" \
    -InfoBasePath "$IB" \
    -InputFile "$EPF" \
    -OutputDir "$OUT" \
    "$@"
fi

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

"$V8" DESIGNER /F "$IB" /DisableStartupDialogs /DisableStartupMessages \
  /DumpExternalDataProcessorOrReportToFiles "$OUT" "$EPF" -Format Hierarchical \
  /Out "$LOG"

if grep -qi 'Export completed' "$LOG"; then
  echo "Dumped to: $OUT"
  exit 0
fi

cat "$LOG" >&2
exit 1
