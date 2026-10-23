#!/usr/bin/env node
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_URL || 'http://127.0.0.1:8765/index.html';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('console:', msg.text());
  });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => window.HarnessAgent?.runHarnessAgentTurn, null, { timeout: 15000 });
  await page.waitForFunction(async () => {
    await window.HarnessAgent.workspaceConfigReady;
    return window.HarnessAgent.getConnectionSettings().apiBase.includes('ollama.com');
  }, null, { timeout: 15000 });

  await page.locator('#chatInput').fill('Ответь одним словом: OK');
  await page.locator('#chatInput').press('Enter');
  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return t.includes('Ответ получен') || (t.match(/\bOK\b/) && !t.includes('Ошибка:'));
    },
    null,
    { timeout: 120000 },
  );
  const err = await page.locator('#statusBar, .status-bar').textContent().catch(() => '');
  if (err && err.includes('Ошибка')) throw new Error(err);
  console.log('PASS: chat + LLM');
  await browser.close();
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
