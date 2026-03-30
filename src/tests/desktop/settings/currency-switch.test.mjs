// Currency Switch Test — Verifies default currency switching in preferences
// Flow: CNY → USD (verify $ symbol) → EUR (verify € symbol) → CNY (restore, verify ¥ symbol)
// Language-agnostic navigation; currency codes/symbols are universal

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep, clickTestId, RESULTS_DIR } from '../../helpers/index.mjs';
import { createStepTracker, safeStep, assertListRendered, assertPageLoaded } from '../../helpers/components.mjs';
import { openPreferences, clickPrefsRow } from './nav-helpers.mjs';

export const testCases = [
  { id: 'SETTINGS-002', name: '设置-切换法币', fn: testCurrencySwitch },
];

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'currency-switch');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Currency helpers ────────────────────────────────────────

const CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar' },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro' },
};

/** Open currency dropdown (2nd select-item- in preferences, index=1) */
async function openCurrencyDropdown(page) {
  await clickPrefsRow(page, 1);
  await sleep(1000);
}

/** Click a currency row by code prefix (e.g. "USD - $") */
async function clickCurrencyRow(page, code) {
  const prefix = `${code} - `;
  const clicked = await page.evaluate((pfx) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent?.trim();
      if (t && t.startsWith(pfx)) {
        const el = node.parentElement;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.y > 150) {
          // Walk up to find the clickable row container
          let p = el;
          for (let i = 0; i < 8; i++) {
            p = p.parentElement;
            if (!p) break;
            const pr = p.getBoundingClientRect();
            if (pr.height > 40 && pr.height < 80) {
              p.click();
              return true;
            }
          }
          el.click();
          return true;
        }
      }
    }
    return false;
  }, prefix);

  if (!clicked) throw new Error(`Currency "${code}" not found in dropdown`);
  await sleep(500);
}

/** Click confirm button */
async function clickConfirm(page) {
  await clickTestId(page, 'page-footer-confirm', { delay: 1500 });
}

/** Get the currency symbol shown on wallet header */
async function getWalletSymbol(page) {
  return page.evaluate(() => {
    const header = document.querySelector('[data-testid="Wallet-Tab-Header"]');
    if (!header) return null;
    const text = header.textContent?.trim() || '';
    // Extract the currency symbol at the start of the amount (¥, $, €, etc.)
    const m = text.match(/^([¥$€£A-Z]{1,3})/);
    return m ? m[1] : text.substring(0, 3);
  });
}

/** Search in currency list */
async function searchCurrency(page, query) {
  const input = page.locator('[data-testid="APP-Modal-Screen"] [data-testid="nav-header-search"]');
  await input.click();
  await sleep(200);
  // Clear existing
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const inp = modal?.querySelector('input');
    if (inp) { inp.focus(); inp.select(); }
  });
  await page.keyboard.press('Backspace');
  await sleep(200);
  if (query) {
    await input.pressSequentially(query, { delay: 40 });
  }
  await sleep(1000);
}

/** Clear search */
async function clearCurrencySearch(page) {
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const inp = modal?.querySelector('input');
    if (inp) { inp.focus(); inp.select(); }
  });
  await page.keyboard.press('Backspace');
  await sleep(1000);
}

// ── Main Test ──────────────────────────────────────────────

async function testCurrencySwitch(page) {
  const t = createStepTracker('SETTINGS-002');

  // Step 1: Open preferences → currency dropdown, verify list renders
  await safeStep(page, t, '打开法币列表 + 渲染验证', async () => {
    await openPreferences(page);
    await openCurrencyDropdown(page);

    // Assert dropdown renders: ≥6 hot currencies, no overlap
    const lr = await assertListRendered(page, {
      testidPrefix: 'select-item-subtitle-',
      scope: '[data-testid="APP-Modal-Screen"]',
      minCount: 6,
    });
    if (lr.errors.length > 0) throw new Error(`Dropdown render: ${lr.errors.join('; ')}`);
    return `${lr.count} currencies visible, no overlap`;
  }, SCREENSHOT_DIR);

  // Step 2: Search "USD" → filtered results
  await safeStep(page, t, '搜索 USD 过滤结果', async () => {
    await searchCurrency(page, 'USD');
    const lr = await assertListRendered(page, {
      testidPrefix: 'select-item-subtitle-',
      scope: '[data-testid="APP-Modal-Screen"]',
      minCount: 1,
    });
    if (lr.errors.length > 0) throw new Error(`Search render: ${lr.errors.join('; ')}`);
    // Verify filtered results contain USD
    const hasUSD = lr.items.some(i => i.text.includes('US Dollar') || i.text.includes('USD'));
    if (!hasUSD) throw new Error(`Search "USD" did not return US Dollar, got: ${lr.items.map(i => i.text).join(', ')}`);
    return `${lr.count} results, USD found`;
  }, SCREENSHOT_DIR);

  // Step 3: Clear search → full list restored
  await safeStep(page, t, '清空搜索恢复完整列表', async () => {
    await clearCurrencySearch(page);
    const lr = await assertListRendered(page, {
      testidPrefix: 'select-item-subtitle-',
      scope: '[data-testid="APP-Modal-Screen"]',
      minCount: 6,
    });
    if (lr.errors.length > 0) throw new Error(`Restore render: ${lr.errors.join('; ')}`);
    return `${lr.count} currencies restored`;
  }, SCREENSHOT_DIR);

  // Step 4: Select USD → confirm → verify wallet shows $
  // Note: confirm closes the entire modal, returns to wallet page directly
  await safeStep(page, t, '切换到 USD + 验证 $', async () => {
    await clickCurrencyRow(page, 'USD');
    await clickConfirm(page);
    await sleep(1000);
    const symbol = await getWalletSymbol(page);
    if (symbol !== '$') throw new Error(`Expected "$", got "${symbol}"`);
    return `symbol: ${symbol}`;
  }, SCREENSHOT_DIR);

  // Step 5: Switch to EUR → confirm → verify €
  await safeStep(page, t, '切换到 EUR + 验证 €', async () => {
    await openPreferences(page);
    await openCurrencyDropdown(page);
    await clickCurrencyRow(page, 'EUR');
    await clickConfirm(page);
    await sleep(1000);
    const symbol = await getWalletSymbol(page);
    if (symbol !== '€') throw new Error(`Expected "€", got "${symbol}"`);
    return `symbol: ${symbol}`;
  }, SCREENSHOT_DIR);

  // Step 6: Restore CNY → confirm → verify ¥
  await safeStep(page, t, '恢复 CNY + 验证 ¥', async () => {
    await openPreferences(page);
    await openCurrencyDropdown(page);
    await clickCurrencyRow(page, 'CNY');
    await clickConfirm(page);
    await sleep(1000);
    const symbol = await getWalletSymbol(page);
    if (symbol !== '¥') throw new Error(`Expected "¥", got "${symbol}"`);
    return `symbol: ${symbol}`;
  }, SCREENSHOT_DIR);

  return t.result();
}
