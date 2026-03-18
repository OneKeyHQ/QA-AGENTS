import { chromium } from 'playwright-core';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];

// Try clicking the vault entry using Playwright locator directly
console.log('Attempting to click vault entry...');

// First let's see what's clickable
const entries = await page.evaluate(() => {
  // Look for clickable areas containing "vault"
  const results = [];
  const all = document.querySelectorAll('[role="button"], button, a, [data-testid]');
  for (const el of all) {
    const r = el.getBoundingClientRect();
    const t = el.textContent?.trim();
    if (r.width > 0 && t && t.includes('vault')) {
      results.push({
        tag: el.tagName,
        text: t.substring(0, 80),
        testid: el.getAttribute('data-testid'),
        role: el.getAttribute('role'),
        x: Math.round(r.x), y: Math.round(r.y),
        w: Math.round(r.width), h: Math.round(r.height)
      });
    }
  }
  return results;
});
console.log('Vault entries found:', JSON.stringify(entries, null, 2));

// Try clicking via coordinates on the vault entry (around y=568 based on screenshot)
// The vault entry shows at approximately x=420, y=580
const vaultSpan = await page.evaluate(() => {
  const spans = document.querySelectorAll('span');
  for (const s of spans) {
    if (s.textContent?.includes('vault') && s.getBoundingClientRect().width > 0) {
      const r = s.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2, text: s.textContent };
    }
  }
  return null;
});
console.log('Vault span:', vaultSpan);

if (vaultSpan) {
  // Click at the vault entry position
  await page.mouse.click(vaultSpan.x, vaultSpan.y);
  console.log(`Clicked at (${vaultSpan.x}, ${vaultSpan.y})`);
}

await sleep(3000);

// Screenshot to see what happened
await page.screenshot({ path: 'shared/results/after-vault-click.png' });
console.log('Screenshot saved');

// Check if we're now on the amount form
const hasAmountForm = await page.evaluate(() => {
  const form = document.querySelector('[data-testid="send-recipient-amount-form"]');
  if (!form) return 'no form found';
  const inputs = form.querySelectorAll('input');
  const spans = form.querySelectorAll('span');
  const formTexts = [];
  for (const s of spans) {
    const r = s.getBoundingClientRect();
    if (r.width > 0 && s.textContent?.trim()) {
      formTexts.push({ text: s.textContent.trim().substring(0, 40), x: Math.round(r.x), y: Math.round(r.y) });
    }
  }
  return { inputCount: inputs.length, texts: formTexts.slice(0, 30) };
});
console.log('Amount form state:', JSON.stringify(hasAmountForm, null, 2));

await browser.close();
