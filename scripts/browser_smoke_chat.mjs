#!/usr/bin/env node
/** Smoke: Enter отправляет; base URL = ollama.com (полный ответ LLM может упасть на CORS с localhost). */
import { chromium } from 'playwright';

const BASE = process.env.HARNESS_URL || 'http://127.0.0.1:8765/index.html';
const EXPECT_LLM = process.env.HARNESS_SMOKE_LLM === '1';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => window.HarnessAgent?.runHarnessAgentTurn, null, { timeout: 15000 });
  await page.waitForFunction(async () => {
    await window.HarnessAgent.workspaceConfigReady;
    const b = window.HarnessAgent.getConnectionSettings().apiBase;
    return b.includes('ollama.com');
  }, null, { timeout: 10000 });

  const input = page.locator('#chatInput');
  await input.fill('test');
  await input.press('Enter');
  await page.waitForTimeout(1500);
  const sent = await page.evaluate(() => document.body.innerText.includes('test') && !document.querySelector('#chatInput')?.value);

  if (!sent) throw new Error('Enter did not send message');
  console.log('PASS: config → ollama.com, Enter sends');

  if (EXPECT_LLM) {
    await page.waitForFunction(
      () => document.body.innerText.match(/\bOK\b/) && !document.body.innerText.includes('Ошибка:'),
      null,
      { timeout: 120000 },
    );
    console.log('PASS: LLM reply');
  }
  await browser.close();
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
