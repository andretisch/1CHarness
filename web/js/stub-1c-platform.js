/** Эмуляция платформы 1С в браузере (тот же контракт, что tools/python/stub_1c). */

const VFS_PREFIX = 'harness:vfs:';
const WORKSPACE_URL_PREFIX = '/workspace/';

function normalizePath(rel) {
  let p = String(rel || '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!p || p.split('/').includes('..')) throw new Error('Недопустимый путь');
  return p;
}

function vfsGet(path) {
  return localStorage.getItem(VFS_PREFIX + path);
}

function vfsSet(path, content) {
  localStorage.setItem(VFS_PREFIX + path, content ?? '');
}

export async function stub1cExecuteTool(name, args) {
  args = args || {};
  try {
    if (name === 'read_file') {
      const path = normalizePath(args.path);
      const overlay = vfsGet(path);
      if (overlay !== null) return { ok: true, result: { path, content: overlay } };
      const res = await fetch(WORKSPACE_URL_PREFIX + path);
      if (!res.ok) throw new Error(`Файл не найден: ${path}`);
      const content = await res.text();
      return { ok: true, result: { path, content } };
    }
    if (name === 'write_file') {
      const path = normalizePath(args.path);
      const content = args.content ?? '';
      vfsSet(path, content);
      return { ok: true, result: { path, bytes: content.length, ok: true } };
    }
    if (name === 'read_agent_md') {
      const agentId = String(args.agent_id || 'default').trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(agentId)) throw new Error('Недопустимый agent_id');
      const inner = await stub1cExecuteTool('read_file', { path: `agents/${agentId}.md` });
      if (!inner.ok) return inner;
      return { ok: true, result: { ...inner.result, agent_id: agentId } };
    }
    throw new Error(`Неизвестный инструмент: ${name}`);
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

/** Слушает мост; в dev имитирует ответ платформы 1С. */
export function installStub1CPlatformOnBridge(isReal1C) {
  document.addEventListener('harness-1c-request', async (ev) => {
    if (isReal1C()) return;
    const payload = ev.detail;
    if (!payload || payload.type !== 'tool.invoke') return;
    const out = await stub1cExecuteTool(payload.tool, payload.arguments);
    const response = {
      type: 'tool.result',
      id: payload.id,
      ok: out.ok,
      result: out.result,
      error: out.error,
    };
    document.dispatchEvent(new CustomEvent('harness-1c-response', { detail: response }));
  });
}
