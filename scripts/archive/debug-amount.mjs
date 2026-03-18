import { chromium } from 'playwright-core';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];

// Click vault entry to select recipient
const clicked = await page.evaluate(() => {
  const allSpans = document.querySelectorAll('span');
  for (const s of allSpans) {
    const r = s.getBoundingClientRect();
    if (r.width > 0 && s.textContent?.includes('vault')) {
      const container = s.closest('[role="button"]') || s.parentElement?.parentElement;
      if (container) { container.click(); return 'clicked container'; }
      s.click();
      return 'clicked span';
    }
  }
  return 'not found';
});
console.log('Clicked vault:', clicked);
await sleep(3000);

// Screenshot the amount form
await page.screenshot({ path: 'shared/results/amount-form.png' });
console.log('Amount form screenshot saved');

// Find all elements in the form - look for Max button
const formInfo = await page.evaluate(() => {
  const allElements = document.querySelectorAll('span, button, a, div, label');
  const candidates = [];
  for (const el of allElements) {
    const r = el.getBoundingClientRect();
    const t = el.textContent?.trim();
    if (r.width > 0 && r.height > 0 && t && t.length < 40) {
      const tag = el.tagName.toLowerCase();
      const testid = el.getAttribute('data-testid');
      // Focus on elements in the modal area (x > 300)
      if (r.x > 300 && r.y > 100 && r.y < 800) {
        candidates.push({
          tag, text: t, testid,
          role: el.getAttribute('role'),
          x: Math.round(r.x), y: Math.round(r.y),
          w: Math.round(r.width), h: Math.round(r.height)
        });
      }
    }
  }
  // Deduplicate by text+position
  const seen = new Set();
  return candidates.filter(c => {
    const key = `${c.text}-${c.x}-${c.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 50);
});

console.log('Form elements:', JSON.stringify(formInfo, null, 2));
await browser.close();
