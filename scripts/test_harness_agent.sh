#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${OLLAMA_API_KEY:-}" ]]; then
  echo "OLLAMA_API_KEY not set" >&2
  exit 1
fi

echo "== bridge read_file =="
curl -sS -X POST http://127.0.0.1:8769/invoke \
  -H 'Content-Type: application/json' \
  -d '{"type":"tool.invoke","id":"t1","tool":"read_file","arguments":{"path":"data/sample.txt"}}' | head -c 400
echo

echo "== bridge read_agent_md =="
curl -sS -X POST http://127.0.0.1:8769/invoke \
  -H 'Content-Type: application/json' \
  -d '{"type":"tool.invoke","id":"t2","tool":"read_agent_md","arguments":{"agent_id":"default"}}' | head -c 300
echo

echo "== bridge write_file =="
curl -sS -X POST http://127.0.0.1:8769/invoke \
  -H 'Content-Type: application/json' \
  -d '{"type":"tool.invoke","id":"t3","tool":"write_file","arguments":{"path":"sessions/_test.json","content":"{\"ok\":true}"}}'
echo

echo "== ollama proxy ping =="
curl -sS http://127.0.0.1:8768/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gemma4:31b-cloud","messages":[{"role":"user","content":"Say OK"}],"max_tokens":5,"stream":false}' | head -c 250
echo

echo "== agent turn with tool (via node) =="
node --input-type=module <<'NODE'
const base = 'http://127.0.0.1:8768/v1';
const bridge = 'http://127.0.0.1:8769/invoke';
async function invokeTool(tool, args) {
  const r = await fetch(bridge, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'tool.invoke', id: 'n1', tool, arguments: args }),
  });
  return r.json();
}
const tools = [{
  type: 'function',
  function: {
    name: 'read_file',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
}];
const messages = [
  { role: 'system', content: 'Always use read_file when asked about file contents.' },
  { role: 'user', content: 'Прочитай data/sample.txt через инструмент и процитируй первую строку.' },
];
let res = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gemma4:31b-cloud', messages, tools, stream: false, temperature: 0 }),
});
let data = await res.json();
const tc = data.choices?.[0]?.message?.tool_calls;
if (!tc?.length) {
  console.log('No tool call:', JSON.stringify(data.choices?.[0]?.message).slice(0, 200));
  process.exit(1);
}
const out = await invokeTool(tc[0].function.name, JSON.parse(tc[0].function.arguments));
messages.push(data.choices[0].message);
messages.push({ role: 'tool', tool_call_id: tc[0].id, content: JSON.stringify(out.result) });
res = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gemma4:31b-cloud', messages, tools, stream: false }),
});
data = await res.json();
console.log(data.choices?.[0]?.message?.content?.slice(0, 300) || data);
NODE

echo "OK"
