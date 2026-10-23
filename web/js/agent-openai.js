import { HARNESS_OPENAI_TOOLS } from './tools-openai.js';
import { invoke1cTool } from './bridge-1c.js';

const DEFAULTS = {
  baseUrl: 'http://127.0.0.1:8768/v1',
  model: 'gemma4:31b-cloud',
  maxToolSteps: 8,
};

export function getAgentConfig() {
  return {
    baseUrl: (localStorage.getItem('harnessOpenAiBase') || DEFAULTS.baseUrl).replace(/\/$/, ''),
    model: localStorage.getItem('harnessOpenAiModel') || DEFAULTS.model,
    maxToolSteps: DEFAULTS.maxToolSteps,
  };
}

function parseToolCalls(message) {
  if (!message) return [];
  if (Array.isArray(message.tool_calls) && message.tool_calls.length) return message.tool_calls;
  return [];
}

async function chatCompletion(baseUrl, body, signal) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`LLM: неверный JSON (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || `LLM HTTP ${res.status}`);
  }
  return data;
}

async function executeToolCall(tc) {
  const fn = tc.function || {};
  let args = {};
  try {
    args = fn.arguments ? JSON.parse(fn.arguments) : {};
  } catch {
    return { ok: false, error: 'Некорректные arguments JSON' };
  }
  return invoke1cTool(fn.name, args);
}

/**
 * @param {object} opts
 * @param {Array} opts.messages OpenAI messages (без финального assistant placeholder)
 * @param {AbortSignal} [opts.signal]
 * @param {(text: string) => void} [opts.onAssistantDelta] — только финальный текст (без stream tools)
 * @param {(info: object) => void} [opts.onToolEvent]
 */
export async function runAgentTurn(opts) {
  const cfg = getAgentConfig();
  const messages = [...opts.messages];
  const signal = opts.signal;
  let steps = 0;

  while (steps < cfg.maxToolSteps) {
    steps += 1;
    const body = {
      model: cfg.model,
      messages,
      tools: HARNESS_OPENAI_TOOLS,
      stream: false,
      temperature: opts.temperature ?? 0.4,
    };
    const data = await chatCompletion(cfg.baseUrl, body, signal);
    const choice = data.choices?.[0];
    const msg = choice?.message;
    if (!msg) throw new Error('LLM: пустой ответ');

    const toolCalls = parseToolCalls(msg);
    if (toolCalls.length) {
      messages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        opts.onToolEvent?.({ phase: 'start', name: tc.function?.name, id: tc.id });
        const out = await executeToolCall(tc);
        opts.onToolEvent?.({ phase: 'end', name: tc.function?.name, id: tc.id, ok: out.ok });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(out.ok ? out.result : { error: out.error }, null, 0),
        });
      }
      continue;
    }

    const content = msg.content || '';
    opts.onAssistantDelta?.(content);
    return { content, messages: [...messages, { role: 'assistant', content }] };
  }

  throw new Error('Превышен лимит шагов инструментов');
}

export async function loadSystemPromptViaBridge(agentId = 'default') {
  const out = await invoke1cTool('read_agent_md', { agent_id: agentId });
  if (out.ok && out.result?.content) return out.result.content;
  return 'Ты помощник 1СХарнесс. Используй инструменты для файлов.';
}
