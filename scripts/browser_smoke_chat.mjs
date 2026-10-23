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
    return window.HarnessAgent.getConnectionSettings().apiBase.includes('/dev-llm/');
  }, null, { timeout: 10000 });

  const input = page.locator('#chatInput');
  await input.fill('Ответь одним словом: OK');
  await input.press('Enter');

  await page.waitForFunction(
    () => document.body.innerText.match(/\bOK\b/) && !document.body.innerText.includes('Ошибка:'),
    null,
    { timeout: 120000 },
  );
  console.log('PASS: Enter sent, assistant replied OK');
  await browser.close();
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
