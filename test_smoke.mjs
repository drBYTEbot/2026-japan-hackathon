// test_smoke.mjs — headless smoke test: load, capture errors, exercise scenes
import { chromium } from 'playwright-core';

const errors = [];
const logs = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
page.on('console', m => { logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', r => errors.push('REQFAIL: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

await page.goto('http://localhost:8080/', { waitUntil: 'load' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/01_title.png' });

// click to start
await page.mouse.click(500, 300);
await page.waitForTimeout(1000);
await page.screenshot({ path: 'shots/02_after_click.png' });

const app = await page.evaluate(() => !!window.__app);
console.log('app exposed:', app);
console.log('--- LOGS ---');
console.log(logs.join('\n') || '(none)');
console.log('--- ERRORS ---');
console.log(errors.length ? errors.join('\n') : '(none)');

if (app) {
  // office movement
  await page.keyboard.down('w'); await page.waitForTimeout(120); await page.keyboard.up('w');
  await page.keyboard.down('d'); await page.waitForTimeout(120); await page.keyboard.up('d');
  await page.screenshot({ path: 'shots/03_office.png' });

  for (const id of ['rush', 'crossy', 'fight']) {
    await page.evaluate(g => window.__app.enterGame(g), id);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `shots/04_${id}.png` });
    await page.mouse.click(480, 300);
    await page.waitForTimeout(250);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__app.exitGame('win', 10));
    await page.waitForTimeout(500);
  }

  await page.evaluate(() => window.__app.openShop());
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'shots/05_shop.png' });
  await page.mouse.click(200, 500);
  await page.waitForTimeout(4400);
  await page.screenshot({ path: 'shots/06_claw.png' });
  await page.mouse.click(480, 490);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__app.closeShop());
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'shots/07_done.png' });
  console.log('--- FINAL ERRORS ---');
  console.log(errors.length ? errors.join('\n') : '(none)');
}

await browser.close();
process.exit(errors.length || !app ? 1 : 0);
