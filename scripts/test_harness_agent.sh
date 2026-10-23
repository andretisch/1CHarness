#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== Python stub (эталон 1С) read_file =="
echo '{"type":"tool.invoke","id":"t1","tool":"read_file","arguments":{"path":"data/sample.txt"}}' \
  | python3 -c "import sys,json; from tools.python.stub_1c.executor import handle_bridge_message; print(json.dumps(handle_bridge_message(json.load(sys.stdin)), ensure_ascii=False))" \
  | head -c 400
echo

if [[ -n "${OLLAMA_API_KEY:-}" ]]; then
  echo "== Ollama Cloud (curl, не браузер) =="
  curl -sS https://ollama.com/v1/chat/completions \
    -H "Authorization: Bearer $OLLAMA_API_KEY" \
    -H 'Content-Type: application/json' \
    -d '{"model":"gemma4:31b-cloud","messages":[{"role":"user","content":"OK"}],"max_tokens":5,"stream":false}' | head -c 200
  echo
fi

echo "OK"
