import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];
if (page) {
  console.log('Title:', await page.title());
  await page.screenshot({ path: 'shared/results/current-state.png' });
  console.log('Screenshot saved');

  const bodyText = await page.evaluate(() => {
    const allSpans = document.querySelectorAll('span');
    const visible = [];
    for (const s of allSpans) {
      const r = s.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && s.textContent?.trim()) {
        visible.push({ text: s.textContent.trim().substring(0, 50), x: Math.round(r.x), y: Math.round(r.y) });
      }
    }
    return visible.slice(0, 80);
  });
  console.log('Visible spans:', JSON.stringify(bodyText, null, 2));
} else {
  console.log('No page found');
}
await browser.close();
