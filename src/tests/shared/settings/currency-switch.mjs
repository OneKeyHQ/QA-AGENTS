// Settings Currency Switch — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/settings/currency-switch.test.mjs
//   src/tests/web/settings/currency-switch.test.mjs
//   src/tests/extension/settings/currency-switch.test.mjs
// inject platform-specific CDP connect + openSettings (preferences/currency entry),
// then call createCurrencySwitchTests() to get the same case prefixed for the platform.
//
// Flow: open list → search USD → clear search → switch USD ($) → EUR (€) → CNY (¥)

import { sleep } from '../../helpers/constants.mjs';
import { clickTestId } from '../../helpers/index.mjs';
import { createStepTracker, safeStep, assertListRendered } from '../../helpers/components.mjs';

/**
 * Build the Currency Switch test case for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'SETTINGS' | 'WEB-SETTINGS' | 'EXT-SETTINGS'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page) => Promise<void>} opts.openSettings - Open Preferences screen.
 * @param {(page) => Promise<void>} [opts.openCurrencyDropdown]
 *   Click the Currency row in Preferences. Defaults to clicking the 2nd select-item-
 *   row (index=1), which works for Desktop preferences.
 * @param {string} [opts.screenshotDir]
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createCurrencySwitchTests({
  prefix,
  namePrefix = '',
  openSettings,
  openCurrencyDropdown,
  screenshotDir,
}) {
  const SCREENSHOT_DIR = screenshotDir;

  async function defaultOpenCurrencyDropdown(page) {
    const clicked = await page.evaluate(() => {
      const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
      for (const m of modals) {
        const r = m.getBoundingClientRect();
        if (r.width <= 0) continue;
        const items = m.querySelectorAll('[data-testid="select-item-"]');
        if (items.length > 1) { items[1].click(); return true; }
      }
      return false;
    });
    if (!clicked) throw new Error('Currency row (index=1) not found in preferences modal');
    await sleep(1000);
  }

  const _openCurrencyDropdown = openCurrencyDropdown || defaultOpenCurrencyDropdown;

  /** Click a currency row by code prefix (e.g. "USD - $") inside the modal. */
  async function clickCurrencyRow(page, code) {
    const prefixStr = `${code} - `;
    const clicked = await page.evaluate((pfx) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      const walker = document.createTreeWalker(modal, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const tx = node.textContent?.trim();
        if (tx && tx.startsWith(pfx)) {
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
    }, prefixStr);

    if (!clicked) throw new Error(`Currency "${code}" not found in dropdown`);
    await sleep(500);
  }

  async function clickConfirm(page) {
    await clickTestId(page, 'page-footer-confirm', { delay: 1500 });
  }

  /** Get the currency symbol shown on wallet header. */
  async function getWalletSymbol(page) {
    return page.evaluate(() => {
      const header = document.querySelector('[data-testid="Wallet-Tab-Header"]');
      if (!header) return null;
      const text = header.textContent?.trim() || '';
      const m = text.match(/^([¥$€£A-Z]{1,3})/);
      return m ? m[1] : text.substring(0, 3);
    });
  }

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

  async function clearCurrencySearch(page) {
    await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const inp = modal?.querySelector('input');
      if (inp) { inp.focus(); inp.select(); }
    });
    await page.keyboard.press('Backspace');
    await sleep(1000);
  }

  async function testCurrencySwitch(page) {
    const t = createStepTracker(`${prefix}-002`);

    // Step 1: Open preferences → currency dropdown, verify list renders
    await safeStep(page, t, '打开法币列表 + 渲染验证', async () => {
      await openSettings(page);
      await _openCurrencyDropdown(page);

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
      await openSettings(page);
      await _openCurrencyDropdown(page);
      await clickCurrencyRow(page, 'EUR');
      await clickConfirm(page);
      await sleep(1000);
      const symbol = await getWalletSymbol(page);
      if (symbol !== '€') throw new Error(`Expected "€", got "${symbol}"`);
      return `symbol: ${symbol}`;
    }, SCREENSHOT_DIR);

    // Step 6: Restore CNY → confirm → verify ¥
    await safeStep(page, t, '恢复 CNY + 验证 ¥', async () => {
      await openSettings(page);
      await _openCurrencyDropdown(page);
      await clickCurrencyRow(page, 'CNY');
      await clickConfirm(page);
      await sleep(1000);
      const symbol = await getWalletSymbol(page);
      if (symbol !== '¥') throw new Error(`Expected "¥", got "${symbol}"`);
      return `symbol: ${symbol}`;
    }, SCREENSHOT_DIR);

    return t.result();
  }

  const testCases = [
    { id: `${prefix}-002`, name: `${namePrefix}设置-切换法币`, fn: testCurrencySwitch },
  ];

  async function setup(page) {
    await sleep(0);
  }

  return { testCases, setup };
}
