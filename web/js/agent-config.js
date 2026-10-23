import { invoke1cTool } from './bridge-1c.js';

const CONFIG_PATH = 'config.json';

const DEFAULT_CONFIG = {
  connection: {
    apiBase: 'https://ollama.com/v1',
    apiStyle: 'openai',
    model: 'gemma4:31b-cloud',
    apiKey: '',
  },
  generation: {
    temperature: 0.4,
  },
};

/** @type {typeof DEFAULT_CONFIG | null} */
let cache = null;

function mergeConfig(raw) {
  const parsed = typeof raw === 'object' && raw ? raw : {};
  return {
    connection: { ...DEFAULT_CONFIG.connection, ...(parsed.connection || {}) },
    generation: { ...DEFAULT_CONFIG.generation, ...(parsed.generation || {}) },
  };
}

const DEV_PROXY_BASE_RE = /\/dev-llm\/|127\.0\.0\.1:\d+\/dev-llm/i;

function normalizeApiBase(base) {
  const b = String(base || '').trim();
  if (!b || DEV_PROXY_BASE_RE.test(b)) return DEFAULT_CONFIG.connection.apiBase;
  return b;
}

function bootstrapFromDevEnv() {
  let changed = false;
  if (typeof window === 'undefined') return false;
  const normalized = normalizeApiBase(cache.connection.apiBase);
  if (normalized !== cache.connection.apiBase) {
    cache.connection.apiBase = normalized;
    changed = true;
  }
  const key = window.__HARNESS_LLM_API_KEY;
  if (key && !cache.connection.apiKey) {
    cache.connection.apiKey = key;
    changed = true;
  }
  return changed;
}

async function writeConfigFile() {
  const content = JSON.stringify(cache, null, 2);
  const out = await invoke1cTool('fs_write', { path: CONFIG_PATH, content });
  if (!out.ok) throw new Error(out.error || 'Не удалось записать config.json');
}

export async function loadWorkspaceConfig() {
  const out = await invoke1cTool('fs_read', { path: CONFIG_PATH });
  if (out.ok) {
    try {
      cache = mergeConfig(JSON.parse(out.result.content));
    } catch {
      cache = mergeConfig(null);
    }
  } else {
    cache = mergeConfig(null);
  }
  cache.connection.apiBase = normalizeApiBase(cache.connection.apiBase);
  const devBootstrap = bootstrapFromDevEnv();
  if (!out.ok || devBootstrap) {
    try {
      await writeConfigFile();
    } catch {
      /* dev: read-only workspace — ключ всё равно в cache */
    }
  }
  return cache;
}

export function getWorkspaceConfig() {
  if (!cache) return mergeConfig(null);
  return cache;
}

export function getConnectionSettings() {
  return { ...getWorkspaceConfig().connection };
}

export async function updateConnectionSettings(partial) {
  if (!cache) await loadWorkspaceConfig();
  cache.connection = { ...cache.connection, ...partial };
  await writeConfigFile();
  return cache.connection;
}

export async function updateGenerationSettings(partial) {
  if (!cache) await loadWorkspaceConfig();
  cache.generation = { ...cache.generation, ...partial };
  await writeConfigFile();
  return cache.generation;
}

/** Запускать только после installStub1CPlatformOnBridge (см. harness-agent-boot.js). */
let configReadyPromise = null;

export function ensureWorkspaceConfigLoaded() {
  if (!configReadyPromise) {
    configReadyPromise = loadWorkspaceConfig().catch((err) => {
      configReadyPromise = null;
      throw err;
    });
  }
  return configReadyPromise;
}
