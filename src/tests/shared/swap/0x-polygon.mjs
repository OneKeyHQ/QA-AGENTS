// Swap 0x Polygon — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/swap/0x-polygon.test.mjs
//   src/tests/web/swap/0x-polygon.test.mjs
//   src/tests/extension/swap/0x-polygon.test.mjs
// inject platform-specific CDP connect + goToSwap, then call
// createSwap0xPolygonTests() to get 3 test cases prefixed for their platform.
//
// Coverage:
// - SWAP-0X-POLYGON-001: Polygon 同链 POL→USDC (0x)
// - SWAP-0X-POLYGON-002: Polygon 同链 USDC→POL (0x)
// - SWAP-0X-POLYGON-003: Polygon 同链 USDC→USDT (0x, click 最大)
//
// Replay notes:
// - CDP Electron + React input: use locator.pressSequentially(), avoid keyboard.type()
// - Modal actions must be scoped to [data-testid="APP-Modal-Screen"]
// - Web / Extension may not be able to complete signing flow (no hardware/sign popup);
//   the wrapper can pass a `previewOnly: true` flag to skip 确认/完成.

import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

/**
 * Build the 3 Swap 0x Polygon test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'SWAP-0X-POLYGON' | 'WEB-SWAP-0X-POLYGON' | 'EXT-SWAP-0X-POLYGON'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.goToSwap
 *   Navigate to the swap page on Polygon network (i.e. `[data-testid="swap-content-container"]` visible
 *   with Polygon selected).
 * @param {boolean} [opts.previewOnly] - If true, stop at 预览 step (no 确认/完成). Useful for
 *   platforms where the signing flow cannot be exercised in this run.
 * @param {string} [opts.screenshotDir] - Directory for failure screenshots
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createSwap0xPolygonTests({
  prefix,
  namePrefix = '',
  goToSwap,
  previewOnly = false,
  screenshotDir,
}) {

  // ── Helpers ────────────────────────────────────────────────

  async function ensureSwapReady(page) {
    const ok = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="swap-content-container"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (ok) return true;
    await goToSwap(page);
    // After navigation, wait for the container
    for (let i = 0; i < 30; i++) {
      const visible = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="swap-content-container"]');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (visible) { await sleep(800); return true; }
      await sleep(500);
    }
    throw new Error('Swap container did not become visible');
  }

  async function focusAndClearAmountInput(page) {
    const input = page.locator('input[placeholder="0.0"]:visible').first();
    await input.waitFor({ state: 'visible', timeout: 8000 });
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('input[placeholder="0.0"]'));
      const el = els.find((x) => {
        const r = x.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (el) { el.focus(); el.select?.(); }
    });
    await page.keyboard.press('Backspace').catch(() => {});
    await sleep(200);
    return input;
  }

  async function setAmount(page, value) {
    const input = await focusAndClearAmountInput(page);
    await input.pressSequentially(String(value), { delay: 40 });
    await sleep(600);
  }

  async function clickTokenSelector(page, which /* 0=from, 1=to */) {
    const ok = await page.evaluate((idx) => {
      const root = document.querySelector('[data-testid="swap-content-container"]');
      if (!root) return false;
      const candidates = [];
      for (const sp of root.querySelectorAll('span')) {
        const t = sp.textContent?.trim() || '';
        if (!t) continue;
        if (!/^[A-Z0-9]{2,6}$/.test(t)) continue;
        const r = sp.getBoundingClientRect();
        if (r.width < 20 || r.height < 18) continue;
        if (t.endsWith('%')) continue;
        if (t === 'Dex' || t === 'Gas') continue;
        candidates.push({ t, x: r.x, y: r.y, w: r.width, h: r.height });
      }
      if (candidates.length < 2) return false;
      candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));
      const target = candidates[idx];
      if (!target) return false;
      for (const sp of root.querySelectorAll('span')) {
        if ((sp.textContent?.trim() || '') !== target.t) continue;
        const r = sp.getBoundingClientRect();
        if (Math.abs(r.x - target.x) < 2 && Math.abs(r.y - target.y) < 2) {
          sp.click();
          return true;
        }
      }
      return false;
    }, which);
    if (!ok) throw new Error(`Cannot open token selector (index=${which})`);
    await sleep(1200);
  }

  async function selectTokenInModal(page, symbol) {
    const direct = await page.evaluate((sym) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      for (const sp of modal.querySelectorAll('span')) {
        if ((sp.textContent || '').trim() !== sym) continue;
        if (isVisible(sp)) { sp.click(); return true; }
      }
      return false;
    }, symbol);
    if (direct) { await sleep(1200); return; }

    const modalAnyInput = page.locator('[data-testid="APP-Modal-Screen"] input:visible').first();
    const hasInput = await modalAnyInput.isVisible({ timeout: 1500 }).catch(() => false);
    if (hasInput) {
      await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        const inputs = Array.from(modal?.querySelectorAll('input') || []);
        const input = inputs.find((x) => {
          const r = x.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (input) { input.focus(); input.select?.(); }
      });
      await page.keyboard.press('Backspace').catch(() => {});
      await sleep(100);
      await modalAnyInput.pressSequentially(symbol, { delay: 40 });
      await sleep(800);
    }

    for (let attempt = 0; attempt < 6; attempt++) {
      const clicked = await page.evaluate((sym) => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return false;
        const isVisible = (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        };
        for (const sp of modal.querySelectorAll('span')) {
          const t = (sp.textContent || '').trim();
          if (t === sym || t.includes(sym)) {
            if (isVisible(sp)) { sp.click(); return true; }
          }
        }
        for (const el of modal.querySelectorAll('div,button')) {
          const t = (el.textContent || '').trim();
          if (!t) continue;
          if (t === sym || t.includes(sym)) {
            if (isVisible(el)) { el.click(); return true; }
          }
        }
        return false;
      }, symbol);
      if (clicked) { await sleep(1200); return; }
      await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (modal) modal.scrollBy(0, 420);
      });
      await sleep(350);
    }

    throw new Error(`Token "${symbol}" not found in modal`);
  }

  async function setPair(page, fromSymbol, toSymbol) {
    await clickTokenSelector(page, 0);
    await selectTokenInModal(page, fromSymbol);
    await clickTokenSelector(page, 1);
    await selectTokenInModal(page, toSymbol);
  }

  async function openProviderModal(page) {
    const ok = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="swap-content-container"]');
      if (!root) return false;
      for (const sp of root.querySelectorAll('span')) {
        const t = sp.textContent?.trim() || '';
        const r = sp.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (t.includes('Dex') || t.includes('DEX') || t.includes('聚合')) { sp.click(); return true; }
      }
      return false;
    });
    if (!ok) {
      const icon = page.locator('[data-testid="swap-content-container"] img').first();
      await icon.click({ timeout: 3000 });
    }
    await sleep(1200);
  }

  async function selectProvider0x(page) {
    await openProviderModal(page);
    const clicked = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      for (const sp of modal.querySelectorAll('span,div,button')) {
        const t = sp.textContent?.trim() || '';
        if (t === '0x') {
          const r = sp.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { sp.click(); return true; }
        }
      }
      for (const el of modal.querySelectorAll('span,div,button')) {
        const t = el.textContent?.trim() || '';
        if (!t.includes('0x')) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { el.click(); return true; }
      }
      return false;
    });
    if (!clicked) throw new Error('Provider "0x" not found in provider modal');
    await sleep(1200);
  }

  async function clickModalText(page, text) {
    const clicked = await page.evaluate((txt) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      for (const sp of modal.querySelectorAll('span,button,div')) {
        const t = sp.textContent?.trim() || '';
        if (t === txt) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { sp.click(); return true; }
        }
      }
      return false;
    }, text);
    if (!clicked) throw new Error(`Modal action "${text}" not found`);
    await sleep(1500);
  }

  async function previewAndConfirm(page) {
    await clickModalText(page, '预览');
    if (previewOnly) return;
    await clickModalText(page, '确认');
    await clickModalText(page, '完成');
  }

  async function assertProvider0xVisible(page) {
    const ok = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="swap-content-container"]');
      if (!root) return false;
      return (root.textContent || '').includes('0x');
    });
    if (!ok) throw new Error('0x not visible in swap content');
  }

  // ── Test Cases ─────────────────────────────────────────────

  async function testSwap001(page) {
    const t = createStepTracker(`${prefix}-001`);

    if (!await safeStep(page, t, '进入 Swap（Polygon 网络）', async () => {
      await ensureSwapReady(page);
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, '设置交易对：POL → USDC', async () => {
      await setPair(page, 'POL', 'USDC');
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, '输入金额：1', async () => {
      await setAmount(page, '1');
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, '选择渠道：0x', async () => {
      await selectProvider0x(page);
      await assertProvider0xVisible(page);
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, previewOnly ? '预览' : '预览→确认→完成', async () => {
      await previewAndConfirm(page);
    }, screenshotDir)) return t.result();

    return t.result();
  }

  async function testSwap002(page) {
    const t = createStepTracker(`${prefix}-002`);

    if (!await safeStep(page, t, '进入 Swap（Polygon 网络）', async () => {
      await ensureSwapReady(page);
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, '设置交易对：USDC → POL', async () => {
      await setPair(page, 'USDC', 'POL');
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, '输入金额：0.1', async () => {
      await setAmount(page, '0.1');
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, '选择渠道：0x', async () => {
      await selectProvider0x(page);
      await assertProvider0xVisible(page);
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, previewOnly ? '预览' : '预览→确认→完成', async () => {
      await previewAndConfirm(page);
    }, screenshotDir)) return t.result();

    return t.result();
  }

  async function testSwap003(page) {
    const t = createStepTracker(`${prefix}-003`);

    if (!await safeStep(page, t, '进入 Swap（Polygon 网络）', async () => {
      await ensureSwapReady(page);
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, '设置交易对：USDC → USDT', async () => {
      await setPair(page, 'USDC', 'USDT');
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, '点击最大', async () => {
      const ok = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="swap-content-container"]');
        if (!root) return false;
        for (const sp of root.querySelectorAll('span')) {
          if (sp.textContent?.trim() === '最大' && sp.getBoundingClientRect().width > 0) { sp.click(); return true; }
        }
        return false;
      });
      if (!ok) throw new Error('Max button not found');
      await sleep(600);
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, '选择渠道：0x', async () => {
      await selectProvider0x(page);
      await assertProvider0xVisible(page);
    }, screenshotDir)) return t.result();

    if (!await safeStep(page, t, previewOnly ? '预览' : '预览→确认→完成', async () => {
      await previewAndConfirm(page);
    }, screenshotDir)) return t.result();

    return t.result();
  }

  // ── Registry ───────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}Polygon 同链：POL→USDC（0x）`, fn: testSwap001 },
    { id: `${prefix}-002`, name: `${namePrefix}Polygon 同链：USDC→POL（0x）`, fn: testSwap002 },
    { id: `${prefix}-003`, name: `${namePrefix}Polygon 同链：USDC→USDT（0x）`, fn: testSwap003 },
  ];

  async function setup(page) {
    await goToSwap(page);
    await sleep(2000);
  }

  return { testCases, setup };
}
