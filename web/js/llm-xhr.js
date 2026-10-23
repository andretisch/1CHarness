/** Прямой XHR к LLM (OpenAI-compatible или Ollama /api/chat), без локального прокси. */

import { getConnectionSettings } from './agent-config.js';

const DEFAULT_TIMEOUT_MS = 300000;

export function getLlmSettings() {
  const c = getConnectionSettings();
  return {
    apiBase: (c.apiBase || 'https://ollama.com/v1').replace(/\/+$/, ''),
    apiStyle: c.apiStyle === 'ollama' ? 'ollama' : 'openai',
    model: c.model || 'gemma4:31b-cloud',
    apiKey: c.apiKey || (typeof window !== 'undefined' && window.__HARNESS_LLM_API_KEY) || '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
  };
}

/** @param {'openai'|'ollama'} apiStyle */
export function llmChatPath(apiStyle) {
  return apiStyle === 'ollama' ? '/api/chat' : '/v1/chat/completions';
}

export function buildLlmUrl(apiBase, path) {
  const base = apiBase.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  if (base.endsWith('/v1') && p.startsWith('/v1/')) {
    return base.replace(/\/v1$/, '') + p;
  }
  return base + p;
}

/** localhost + ollama.com в config → same-origin relay (CORS); в 1С — прямой URL. */
export function resolveLlmPostUrl(apiBase, path) {
  const direct = buildLlmUrl(apiBase, path);
  if (typeof window === 'undefined') return direct;
  const host = window.location.hostname;
  const localDev = host === 'localhost' || host === '127.0.0.1';
  const ollamaCloud = /ollama\.com/i.test(apiBase);
  if (localDev && ollamaCloud) {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${window.location.origin}/dev-llm/v1${p.replace(/^\/v1/, '')}`;
  }
  return direct;
}

function applyLlmAuthHeaders(xhr, apiKey) {
  if (apiKey) {
    xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
  }
}

/**
 * @returns {Promise<object>} parsed JSON body
 */
export function postLlmViaXhr(payload, options = {}) {
  const settings = getLlmSettings();
  const path = llmChatPath(settings.apiStyle);
  const url = resolveLlmPostUrl(settings.apiBase, path);
  const timeoutMs = options.timeoutMs ?? settings.timeoutMs;
  const signal = options.signal;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let aborted = false;

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      aborted = true;
      try { xhr.abort(); } catch (_) { /* ignore */ }
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    if (signal) signal.addEventListener('abort', onAbort);

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');
    applyLlmAuthHeaders(xhr, settings.apiKey);
    xhr.timeout = timeoutMs;

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4 || aborted) return;
      cleanup();
      const text = xhr.responseText || '';
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(text));
        } catch {
          reject(new Error('LLM: неверный JSON в ответе'));
        }
        return;
      }
      if (xhr.status) {
        reject(new Error(`HTTP ${xhr.status}\n${text}`.trim()));
        return;
      }
      reject(new Error('Нет ответа от сервера LLM.'));
    };

    xhr.onerror = function () {
      if (aborted) return;
      cleanup();
      reject(new Error('Ошибка сети: запрос к LLM не выполнен.'));
    };

    xhr.ontimeout = function () {
      if (aborted) return;
      cleanup();
      reject(new Error('Превышен таймаут запроса к LLM.'));
    };

    try {
      xhr.send(JSON.stringify(payload));
    } catch (e) {
      cleanup();
      reject(e instanceof Error ? e : new Error('Ошибка отправки запроса к LLM.'));
    }
  });
}

/** OpenAI chat/completions → assistant message (Ollama /api/chat совместим по message). */
export function extractAssistantMessage(data, apiStyle) {
  if (apiStyle === 'ollama') {
    const msg = data.message;
    if (msg) return msg;
  }
  return data.choices?.[0]?.message;
}
