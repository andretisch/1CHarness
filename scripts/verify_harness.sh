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

echo "== Python stub 1С (fs_read, calc, run_query) =="
python3 - << 'PY'
import json
from tools.python.stub_1c.executor import handle_bridge_message

def call(tool, arguments):
    return handle_bridge_message({"type": "tool.invoke", "id": "v", "tool": tool, "arguments": arguments})

sample = call("fs_read", {"path": "data/sample.txt"})
assert sample["ok"] and "read_file" in sample["result"]["content"] or "Демо" in sample["result"]["content"]
calc = call("calc", {"expression": "1e9+1"})
assert calc["ok"] and calc["result"]["value"] == 1_000_000_001
listed = call("fs_list", {"path": "skills"})
assert listed["ok"] and any(e["name"] == "query.md" for e in listed["result"]["entries"])
denied = call("run_query", {"query": "ВЫБРАТЬ 1"})
assert denied["ok"] is False and "сеансе 1С" in denied["error"]
print("OK fs_read, calc, fs_list, run_query")
PY

echo "== test_harness_agent.sh =="
bash scripts/test_harness_agent.sh

echo "== verify_harness: all checks passed =="
