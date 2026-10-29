#!/usr/bin/env bash
# Сборка epf/1CHarness.epf из src/CHarness1C.xml (нужен DISPLAY, например :1).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V8="${V8_BIN:-/opt/1cv8t/x86_64/8.3.27.2342/1cv8t}"
BASE="${HARNESS_BUILD_BASE:-$ROOT/bases/unf-karkas}"
OUT="$ROOT/epf/1CHarness.epf"
SRC="$ROOT/src/CHarness1C.xml"
LOG="${TMPDIR:-/tmp}/1charness-epf-build.log"
export DISPLAY="${DISPLAY:-:1}"
"$V8" DESIGNER /F "$BASE" /N"Администратор" /DisableStartupDialogs \
  /LoadExternalDataProcessorOrReportFromFiles "$SRC" "$OUT" /Out "$LOG"
echo "OK: $OUT (see $LOG)"
