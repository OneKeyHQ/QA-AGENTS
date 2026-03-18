import { chromium } from 'playwright-core';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];

// Open send form for AKT
console.log('1. Click 发送...');
const sendBtn = page.locator('[data-testid="Wallet-Tab-Header"] >> text=发送').last();
await sendBtn.click({ timeout: 5000 });
await sleep(2000);

// Check if token selection needed
const hasSendForm = await page.locator('[data-testid="send-recipient-amount-form"]').isVisible({ timeout: 1000 }).catch(() => false);
console.log('Direct send form:', hasSendForm);

if (!hasSendForm) {
  // Token search
  const tokenSearch = page.locator('input[placeholder="搜索资产"]');
  const hasSearch = await tokenSearch.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasSearch) {
    await tokenSearch.fill('AKT');
    await sleep(1000);
    // Click AKT
    await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return;
      const spans = modal.querySelectorAll('span');
      for (const s of spans) {
        if (s.textContent?.trim() === 'AKT' && s.getBoundingClientRect().width > 0) {
          const row = s.closest('[role="button"]') || s.parentElement?.parentElement;
          if (row) row.click();
          else s.click();
          return;
        }
      }
    });
    await sleep(2000);
  }
}

console.log('2. Send form should be visible...');
await page.screenshot({ path: 'shared/results/debug-sendform.png' });

// Now click contacts icon
console.log('3. Click contacts icon...');
const contactsPos = await page.evaluate(() => {
  const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
  if (!modal) return { error: 'no modal' };
  const icon = modal.querySelector('[data-sentry-component="SvgPeopleCircle"]');
  if (icon) {
    const r = icon.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, found: 'SvgPeopleCircle' };
  }
  // Look for all SVGs in the form area
  const svgs = [];
  modal.querySelectorAll('svg').forEach(svg => {
    const r = svg.getBoundingClientRect();
    if (r.width > 0 && r.width < 50) {
      svgs.push({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), parent: svg.parentElement?.getAttribute('data-sentry-component') });
    }
  });
  return { error: 'no SvgPeopleCircle', svgs: svgs.slice(0, 10) };
});
console.log('Contacts icon:', JSON.stringify(contactsPos, null, 2));

if (contactsPos.x) {
  await page.mouse.click(contactsPos.x, contactsPos.y);
  await sleep(1500);
  await page.screenshot({ path: 'shared/results/debug-contacts-menu.png' });

  // Click 我的账户
  console.log('4. Click 我的账户...');
  const myAccPos = await page.evaluate(() => {
    const spans = document.querySelectorAll('span');
    for (const s of spans) {
      if (s.textContent === '我的账户' && s.getBoundingClientRect().width > 0) {
        const r = s.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
    }
    return null;
  });
  console.log('我的账户 pos:', myAccPos);

  if (myAccPos) {
    await page.mouse.click(myAccPos.x, myAccPos.y);
    await sleep(3000);
    await page.screenshot({ path: 'shared/results/debug-my-accounts.png' });

    // Dump all visible text in modal
    const modalTexts = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return [];
      const spans = modal.querySelectorAll('span');
      const texts = [];
      for (const s of spans) {
        const r = s.getBoundingClientRect();
        if (r.width > 0 && s.textContent?.trim()) {
          texts.push({ text: s.textContent.trim().substring(0, 60), x: Math.round(r.x), y: Math.round(r.y) });
        }
      }
      return texts.slice(0, 40);
    });
    console.log('Modal texts:', JSON.stringify(modalTexts, null, 2));
  }
}

await browser.close();
