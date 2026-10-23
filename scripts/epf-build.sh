#!/usr/bin/env bash
# Сборка epf/1CHarness.epf из XML (src/1CHarness/) через Конфигуратор в пакетном режиме.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V8="${V8_PATH:-/opt/1cv8t/x86_64/8.3.27.2342/1cv8t}"
IB="${INFOBASE_PATH:-/workspace/bases/harness-empty}"
SRC="$ROOT/src/1CHarness/CHarness1C.xml"
OUT="$ROOT/epf/1CHarness.epf"
SKILL_DUMP="$ROOT/.cursor/cc-1c-skills-reference/epf-build/scripts/epf-build.py"

if [[ ! -x "$V8" && ! -f "$V8" ]]; then
  echo "1C executable not found: $V8 (set V8_PATH)" >&2
  exit 1
fi

if pgrep -f "$IB" >/dev/null 2>&1 || pgrep -f '1CHarness\.epf' >/dev/null 2>&1; then
  echo "Close 1C sessions using the infobase or EPF, then retry (configurator lock)." >&2
  exit 1
fi

export DISPLAY="${DISPLAY:-:1}"

if [[ -f "$SKILL_DUMP" ]]; then
  exec python3 "$SKILL_DUMP" \
    -V8Path "$V8" \
    -InfoBasePath "$IB" \
    -SourceFile "$SRC" \
    -OutputFile "$OUT" \
    "$@"
fi

LOG="$(mktemp)"
trap 'rm -f "$LOG"' EXIT

"$V8" DESIGNER /F "$IB" /DisableStartupDialogs /DisableStartupMessages \
  /LoadExternalDataProcessorOrReportFromFiles "$SRC" "$OUT" \
  /Out "$LOG"

if grep -qi 'Import completed' "$LOG"; then
  echo "Built: $OUT"
  exit 0
fi

cat "$LOG" >&2
exit 1
