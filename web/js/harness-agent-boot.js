import {
  runAgentTurn,
  loadSystemPromptViaBridge,
  getAgentConfig,
} from './agent-openai.js';
import { installDomBridgeListener, wireHarnessDeliverResponse, invoke1cTool, isReal1CBridge } from './bridge-1c.js';
import { installStub1CPlatformOnBridge } from './stub-1c-platform.js';

installDomBridgeListener();
wireHarnessDeliverResponse();
installStub1CPlatformOnBridge(isReal1CBridge);

let cachedSystemPrompt = null;

export function harnessAgentEnabled() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('legacy') === 'llama') return false;
  return true;
}

export async function ensureSystemPrompt() {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  cachedSystemPrompt = await loadSystemPromptViaBridge('default');
  return cachedSystemPrompt;
}

export async function persistSessionJsonViaBridge(sessionId, payload) {
  if (!sessionId) return;
  const path = `sessions/${sessionId}.json`;
  const content = JSON.stringify(payload, null, 2);
  await invoke1cTool('write_file', { path, content });
}

export async function loadSessionJsonViaBridge(sessionId) {
  const out = await invoke1cTool('read_file', { path: `sessions/${sessionId}.json` });
  if (!out.ok) return null;
  try {
    return JSON.parse(out.result.content);
  } catch {
    return null;
  }
}

/**
 * @param {object} p
 * @param {Array<{role:string,content:string}>} p.turnMessages user/assistant for API (no ids)
 */
export async function runHarnessAgentTurn(p) {
  const system = await ensureSystemPrompt();
  const messages = [{ role: 'system', content: system }, ...p.turnMessages];
  return runAgentTurn({
    messages,
    signal: p.signal,
    temperature: p.temperature,
    onToolEvent: p.onToolEvent,
    onAssistantDelta: p.onAssistantDelta,
  });
}

window.HarnessAgent = {
  enabled: harnessAgentEnabled,
  getAgentConfig,
  runHarnessAgentTurn,
  persistSessionJsonViaBridge,
  loadSessionJsonViaBridge,
  invoke1cTool,
  ensureSystemPrompt,
};
