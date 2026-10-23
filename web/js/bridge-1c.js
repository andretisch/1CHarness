/** Вызов инструментов только через мост платформы 1С. */

function harnessBridgeMode() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('backend') === '1c' || window.__1CHarnessBackend === true) return 'dom';
  return 'http';
}

function harnessBridgeHttpUrl() {
  return (
    localStorage.getItem('harnessBridgeUrl') ||
    window.__harnessBridgeUrl ||
    'http://127.0.0.1:8769/invoke'
  );
}

let bridgeWaiters = new Map();

export function installDomBridgeListener() {
  document.addEventListener('harness-1c-response', (ev) => {
    const data = ev.detail;
    if (data?.id && bridgeWaiters.has(data.id)) {
      const { resolve } = bridgeWaiters.get(data.id);
      bridgeWaiters.delete(data.id);
      resolve(data);
    }
  });
}

function postDomBridge(payload) {
  const json = JSON.stringify(payload);
  const bridge = document.getElementById('harness-1c-bridge');
  if (bridge) {
    bridge.textContent = json;
    bridge.dataset.seq = String(Date.now());
  }
  try {
    if (window.HarnessNative?.postMessage) window.HarnessNative.postMessage(json);
  } catch (_) { /* not in 1C */ }
  document.dispatchEvent(new CustomEvent('harness-1c-request', { detail: payload }));
}

function waitDomBridge(id, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      bridgeWaiters.delete(id);
      reject(new Error('Таймаут моста 1С'));
    }, timeoutMs);
    bridgeWaiters.set(id, {
      resolve: (data) => {
        clearTimeout(timer);
        resolve(data);
      },
    });
  });
}

/** @returns {Promise<{ok:boolean, result?: object, error?: string}>} */
export async function invoke1cTool(tool, args, options = {}) {
  const id = `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = { type: 'tool.invoke', id, tool, arguments: args || {} };
  const timeoutMs = options.timeoutMs ?? 30000;

  if (harnessBridgeMode() === 'dom') {
    postDomBridge(payload);
    const data = await waitDomBridge(id, timeoutMs);
    if (data.type === 'tool.result') {
      return { ok: !!data.ok, result: data.result, error: data.error };
    }
    return { ok: false, error: data.error || 'Неверный ответ моста' };
  }

  const res = await fetch(harnessBridgeHttpUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (data.type === 'tool.result') {
    return { ok: !!data.ok, result: data.result, error: data.error };
  }
  return { ok: false, error: data.error || `HTTP ${res.status}` };
}

/** Для встраивания в 1С: window.harnessDeliverResponse({ type, id, ok, result }) */
export function wireHarnessDeliverResponse() {
  const prev = window.harnessDeliverResponse;
  window.harnessDeliverResponse = function (payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    document.dispatchEvent(new CustomEvent('harness-1c-response', { detail: data }));
    if (typeof prev === 'function') prev(payload);
  };
}
