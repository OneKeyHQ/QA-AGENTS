import { chromium } from 'playwright-core';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];

// Aggressively close everything
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('Escape');
  await sleep(300);
}
await sleep(500);

// Click close/back buttons via JS
await page.evaluate(() => {
  const close = document.querySelector('[data-testid="nav-header-close"]');
  if (close) close.click();
  const back = document.querySelector('[data-testid="nav-header-back"]');
  if (back) back.click();
});
await sleep(500);

for (let i = 0; i < 3; i++) {
  await page.keyboard.press('Escape');
  await sleep(300);
}
await sleep(500);

// Click home via JS
await page.evaluate(() => {
  const home = document.querySelector('[data-testid="home"]');
  if (home) home.click();
});
await sleep(2000);

await page.screenshot({ path: 'shared/results/home-state.png' });
console.log('Done');
await browser.close();
