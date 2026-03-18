import { chromium } from 'playwright-core';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];

if (!page) { console.log('No page'); process.exit(1); }

// Click 发送 button
const sendBtn = page.locator('[data-testid="Wallet-Tab-Header"] >> text=发送').last();
await sendBtn.click({ timeout: 5000 });
await sleep(2000);

// Check if token selection dialog appeared, select ATOM
const tokenSearch = page.locator('input[placeholder="搜索资产"]');
const hasTokenSearch = await tokenSearch.isVisible({ timeout: 2000 }).catch(() => false);
if (hasTokenSearch) {
  console.log('Token search dialog visible, selecting ATOM...');
  await tokenSearch.fill('ATOM');
  await sleep(1000);
  const atomItem = page.locator('[data-testid="APP-Modal-Screen"] >> text="ATOM"').first();
  await atomItem.click({ timeout: 5000 });
  await sleep(2000);
}

// Now on send form - screenshot it
await page.screenshot({ path: 'shared/results/send-form.png' });
console.log('Send form screenshot saved');

// Find all buttons and text near amount input
const formElements = await page.evaluate(() => {
  const form = document.querySelector('[data-testid="send-recipient-amount-form"]');
  if (!form) return { error: 'form not found' };

  // Get all elements with text content in the form
  const elements = form.querySelectorAll('*');
  const items = [];
  for (const el of elements) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      const text = el.textContent?.trim();
      const tag = el.tagName.toLowerCase();
      const testid = el.getAttribute('data-testid');
      const role = el.getAttribute('role');
      if (text && text.length < 30) {
        items.push({ tag, text, testid, role, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
      }
    }
  }

  // Also look for "最大" or "Max" or "max" anywhere on the page
  const allSpans = document.querySelectorAll('span, button, a, div');
  const maxCandidates = [];
  for (const s of allSpans) {
    const t = s.textContent?.trim();
    const r = s.getBoundingClientRect();
    if (t && r.width > 0 && (t.includes('最大') || t.toLowerCase().includes('max') || t.includes('全部'))) {
      maxCandidates.push({ tag: s.tagName, text: t.substring(0, 50), x: Math.round(r.x), y: Math.round(r.y), testid: s.getAttribute('data-testid') });
    }
  }

  return { formItems: items.slice(0, 40), maxCandidates };
});

console.log('Form elements:', JSON.stringify(formElements, null, 2));
await browser.close();
