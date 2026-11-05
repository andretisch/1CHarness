#!/usr/bin/env bash
# После git pull: синхронизация макета HTML и пересборка epf/1CHarness.epf (если есть 1С).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 1CHarness: обновление после pull =="
git pull origin main

python3 << PY
from pathlib import Path
root = Path("$ROOT")
index = root / "index.html"
template = root / "src/CHarness1C/Templates/Страница/Ext/Template.txt"
src = index.read_bytes()
bom = b"\xef\xbb\xbf"
body = src[3:] if src.startswith(bom) else src
template.write_bytes(bom + body)
print("Template synced from index.html")
PY

if compgen -G '/opt/1cv8t/x86_64/*/1cv8t' > /dev/null; then
  echo "Rebuilding 1CHarness.epf..."
  if bash "$ROOT/scripts/build-epf.sh"; then
    echo "EPF rebuilt: $ROOT/epf/1CHarness.epf"
  else
    echo "WARN: EPF build failed (see /tmp/1charness-epf-build.log). Use epf/1CHarness.epf from git — it matches main after pull."
  fi
else
  echo "1C platform not found — skip EPF build; use epf/1CHarness.epf from git."
fi

cat << 'NOTE'

Готово в репозитории. В 1С на вашей машине:
  1. Закройте форму обработки (лучше выйти из сеанса с открытым 1СХарнесс).
  2. Откройте заново epf/1CHarness.epf из этого каталога (не старую копию).
  3. Ключ LLM: Настройки → API Key или workspace/llm-api-key.local (одна строка).
  4. Рабочая область агента должна указывать на .../workspace этого репо
     (на VM агента путь в коде: /workspace/workspace).

NOTE
