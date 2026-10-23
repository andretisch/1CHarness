#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${OLLAMA_API_KEY:-}" ]]; then
  echo "OLLAMA_API_KEY not set" >&2
  exit 1
fi

echo "== Python stub (эталон 1С, CLI) read_file =="
echo '{"type":"tool.invoke","id":"t1","tool":"read_file","arguments":{"path":"data/sample.txt"}}' \
  | python3 -c "import sys; from tools.python.stub_1c.executor import handle_bridge_message; import json; print(json.dumps(handle_bridge_message(json.load(sys.stdin)), ensure_ascii=False))" \
  | head -c 400
echo

echo "== ollama proxy =="
curl -sS http://127.0.0.1:8768/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gemma4:31b-cloud","messages":[{"role":"user","content":"Say OK"}],"max_tokens":5,"stream":false}' | head -c 200
echo

echo "OK (мост в UI — только DOM + JS stub, без :8769)"
