import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.HARNESS_URL || 'http://127.0.0.1:8877/index.html?demo=fresh';
const outDir = process.env.OUT_DIR || '/workspace/docs/images';

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1400, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('.kb-layout', { timeout: 60000 });
await page.waitForTimeout(1500);

const sessionBtn = page.locator('.kb-sess-btn', { hasText: 'Обороты по счёту 51' });
await sessionBtn.first().click({ timeout: 30000 });
await page.waitForSelector('.h-chart-grid canvas.h-chart', { timeout: 30000 });
await page.waitForTimeout(2500);

await page.locator('.h-chart-grid').screenshot({
  path: `${outDir}/charts-grid-light.png`,
});

await page.evaluate(() => {
  document.documentElement.setAttribute('data-bs-theme', 'dark');
  localStorage.setItem('harnessPalette', 'krabobot');
});
await page.waitForTimeout(800);
await page.locator('.h-chart-grid').screenshot({
  path: `${outDir}/charts-grid-dark.png`,
});

const chat = page.locator('.kb-main');
await chat.screenshot({ path: `${outDir}/chat-charts-demo.png`, fullPage: false });

await browser.close();
console.log('Saved charts to', outDir);
