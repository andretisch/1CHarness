/** Эмуляция платформы 1С в браузере: инструменты ТЗ через тот же контракт, что tools/python/stub_1c. */

import { executeHarnessTool, toolErrorPayload } from './tools-runtime.js';

const VFS_PREFIX = 'harness:vfs:';
const WORKSPACE_URL_PREFIX = '/workspace/';
const DEV_PROXY_BASE_RE = /\/dev-llm\/|127\.0\.0\.1:\d+\/dev-llm/i;

let manifestCache = null;

function vfsKeys() {
  const paths = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && key.startsWith(VFS_PREFIX)) paths.push(key.slice(VFS_PREFIX.length));
  }
  return paths;
}

function vfsGet(path) {
  return localStorage.getItem(VFS_PREFIX + path);
}

function vfsSet(path, content) {
  localStorage.setItem(VFS_PREFIX + path, content ?? '');
}

function vfsRemove(path) {
  localStorage.removeItem(VFS_PREFIX + path);
}

function configJsonUsesDevProxy(content) {
  try {
    const o = JSON.parse(content);
    return DEV_PROXY_BASE_RE.test(o?.connection?.apiBase || '');
  } catch {
    return false;
  }
}

async function loadManifest() {
  if (manifestCache) return manifestCache;
  try {
    const res = await fetch(`${WORKSPACE_URL_PREFIX}manifest.json`);
    if (!res.ok) {
      manifestCache = [];
      return manifestCache;
    }
    const data = await res.json();
    manifestCache = Array.isArray(data) ? data : [];
  } catch {
    manifestCache = [];
  }
  return manifestCache;
}

async function readDisk(path) {
  const res = await fetch(WORKSPACE_URL_PREFIX + path);
  if (!res.ok) throw new Error(`Файл не найден: ${path}`);
  return res.text();
}

const fs = {
  async read(path) {
    const overlay = vfsGet(path);
    if (path === 'config.json' && overlay !== null && configJsonUsesDevProxy(overlay)) {
      vfsRemove(path);
    } else if (overlay !== null) {
      return overlay;
    }
    return readDisk(path);
  },
  async write(path, content) {
    vfsSet(path, content ?? '');
  },
  async list() {
    const disk = await loadManifest();
    return [...new Set([...disk, ...vfsKeys()])].filter((p) => p && !p.endsWith('/.keep') ? true : true);
  },
  async searchChats(query) {
    const q = query.toLowerCase();
    const hits = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('llamaChatSession_')) continue;
      const raw = localStorage.getItem(key) || '';
      if (!raw.toLowerCase().includes(q)) continue;
      const at = raw.toLowerCase().indexOf(q);
      hits.push({
        session_id: key.slice('llamaChatSession_'.length),
        excerpt: raw.slice(Math.max(0, at - 40), at + query.length + 80).replace(/\s+/g, ' '),
      });
    }
    return hits;
  },
  async readSkills() {
    const paths = (await this.list()).filter((p) => p.startsWith('skills/') || p.startsWith('agents/'));
    const docs = [];
    for (const path of paths) {
      if (!path.endsWith('.md')) continue;
      try {
        docs.push({ path, content: await this.read(path) });
      } catch {
        /* skip missing */
      }
    }
    return docs;
  },
};

export async function stub1cExecuteTool(name, args) {
  try {
    const result = await executeHarnessTool(name, args, fs);
    return { ok: true, result };
  } catch (e) {
    const payload = toolErrorPayload(e);
    return { ok: false, error: payload.message, hints: payload.hints };
  }
}

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
      hints: out.hints,
    };
    queueMicrotask(() => {
      document.dispatchEvent(new CustomEvent('harness-1c-response', { detail: response }));
    });
  });
}
