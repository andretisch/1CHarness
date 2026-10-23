/** Прямой XHR к LLM (OpenAI-compatible или Ollama /api/chat), без локального прокси. */

const DEFAULTS = {
  apiBase: 'https://ollama.com/v1',
  apiStyle: 'openai',
  model: 'gemma4:31b-cloud',
  timeoutMs: 300000,
};

export function getLlmSettings() {
  const apiBase = (localStorage.getItem('harnessLlmApiBase') || DEFAULTS.apiBase).replace(/\/+$/, '');
  const apiStyle = localStorage.getItem('harnessLlmApiStyle') || DEFAULTS.apiStyle;
  return {
    apiBase,
    apiStyle: apiStyle === 'ollama' ? 'ollama' : 'openai',
    model: localStorage.getItem('harnessOpenAiModel') || DEFAULTS.model,
    apiKey: localStorage.getItem('harnessLlmApiKey') || (typeof window !== 'undefined' && window.__HARNESS_LLM_API_KEY) || '',
    timeoutMs: DEFAULTS.timeoutMs,
  };
}

export function saveLlmSettingsFromForm({ apiBase, apiStyle, model, apiKey }) {
  if (apiBase != null) localStorage.setItem('harnessLlmApiBase', apiBase.trim());
  if (apiStyle != null) localStorage.setItem('harnessLlmApiStyle', apiStyle);
  if (model != null) localStorage.setItem('harnessOpenAiModel', model.trim());
  if (apiKey != null && apiKey !== '') localStorage.setItem('harnessLlmApiKey', apiKey);
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
  const url = buildLlmUrl(settings.apiBase, path);
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
