/** Вызов инструментов только через мост платформы 1С (DOM). */

export function isReal1CBridge() {
  const params = new URLSearchParams(window.location.search);
  return params.get('backend') === '1c' || window.__1CHarnessBackend === true;
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
  } catch (_) { /* not in 1C host */ }
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

  const dataPromise = waitDomBridge(id, timeoutMs);
  postDomBridge(payload);
  const data = await dataPromise;
  if (data.type === 'tool.result') {
    return { ok: !!data.ok, result: data.result, error: data.error };
  }
  return { ok: false, error: data.error || 'Неверный ответ моста' };
}

/** Для платформы 1С: window.harnessDeliverResponse({ type, id, ok, result }) */
export function wireHarnessDeliverResponse() {
  const prev = window.harnessDeliverResponse;
  window.harnessDeliverResponse = function (payload) {
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
    document.dispatchEvent(new CustomEvent('harness-1c-response', { detail: data }));
    if (typeof prev === 'function') prev(payload);
  };
}
