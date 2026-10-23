import { HARNESS_OPENAI_TOOLS } from './tools-openai.js';
import { invoke1cTool } from './bridge-1c.js';
import {
  getLlmSettings,
  postLlmViaXhr,
  extractAssistantMessage,
} from './llm-xhr.js';

const MAX_TOOL_STEPS = 8;

export function getAgentConfig() {
  const llm = getLlmSettings();
  return {
    model: llm.model,
    apiBase: llm.apiBase,
    apiStyle: llm.apiStyle,
    maxToolSteps: MAX_TOOL_STEPS,
  };
}

function parseToolCalls(message) {
  if (!message) return [];
  if (Array.isArray(message.tool_calls) && message.tool_calls.length) return message.tool_calls;
  return [];
}

async function chatCompletion(body, signal) {
  const settings = getLlmSettings();
  const payload =
    settings.apiStyle === 'ollama'
      ? { model: body.model, messages: body.messages, stream: false, tools: body.tools }
      : body;
  const data = await postLlmViaXhr(payload, { signal });
  const msg = extractAssistantMessage(data, settings.apiStyle);
  if (!msg) throw new Error('LLM: пустой ответ');
  return { raw: data, message: msg };
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

export async function runAgentTurn(opts) {
  const cfg = getAgentConfig();
  const messages = [...opts.messages];
  const signal = opts.signal;
  let steps = 0;
  const failStreak = new Map();
  let delegateEmpty = 0;
  const charts = [];

  while (steps < cfg.maxToolSteps) {
    steps += 1;
    const body = {
      model: cfg.model,
      messages,
      tools: HARNESS_OPENAI_TOOLS,
      stream: false,
      temperature: opts.temperature ?? 0.4,
    };
    const { message: msg } = await chatCompletion(body, signal);

    const toolCalls = parseToolCalls(msg);
    if (toolCalls.length) {
      messages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        opts.onToolEvent?.({ phase: 'start', name, id: tc.id });
        if (name === 'delegate_task' && delegateEmpty >= 2) {
          const blocked = { ok: false, error: 'delegate_task пропущен: два пустых запуска подряд' };
          opts.onToolEvent?.({ phase: 'end', name, id: tc.id, ok: false });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ error: blocked.error }),
          });
          continue;
        }
        const out = await executeToolCall(tc);
        if (out.ok && out.result?.chart) charts.push(out.result.chart);
        if (name === 'delegate_task' && out.ok && !(out.result?.rows || []).length) {
          delegateEmpty += 1;
        }
        opts.onToolEvent?.({ phase: 'end', name, id: tc.id, ok: out.ok, error: out.error, chart: out.result?.chart });
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(out.ok ? out.result : { error: out.error }, null, 0),
        });
        if (!out.ok) {
          const streak = (failStreak.get(name) || 0) + 1;
          failStreak.set(name, streak);
          if (streak >= 3) {
            const content = `Остановлено: инструмент ${name} трижды завершился ошибкой.\n\n${out.error || ''}`;
            opts.onAssistantDelta?.(content);
            return { content, messages, charts };
          }
        } else {
          failStreak.set(name, 0);
        }
      }
      continue;
    }

    const content = msg.content || '';
    opts.onAssistantDelta?.(content);
    return { content, messages: [...messages, { role: 'assistant', content }], charts };
  }

  throw new Error('Превышен лимит шагов инструментов');
}

export async function loadSystemPromptViaBridge(agentId = 'default') {
  const out = await invoke1cTool('fs_read', { path: `agents/${agentId}.md` });
  if (out.ok && out.result?.content) return out.result.content;
  return 'Ты помощник 1СХарнесс. Используй инструменты для файлов и расчётов. Запросы к базе — только через run_query в сеансе 1С.';
}
