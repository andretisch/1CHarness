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

function bootstrapFromDevEnv() {
  let changed = false;
  if (typeof window === 'undefined') return false;
  if (window.__HARNESS_LLM_DEV_API_BASE && cache.connection.apiBase !== window.__HARNESS_LLM_DEV_API_BASE) {
    cache.connection.apiBase = window.__HARNESS_LLM_DEV_API_BASE;
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
  const out = await invoke1cTool('write_file', { path: CONFIG_PATH, content });
  if (!out.ok) throw new Error(out.error || 'Не удалось записать config.json');
}

export async function loadWorkspaceConfig() {
  const out = await invoke1cTool('read_file', { path: CONFIG_PATH });
  if (out.ok) {
    try {
      cache = mergeConfig(JSON.parse(out.result.content));
    } catch {
      cache = mergeConfig(null);
    }
  } else {
    cache = mergeConfig(null);
  }
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
