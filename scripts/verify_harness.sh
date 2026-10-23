#!/usr/bin/env bash
# Быстрая проверка после правок (агент, workspace, LLM при наличии ключа).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== workspace/config.json =="
python3 - <<'PY'
import json
from pathlib import Path
p = Path("workspace/config.json")
data = json.loads(p.read_text(encoding="utf-8"))
assert "connection" in data and "apiBase" in data["connection"]
print("OK", data["connection"].get("apiBase"), data["connection"].get("model"))
PY

echo "== Python stub 1С (read_file config + agents/default.md) =="
for path in config.json agents/default.md; do
  echo "{\"type\":\"tool.invoke\",\"id\":\"v1\",\"tool\":\"read_file\",\"arguments\":{\"path\":\"$path\"}}" \
    | python3 -c "import sys,json; from tools.python.stub_1c.executor import handle_bridge_message; r=handle_bridge_message(json.load(sys.stdin)); assert r.get('ok'), r; print('  ', sys.argv[1] if False else '$path', 'bytes', len(r['result']['content']))"
done

echo "== test_harness_agent.sh =="
bash scripts/test_harness_agent.sh

echo "== verify_harness: all checks passed =="
