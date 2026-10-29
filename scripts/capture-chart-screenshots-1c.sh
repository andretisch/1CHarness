#!/usr/bin/env bash
# Скриншоты графиков в окне 1С (чат 1СХарнесс). Нужны DISPLAY (:1), xdotool, imagemagick.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/images"
export DISPLAY="${DISPLAY:-:1}"
export LANG=C.UTF-8

mkdir -p "$OUT"

find_harness_window() {
  xdotool search --name '1С:Предприятие' 2>/dev/null | head -1 \
    || xdotool search --class 'v8c' 2>/dev/null | head -1 \
    || xdotool search --name '1СХарнесс' 2>/dev/null | head -1
}

shot_window() {
  local out="$1"
  local wid
  wid="$(find_harness_window)"
  if [[ -z "$wid" ]]; then
    echo "1C window not found on $DISPLAY" >&2
    return 1
  fi
  xdotool windowactivate --sync "$wid"
  sleep 0.8
  import -window "$wid" -quality 95 "$out"
  echo "Saved $out (window $wid)"
}

pkill -f '1cv8t ENTERPRISE /F/workspace/bases/unf-karkas' 2>/dev/null || true
sleep 2
/opt/1cv8t/x86_64/8.3.27.2342/1cv8t ENTERPRISE \
  /F"$ROOT/bases/unf-karkas" /N"Администратор" \
  /Execute"$ROOT/epf/1CHarness.epf" \
  /Lru /WA- /DisableStartupDialogs /DisableStartupMessages &
sleep 18

wid="$(find_harness_window || true)"
if [[ -z "$wid" ]]; then
  echo "Harness window missing" >&2
  exit 1
fi
xdotool windowactivate --sync "$wid"
sleep 2

# Открыть демо-диалог из workspace/sessions/readme-charts-demo.json
xdotool search --name '1СХарнесс' windowactivate --sync 2>/dev/null || true
sleep 1
# Клик по сессии «Обороты по счёту 51» в списке слева
xdotool mousemove --window "$wid" 120 220 click 1
sleep 2
# Прокрутка чата к графикам
xdotool key --window "$wid" End
sleep 2
xdotool click --repeat 5 4  # wheel down if needed
sleep 1

shot_window "$OUT/charts-grid-light.png"
shot_window "$OUT/chat-charts-demo.png"

# Тёмная тема: шестерёнка → интерфейс → тёмная (приблизительные координаты)
xdotool mousemove --window "$wid" 48 48 click 1
sleep 1
xdotool key Tab Tab Tab Return
sleep 1.5
xdotool mousemove --window "$wid" 700 400 click 1
sleep 2
shot_window "$OUT/charts-grid-dark.png"

echo "Done."
