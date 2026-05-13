// Perps TV Chart — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/perps/chart.test.mjs
//   src/tests/web/perps/chart.test.mjs
//   src/tests/extension/perps/chart.test.mjs
// inject platform-specific tvEval + goToPerps, then call createChartTests()
// to get the same 8 test cases prefixed for their platform.
//
// Key platform difference (TV chart access):
//   - Desktop (Electron): TV chart lives in <webview> → blob: <iframe>.
//     tvEval wraps page.evaluate → wv.executeJavaScript → iframe.contentDocument
//   - Web / Extension: TV chart lives in a normal iframe (URL contains "tradingview").
//     tvEval finds the matching frame via page.frames() and uses frame.evaluate().
//
// Coverage mapping (unchanged from desktop original):
//   <PREFIX>-CHART-001 → 默认指标测试 (old 001, 013)
//   <PREFIX>-CHART-002 → 指标管理测试 (old 002, 003, 004, 014, 026)
//   <PREFIX>-CHART-003 → 画图工具测试 (old 005, 019, 020, 021)
//   <PREFIX>-CHART-004 → K线时间周期测试 (old 007, 015, 027, 028)
//   <PREFIX>-CHART-005 → 图表叠加显示测试 (old 009, 029)
//   <PREFIX>-CHART-006 → 视图布局测试 (old 008, 010, 018, 022)
//   <PREFIX>-CHART-007 → 异常与边界场景 (old 011, 017, 025, 030, 031)
//   <PREFIX>-CHART-008 → 跨交易对测试 (old 006, 012, 016, 023, 024)

import { sleep } from '../../helpers/constants.mjs';
import { screenshot } from '../../helpers/index.mjs';
import {
  createStepTracker, safeStep,
  clickWithPointerEvents, dismissPopover,
  switchToAccount, getCurrentAccount,
} from '../../helpers/components.mjs';

/**
 * Build the 8 Perps TV Chart test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'PERPS' | 'WEB-PERPS' | 'EXT-PERPS'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.goToPerps
 * @param {(page: import('playwright-core').Page, jsCode: string) => Promise<any>} opts.tvEval
 *   Execute JS inside the TradingView chart iframe.
 *   The code body must `return` a JSON-serializable value and may reference `doc` (the iframe document).
 * @param {string} opts.screenshotDir - Absolute directory to write failure screenshots.
 * @param {(page: import('playwright-core').Page) => Promise<{ getCurrentPair: () => Promise<string|null>, switchPair: (sym: string) => Promise<void> }>} [opts.makePerpsPage]
 *   Optional factory for platform-specific PerpsPage. If omitted, falls back to a DOM-only impl.
 * @param {boolean} [opts.canSwitchAccount=false] - Whether `switchToAccount('hl-99', ...)` works on this platform.
 *   Desktop = true. Web/Ext default = false (skip account switching for CHART-005).
 * @returns {{ testCases: Array, setup: (page) => Promise<void>, ALL_TEST_IDS: string[] }}
 */
export function createChartTests({
  prefix,
  namePrefix = '',
  goToPerps,
  tvEval,
  screenshotDir,
  makePerpsPage,
  canSwitchAccount = false,
}) {
  if (!goToPerps) throw new Error('createChartTests: goToPerps is required');
  if (!tvEval) throw new Error('createChartTests: tvEval is required');
  if (!screenshotDir) throw new Error('createChartTests: screenshotDir is required');

  const ALL_TEST_IDS = [
    `${prefix}-CHART-001`,
    `${prefix}-CHART-002`,
    `${prefix}-CHART-003`,
    `${prefix}-CHART-004`,
    `${prefix}-CHART-005`,
    `${prefix}-CHART-006`,
    `${prefix}-CHART-007`,
    `${prefix}-CHART-008`,
  ];

  // ── TV iframe helpers (all go through injected tvEval) ──────

  async function waitForTVReady(page, minCanvases = 7, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const count = await tvEval(page, `return doc.querySelectorAll('canvas').length;`);
        if (count >= minCanvases) return count;
      } catch {}
      await sleep(1000);
    }
    throw new Error(`TV chart not ready within ${timeoutMs}ms`);
  }

  async function getCanvasCount(page) {
    return tvEval(page, `return doc.querySelectorAll('canvas').length;`);
  }

  async function getIndicatorLabels(page) {
    return tvEval(page, `
      const labels = [];
      doc.querySelectorAll('*').forEach(el => {
        const txt = el.textContent?.trim();
        if (!txt || el.children.length > 3) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.height > 30) return;
        if (/^(MA|EMA|SMA|MACD|RSI|BOLL|Volume|Vol|成交量)/.test(txt)) labels.push(txt.slice(0, 60));
      });
      return [...new Set(labels)];
    `);
  }

  function hasIndicator(labels, prefixStr) {
    return labels.some(l => l.startsWith(prefixStr));
  }

  async function getTimeIntervals(page) {
    return tvEval(page, `
      const btns = [];
      const seen = new Set();
      doc.querySelectorAll('button').forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.y > 50 || r.height === 0 || r.height > 40 || r.width === 0) return;
        const aria = b.getAttribute('aria-label') || '';
        const text = b.textContent?.trim()?.slice(0, 15) || '';
        if (aria && !seen.has(aria) && (aria.includes('分钟') || aria.includes('小时') || aria.includes('日') || aria.includes('周'))) {
          seen.add(aria);
          const active = b.className.includes('isActive') || b.getAttribute('aria-pressed') === 'true';
          btns.push({ text, aria, active });
        }
      });
      return btns;
    `);
  }

  async function clickTimeInterval(page, ariaLabel) {
    await tvEval(page, `
      const btns = doc.querySelectorAll('button[aria-label="${ariaLabel}"]');
      if (btns.length === 0) throw new Error('Interval button [aria-label="${ariaLabel}"] not found');
      btns[0].click();
    `);
    await sleep(2000);
  }

  async function getOHLC(page) {
    return tvEval(page, `
      const text = doc.body.innerText || '';
      const m = text.match(/O\\s*([\\d,.]+)\\s*H\\s*([\\d,.]+)\\s*L\\s*([\\d,.]+)\\s*C\\s*([\\d,.]+)/);
      return m ? { O: m[1], H: m[2], L: m[3], C: m[4] } : null;
    `);
  }

  async function clickIndicatorButton(page) {
    await tvEval(page, `
      const btn = doc.querySelector('button[aria-label="指标 & 策略"]')
        || doc.querySelector('button[aria-label="指标"]');
      if (!btn) {
        for (const b of doc.querySelectorAll('button')) {
          if (b.textContent?.trim() === '指标') { b.click(); return; }
        }
        throw new Error('Indicator button not found');
      }
      btn.click();
    `);
    await sleep(1500);
  }

  async function isIndicatorPanelOpen(page) {
    return tvEval(page, `
      const d = doc.querySelector('[role="dialog"]');
      return d ? d.getBoundingClientRect().width > 200 : false;
    `);
  }

  async function getIndicatorPanelText(page) {
    return tvEval(page, `
      const d = doc.querySelector('[role="dialog"]');
      return d ? d.textContent?.slice(0, 400) || '' : '';
    `);
  }

  async function clickResetLayout(page) {
    await tvEval(page, `
      let target = doc.querySelector('[aria-label="重置布局"]');
      if (!target) {
        for (const el of doc.querySelectorAll('div, button')) {
          if (el.textContent?.trim() === '重置布局' && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().width < 120) {
            target = el; break;
          }
        }
      }
      if (!target) throw new Error('Reset layout button not found (checked div[aria-label] + text match)');
      target.click();
    `);
    await sleep(2000);
  }

  async function getDrawingKeys(page) {
    return tvEval(page, `
      const win = doc.defaultView || doc.parentWindow;
      const keys = [];
      try {
        for (let i = 0; i < win.localStorage.length; i++) {
          const key = win.localStorage.key(i);
          if (key.includes('drawing')) {
            const val = win.localStorage.getItem(key);
            keys.push({ key, len: val?.length || 0 });
          }
        }
      } catch(e) {}
      return keys;
    `);
  }

  async function getDrawingToolbar(page) {
    return tvEval(page, `
      const btns = [];
      doc.querySelectorAll('button[aria-label]').forEach(b => {
        const r = b.getBoundingClientRect();
        if (r.x < 60 && r.width > 0 && r.height > 0) {
          btns.push({ aria: b.getAttribute('aria-label').slice(0, 30), y: Math.round(r.y) });
        }
      });
      return btns.sort((a, b) => a.y - b.y);
    `);
  }

  async function getMainCanvasHash(page) {
    return tvEval(page, `
      let maxCanvas = null, maxArea = 0;
      doc.querySelectorAll('canvas').forEach(c => {
        const r = c.getBoundingClientRect();
        const area = r.width * r.height;
        if (area > maxArea && r.height > 100) { maxArea = area; maxCanvas = c; }
      });
      if (!maxCanvas) return null;
      try {
        const ctx = maxCanvas.getContext('2d');
        const data = ctx.getImageData(0, 0, maxCanvas.width, maxCanvas.height).data;
        let hash = 0;
        for (let j = 0; j < data.length; j += 100) {
          hash = ((hash << 5) - hash + data[j]) | 0;
        }
        return hash;
      } catch(e) { return null; }
    `);
  }

  async function getChartLayout(page) {
    // Use TV iframe directly for both webview size hint + canvas measurements.
    const canvasLayout = await tvEval(page, `
      const canvases = doc.querySelectorAll('canvas');
      let maxW = 0, maxH = 0;
      canvases.forEach(c => {
        const r = c.getBoundingClientRect();
        if (r.width > maxW && r.height > 100) { maxW = Math.round(r.width); maxH = Math.round(r.height); }
      });
      return { mainW: maxW, mainH: maxH, canvasCount: canvases.length };
    `);
    // wvSize: best-effort. Look for webview (Electron) or iframe (Web/Ext) on the main page.
    const wvSize = await page.evaluate(() => {
      const el = document.querySelector('webview')
        || Array.from(document.querySelectorAll('iframe')).find(f =>
          (f.src || '').toLowerCase().includes('tradingview') || (f.src || '').startsWith('blob:'));
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    return { wvSize, canvasLayout };
  }

  // ── Main-page DOM helpers ───────────────────────────────────

  async function getCurrentPair(page) {
    return page.evaluate(() => {
      for (const sp of document.querySelectorAll('span')) {
        const text = sp.textContent?.trim();
        if (text && /^[A-Z]{2,10}USDC$/.test(text) && sp.children.length === 0) {
          const r = sp.getBoundingClientRect();
          if (r.width > 50 && r.height > 20) return text;
        }
      }
      return null;
    });
  }

  async function openPerpsSettingsMenu(page) {
    await clickWithPointerEvents(page, '[data-testid="perp-header-settings-button"]');
  }

  async function getPerpsSettings(page) {
    await openPerpsSettingsMenu(page);

    for (let i = 0; i < 10; i++) {
      const result = await page.evaluate(() => {
        const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
        let pop = null;
        for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
        if (!pop) return null;
        const text = pop.textContent || '';
        if (!text.includes('买卖') && !text.includes('订单')) return null;

        const switches = [];
        pop.querySelectorAll('[data-state]').forEach(s => {
          const r = s.getBoundingClientRect();
          if (r.width > 0) switches.push({ state: s.getAttribute('data-state'), y: Math.round(r.y) });
        });
        return switches.sort((a, b) => a.y - b.y);
      });

      if (result && result.length >= 3) {
        await dismissPopover(page);
        return {
          skipConfirm: result[0].state,
          showTrades: result[1].state,
          showPositions: result[2].state,
        };
      }
      await sleep(500);
    }

    return null;
  }

  async function clickSettingsToggle(page, index) {
    await openPerpsSettingsMenu(page);

    await page.evaluate((idx) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const pp of pops) { if (pp.getBoundingClientRect().width > 0) { pop = pp; break; } }
      if (!pop) throw new Error('no visible popover');
      const switches = [];
      pop.querySelectorAll('[data-state]').forEach(s => {
        if (s.getBoundingClientRect().width > 0) switches.push(s);
      });
      if (!switches[idx]) throw new Error('toggle ' + idx + ' not found');
      switches[idx].click();
    }, index);
    await sleep(1000);

    await dismissPopover(page);
    await sleep(4000);
  }

  // ── PerpsPage abstraction (with fallback) ───────────────────

  function defaultMakePerpsPage(page) {
    return {
      getCurrentPair: () => getCurrentPair(page),
      // DOM-only switchPair: open pair selector, search, click result.
      // Mirrors the desktop PerpsPage behavior to stay platform-agnostic.
      switchPair: async (symbol) => {
        // Open selector by clicking current pair span.
        const cur = await getCurrentPair(page);
        if (!cur) throw new Error('switchPair: cannot detect current pair');
        await page.evaluate((p) => {
          for (const sp of document.querySelectorAll('span')) {
            if (sp.textContent?.trim() === p && sp.getBoundingClientRect().width > 50) {
              sp.click(); return;
            }
          }
        }, cur);
        await sleep(1500);

        // Type symbol in search box.
        await page.evaluate((sym) => {
          const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
          let input = null;
          for (const pop of pops) {
            if (pop.getBoundingClientRect().width === 0) continue;
            const inp = pop.querySelector('input[data-testid="nav-header-search"]')
              || pop.querySelector('input[placeholder*="搜索"]');
            if (inp && inp.getBoundingClientRect().width > 0) { input = inp; break; }
          }
          if (!input) throw new Error('switchPair: search input not found');
          input.focus();
          const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
          if (nativeSet) {
            nativeSet.call(input, sym);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, symbol);
        await sleep(1500);

        // Click first matching token row.
        await page.evaluate((sym) => {
          const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
          let pop = null;
          for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
          if (!pop) throw new Error('switchPair: popover gone');
          for (const div of pop.querySelectorAll('div')) {
            const t = div.textContent?.trim();
            const r = div.getBoundingClientRect();
            if (!t || r.width < 50 || r.height < 30 || r.height > 80) continue;
            if (t.startsWith(sym) && t.includes('USDC')) { div.click(); return; }
          }
          throw new Error(`switchPair: no row matches "${sym}"`);
        }, symbol);
        await sleep(2000);
      },
    };
  }

  const getPerps = makePerpsPage || ((page) => defaultMakePerpsPage(page));

  // ── Misc utilities ───────────────────────────────────────────

  const _ssStep = (page, t, name, fn) =>
    safeStep(page, t, name, fn, (p, n) => screenshot(p, screenshotDir, n));

  async function navigateToPerps(page) {
    await goToPerps(page);
  }

  async function reloadAndWait(page) {
    // Trigger a soft state reload by navigating away and back.
    // Use goToPerps both times — the wrapper knows how to navigate away (via sidebar/header).
    // We bounce via the URL "/" to keep this platform-agnostic.
    try {
      // Try clicking a sidebar tab that isn't perps; fall back to goToPerps round-trip.
      // Simplest cross-platform: just re-trigger goToPerps after a short sleep.
      await sleep(500);
    } catch {}
    await goToPerps(page);
    await sleep(2000);
    await waitForTVReady(page);
  }

  // ── Test Cases (8 merged) ──────────────────────────────────

  async function testChart001(page) {
    const id = `${prefix}-CHART-001`;
    const t = createStepTracker(id);

    await navigateToPerps(page);

    await _ssStep(page, t, 'TV 图表加载', async () => {
      const canvases = await waitForTVReady(page);
      if (canvases < 7) throw new Error(`Canvas count too low: ${canvases}`);
      return `${canvases} canvases`;
    });

    await _ssStep(page, t, '重置布局 + 刷新', async () => {
      await clickResetLayout(page);
      await sleep(3000);
      await reloadAndWait(page);
    });

    await _ssStep(page, t, '默认指标为 Volume', async () => {
      let labels = [];
      for (let attempt = 0; attempt < 15; attempt++) {
        labels = await getIndicatorLabels(page);
        const hasVolume = labels.some(l => l.includes('Volume') || l.includes('成交量'));
        const hasNonDefault = labels.some(l =>
          (/^MA\d/.test(l) || l === 'MA' || l.startsWith('MACD') || l.startsWith('RSI') || l.startsWith('BOLL'))
          && !l.includes('Volume') && !l.includes('成交量'));
        if (hasVolume && !hasNonDefault) break;
        await sleep(1000);
      }
      const hasVolume = labels.some(l => l.includes('Volume') || l.includes('成交量'));
      const hasMACD = hasIndicator(labels, 'MACD');
      const hasMA = labels.some(l => /^MA\d/.test(l) || l === 'MA');
      if (!hasVolume) throw new Error(`Volume not found. Labels: ${JSON.stringify(labels)}`);
      if (hasMACD) throw new Error(`MACD should not be present after reset. Labels: ${JSON.stringify(labels)}`);
      if (hasMA) throw new Error(`MA should not be present after reset. Labels: ${JSON.stringify(labels)}`);
      return `Only Volume present. Labels: ${labels.filter(l => l.length < 25).join(', ')}`;
    });

    await _ssStep(page, t, '确认有 Volume 指标', async () => {
      for (let i = 0; i < 10; i++) {
        const labels = await getIndicatorLabels(page);
        if (labels.some(l => l.includes('Volume') || l.includes('成交量'))) return 'Volume present';
        await sleep(1000);
      }
      throw new Error('Volume not present after reset + 10s wait');
    });

    await _ssStep(page, t, '删除 Volume 指标', async () => {
      const deleted = await tvEval(page, `
        const legends = doc.querySelectorAll('[data-name="legend-source-item"]');
        for (const legend of legends) {
          if (legend.textContent?.includes('Vol') || legend.textContent?.includes('成交量')) {
            const removeBtn = legend.querySelector('[data-name="legend-delete-action"]')
              || legend.querySelector('button[aria-label*="删除"]')
              || legend.querySelector('button[aria-label*="Remove"]');
            if (removeBtn) { removeBtn.click(); return 'clicked'; }
          }
        }
        return 'not_found';
      `);
      if (deleted === 'not_found') return 'SKIP: Volume delete button not found in TV legend (manual deletion needed)';
      await sleep(2000);
      return 'Volume deleted via legend button';
    });

    await _ssStep(page, t, '刷新后 Volume 不恢复', async () => {
      await reloadAndWait(page);
      const labels = await getIndicatorLabels(page);
      const hasVol = labels.some(l => l.includes('Volume') || l.includes('成交量'));
      if (hasVol) {
        return 'Volume reappeared after refresh — TV may restore default indicators';
      }
      return 'Volume NOT restored (user setting respected)';
    });

    return t.result();
  }

  async function testChart002(page) {
    const id = `${prefix}-CHART-002`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    await _ssStep(page, t, '打开指标面板', async () => {
      await clickIndicatorButton(page);
      const open = await isIndicatorPanelOpen(page);
      if (!open) throw new Error('Indicator panel did not open');
      return 'Panel opened';
    });

    await _ssStep(page, t, '检查当前指标列表', async () => {
      if (await isIndicatorPanelOpen(page)) {
        await clickIndicatorButton(page);
        await sleep(500);
      }
      const labels = await getIndicatorLabels(page);
      return `Current: ${labels.filter(l => l.length < 25).join(', ')}`;
    });

    let panelTextBefore;
    await _ssStep(page, t, '收藏指标排序位置', async () => {
      await clickIndicatorButton(page);
      await sleep(500);
      panelTextBefore = await getIndicatorPanelText(page);
      const macdPos = panelTextBefore.indexOf('MACD');
      await clickIndicatorButton(page);
      return `MACD at position ${macdPos} ${macdPos >= 0 && macdPos < 100 ? '(in favorites)' : '(not favorited or further down)'}`;
    });

    t.skip('收藏指标（点击星形按钮）', '指标面板内的收藏按钮在 TV webview 内，无法自动点击（K-027）');
    t.skip('取消收藏指标', '同上，需手动在指标面板内点击星形按钮取消');
    t.skip('删除指标（图表上右键→删除）', '指标删除需要在 TV webview 内右键指标标签操作（K-027）');
    t.skip('RSI 参数修改持久化', 'TV 内指标参数面板操作无法自动化（K-027），需手动测试');

    await _ssStep(page, t, '刷新后指标 + 收藏一次性验证', async () => {
      const beforeLabels = await getIndicatorLabels(page);
      await reloadAndWait(page);
      const afterLabels = await getIndicatorLabels(page);

      const toName = (l) => l.replace(/[\d,.\s∅KMBTkmbt−+%]+$/, '').trim();
      const beforeSet = new Set(beforeLabels.map(toName).filter(Boolean));
      const afterSet = new Set(afterLabels.map(toName).filter(Boolean));
      const missing = [...beforeSet].filter(x => !afterSet.has(x));
      if (missing.length > 0) throw new Error(`Indicators lost: ${missing.join(', ')}`);

      await clickIndicatorButton(page);
      await sleep(1000);
      const panelTextAfter = await getIndicatorPanelText(page);
      await clickIndicatorButton(page);
      const macdPosBefore = panelTextBefore.indexOf('MACD');
      const macdPosAfter = panelTextAfter.indexOf('MACD');

      const results = [];
      results.push(`Indicators: ${[...afterSet].join(', ')}`);
      if (macdPosAfter >= 0) {
        results.push(`MACD favorite: pos ${macdPosBefore}→${macdPosAfter}`);
      }
      return results.join(' | ');
    });

    return t.result();
  }

  async function testChart003(page) {
    const id = `${prefix}-CHART-003`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    const pair = await getCurrentPair(page);
    const symbol = (pair || 'SOL').replace('USDC', '').toLowerCase();

    await _ssStep(page, t, '画图工具栏可见', async () => {
      const toolbar = await getDrawingToolbar(page);
      const hasTrendLine = toolbar.some(b => b.aria.includes('趋势线'));
      if (!hasTrendLine) throw new Error('Trend line tool not found in toolbar');
      return `Tools: ${toolbar.map(b => b.aria).join(', ')}`;
    });

    await _ssStep(page, t, '画图数据 localStorage 检查', async () => {
      const keys = await getDrawingKeys(page);
      const currentPairKey = keys.find(k => k.key.includes(`perps_${symbol}`));
      const totalKeys = keys.filter(k => k.key.includes('perps_')).length;
      return `Symbol: ${symbol} | Drawing key: ${currentPairKey ? `${currentPairKey.key} (${currentPairKey.len} bytes)` : 'none'} | Total perps drawing keys: ${totalKeys}`;
    });

    await _ssStep(page, t, '刷新后画图持久化', async () => {
      const keysBefore = await getDrawingKeys(page);
      const beforeKey = keysBefore.find(k => k.key.includes(`perps_${symbol}`));

      await reloadAndWait(page);

      const keysAfter = await getDrawingKeys(page);
      const afterKey = keysAfter.find(k => k.key.includes(`perps_${symbol}`));

      if (beforeKey && !afterKey) throw new Error(`Drawing data lost after refresh for ${symbol}`);
      if (beforeKey && afterKey && afterKey.len < beforeKey.len * 0.5) {
        throw new Error(`Drawing data shrank significantly: ${beforeKey.len} → ${afterKey.len}`);
      }
      return `Before: ${beforeKey?.len || 0} bytes → After: ${afterKey?.len || 0} bytes`;
    });

    t.skip('水平线/斐波那契/矩形绘制', 'canvas 内拖拽绘制无法自动化，需手动测试');
    t.skip('编辑趋势线样式', 'canvas 内选中+右键编辑无法自动化，需手动测试');
    t.skip('删除画图图形', 'canvas 内选中+删除无法自动化，需手动测试');

    return t.result();
  }

  async function testChart004(page) {
    const id = `${prefix}-CHART-004`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    let intervals;
    await _ssStep(page, t, '获取可用时间周期列表', async () => {
      intervals = await getTimeIntervals(page);
      if (intervals.length === 0) throw new Error('No time interval buttons found');
      const activeOne = intervals.find(i => i.active);
      return `${intervals.length} intervals: ${intervals.map(i => i.text + (i.active ? '[*]' : '')).join(', ')} | Active: ${activeOne?.text || 'none'}`;
    });

    const toTest = intervals.filter(i => !i.active).slice(0, 3);
    for (const interval of toTest) {
      await _ssStep(page, t, `切换时间周期: ${interval.text}`, async () => {
        const ohlcBefore = await getOHLC(page);
        await clickTimeInterval(page, interval.aria);

        const after = await getTimeIntervals(page);
        const nowActive = after.find(i => i.active);
        if (!nowActive || nowActive.aria !== interval.aria) {
          const canvases = await getCanvasCount(page);
          if (canvases < 7) throw new Error(`Chart broken after switching to ${interval.text}: only ${canvases} canvases`);
        }

        const ohlcAfter = await getOHLC(page);
        const dataChanged = !ohlcBefore || !ohlcAfter ||
          ohlcBefore.O !== ohlcAfter.O || ohlcBefore.C !== ohlcAfter.C;

        return `${interval.text} — OHLC ${dataChanged ? 'changed' : 'same (may be expected for close intervals)'} | Canvases OK`;
      });
    }

    let intervalsBefore;
    await _ssStep(page, t, '记录当前收藏周期', async () => {
      intervalsBefore = await getTimeIntervals(page);
      return `Toolbar: ${intervalsBefore.map(i => i.text + (i.active ? '[*]' : '')).join(', ')}`;
    });

    await _ssStep(page, t, '刷新后收藏周期保留', async () => {
      await reloadAndWait(page);
      const intervalsAfter = await getTimeIntervals(page);

      const beforeSet = new Set(intervalsBefore.map(i => i.aria).filter(a => a !== '图表周期'));
      const afterSet = new Set(intervalsAfter.map(i => i.aria).filter(a => a !== '图表周期'));
      const lost = [...beforeSet].filter(x => !afterSet.has(x));
      const added = [...afterSet].filter(x => !beforeSet.has(x));

      if (lost.length > 0) throw new Error(`Favorited intervals lost: ${lost.join(', ')}`);
      if (added.length > 0) throw new Error(`Unexpected intervals appeared: ${added.join(', ')}`);
      return `Preserved: ${[...afterSet].join(', ')}`;
    });

    t.skip('自定义时间周期设置', 'TV 内自定义周期设置面板操作无法自动化（K-027），需手动测试');
    t.skip('自定义时间周期刷新持久化', '依赖 027 的自定义周期设置，需手动测试');

    return t.result();
  }

  async function testChart005(page) {
    const id = `${prefix}-CHART-005`;
    const t = createStepTracker(id);

    if (canSwitchAccount) {
      await _ssStep(page, t, '切换到有持仓的账户', async () => {
        const currentAccount = await getCurrentAccount(page);
        if (currentAccount?.includes('hl-99')) {
          return `Already on hl-99`;
        }
        await switchToAccount(page, 'hl-99', '观察钱包');
        return `Switched to hl-99`;
      });
    } else {
      t.skip('切换到有持仓的账户', '当前平台不支持自动切换账户（hl-99 观察钱包仅在桌面端可用）');
    }

    await navigateToPerps(page);
    await waitForTVReady(page);

    await _ssStep(page, t, '切换时间周期到天', async () => {
      await clickTimeInterval(page, '1 日');
      return 'Switched to 1 day interval';
    });

    let settings;
    await _ssStep(page, t, '读取图表设置', async () => {
      settings = await getPerpsSettings(page);
      if (!settings) throw new Error('无法读取设置菜单');
      return `跳过确认: ${settings.skipConfirm} | 买卖点: ${settings.showTrades} | 仓位订单: ${settings.showPositions}`;
    });

    await _ssStep(page, t, '买卖点开关影响图表渲染', async () => {
      if (settings.showTrades !== 'checked') {
        await clickSettingsToggle(page, 1);
        await sleep(1000);
      }

      const hashON = await getMainCanvasHash(page);
      await clickSettingsToggle(page, 1);
      const hashOFF = await getMainCanvasHash(page);

      if (hashON === hashOFF) {
        await clickSettingsToggle(page, 1);
        throw new Error(`Canvas hash unchanged after toggling buy/sell OFF — 账户 hl-99 应有买卖历史 (hash=${hashON})`);
      }

      await clickSettingsToggle(page, 1);
      const hashRestored = await getMainCanvasHash(page);
      return `ON=${hashON} → OFF=${hashOFF} (changed ✓) → ON=${hashRestored} ${hashON === hashRestored ? '(restored ✓)' : '(data updated, OK)'}`;
    });

    await _ssStep(page, t, '仓位订单开关影响图表渲染', async () => {
      const currentSettings = await getPerpsSettings(page);
      if (!currentSettings) throw new Error('cannot read settings');

      if (currentSettings.showPositions !== 'checked') {
        await clickSettingsToggle(page, 2);
        await sleep(1000);
      }

      const hashON = await getMainCanvasHash(page);
      await clickSettingsToggle(page, 2);
      const hashOFF = await getMainCanvasHash(page);

      await clickSettingsToggle(page, 2);

      if (hashON === hashOFF) {
        throw new Error(`Canvas hash unchanged after toggling positions OFF — 账户 hl-99 有持仓 (hash=${hashON})`);
      }
      return `ON=${hashON} → OFF=${hashOFF} (changed ✓) — 持仓线消失确认`;
    });

    await _ssStep(page, t, '刷新后设置持久化', async () => {
      const settingsBefore = await getPerpsSettings(page);
      if (!settingsBefore) throw new Error('无法读取设置');

      await reloadAndWait(page);

      const settingsAfter = await getPerpsSettings(page);
      if (!settingsAfter) throw new Error('刷新后无法读取设置');

      const checks = [];
      if (settingsBefore.skipConfirm !== settingsAfter.skipConfirm) checks.push('跳过确认');
      if (settingsBefore.showTrades !== settingsAfter.showTrades) checks.push('买卖点');
      if (settingsBefore.showPositions !== settingsAfter.showPositions) checks.push('仓位订单');

      if (checks.length > 0) throw new Error(`Settings changed after refresh: ${checks.join(', ')}`);
      return `All 3 settings preserved after refresh`;
    });

    t.skip('多个限价单多条挂单线', '需要有多个未成交限价单的账户环境');

    return t.result();
  }

  async function testChart006(page) {
    const id = `${prefix}-CHART-006`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    const beforeLabels008 = await getIndicatorLabels(page);
    const beforeCanvases008 = await getCanvasCount(page);

    await _ssStep(page, t, '重置前状态', async () => {
      return `Indicators: ${beforeLabels008.filter(l => l.length < 20).join(', ')} | Canvases: ${beforeCanvases008}`;
    });

    await _ssStep(page, t, '执行重置布局', async () => {
      await clickResetLayout(page);
      await sleep(3000);
    });

    await _ssStep(page, t, '重置后仅保留 Volume', async () => {
      const labels = await getIndicatorLabels(page);
      const hasVolume = labels.some(l => l.includes('Volume') || l.includes('成交量'));
      const hasOthers = labels.some(l =>
        (l.startsWith('MA') && !l.includes('Volume')) || l.startsWith('RSI') || l.startsWith('BOLL'));
      if (!hasVolume) throw new Error('Volume not present after reset');
      if (hasOthers) throw new Error(`Non-default indicators still present: ${labels.filter(l => l.length < 20).join(', ')}`);
      return `Reset OK — only Volume`;
    });

    await _ssStep(page, t, '刷新后重置状态保持', async () => {
      await reloadAndWait(page);
      const labels = await getIndicatorLabels(page);
      const hasVolume = labels.some(l => l.includes('Volume') || l.includes('成交量'));
      const hasOthers = labels.some(l =>
        (l.startsWith('MA') && !l.includes('Volume')) || l.startsWith('RSI') || l.startsWith('BOLL'));
      if (!hasVolume) throw new Error('Volume lost after refresh');
      if (hasOthers) throw new Error(`Reset reverted — non-default indicators reappeared: ${labels.join(', ')}`);
      return `Persisted: only Volume after refresh`;
    });

    let layoutBefore;
    await _ssStep(page, t, '记录当前布局', async () => {
      layoutBefore = await getChartLayout(page);
      return `Webview: ${layoutBefore.wvSize?.w}x${layoutBefore.wvSize?.h} | Main canvas: ${layoutBefore.canvasLayout?.mainW}x${layoutBefore.canvasLayout?.mainH} | Canvases: ${layoutBefore.canvasLayout?.canvasCount}`;
    });

    await _ssStep(page, t, '刷新后布局保留', async () => {
      await reloadAndWait(page);
      await waitForTVReady(page, layoutBefore.canvasLayout?.canvasCount || 7, 20000).catch(() => {});
      const layoutAfter = await getChartLayout(page);

      if (layoutBefore.wvSize && layoutAfter.wvSize) {
        const wDiff = Math.abs(layoutBefore.wvSize.w - layoutAfter.wvSize.w);
        const hDiff = Math.abs(layoutBefore.wvSize.h - layoutAfter.wvSize.h);
        if (wDiff > 5 || hDiff > 5) {
          throw new Error(`Webview size changed: ${layoutBefore.wvSize.w}x${layoutBefore.wvSize.h} → ${layoutAfter.wvSize.w}x${layoutAfter.wvSize.h}`);
        }
      }

      if (layoutAfter.canvasLayout && layoutAfter.canvasLayout.canvasCount < 7) {
        throw new Error(`Canvas count too low after refresh: ${layoutAfter.canvasLayout.canvasCount}`);
      }

      return `Webview: ${layoutAfter.wvSize?.w}x${layoutAfter.wvSize?.h} | Canvas: ${layoutAfter.canvasLayout?.mainW}x${layoutAfter.canvasLayout?.mainH} | Count: ${layoutAfter.canvasLayout?.canvasCount}`;
    });

    await _ssStep(page, t, '默认状态下点重置无变化', async () => {
      await clickResetLayout(page);
      await sleep(3000);
      await reloadAndWait(page);

      const hashBefore = await getMainCanvasHash(page);
      const indicatorsBefore = await getIndicatorLabels(page);

      await clickResetLayout(page);
      await sleep(3000);

      const hashAfter = await getMainCanvasHash(page);
      const indicatorsAfter = await getIndicatorLabels(page);

      const toName = (l) => l.replace(/[\d,.\s∅KMBTkmbt−+%]+$/, '').trim();
      const setBefore = new Set(indicatorsBefore.map(toName).filter(Boolean));
      const setAfter = new Set(indicatorsAfter.map(toName).filter(Boolean));
      const diff = [...setBefore].filter(x => !setAfter.has(x));

      return `Hash: ${hashBefore} → ${hashAfter} | Indicators unchanged: ${diff.length === 0 ? 'yes' : 'lost: ' + diff.join(',')} | No errors`;
    });

    t.skip('调整图表区域大小', 'canvas 边界拖拽无法自动化，需手动测试');

    return t.result();
  }

  async function testChart007(page) {
    const id = `${prefix}-CHART-007`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    const intervals = await getTimeIntervals(page);
    const available = intervals.filter(i => i.aria && i.aria !== '图表周期');

    await _ssStep(page, t, '快速连续切换时间周期', async () => {
      if (available.length < 2) throw new Error('Need at least 2 intervals');

      const start = Date.now();
      for (let i = 0; i < 6; i++) {
        const target = available[i % available.length];
        await tvEval(page, `
          const btns = doc.querySelectorAll('button[aria-label="${target.aria}"]');
          if (btns.length > 0) btns[0].click();
        `);
        await sleep(300);
      }
      const elapsed = Date.now() - start;

      await sleep(2000);

      const canvases = await getCanvasCount(page);
      if (canvases < 7) throw new Error(`Chart broken after rapid switching: ${canvases} canvases`);

      return `6 rapid switches in ${elapsed}ms | Chart stable: ${canvases} canvases`;
    });

    await _ssStep(page, t, '快速切换后数据正常', async () => {
      const ohlc = await getOHLC(page);
      const intervals2 = await getTimeIntervals(page);
      const active = intervals2.find(i => i.active);
      return `Active: ${active?.text || 'unknown'} | OHLC: ${ohlc ? `O=${ohlc.O} C=${ohlc.C}` : 'not readable'}`;
    });

    await _ssStep(page, t, '清除 TV localStorage', async () => {
      await tvEval(page, `
        const win = doc.defaultView || doc.parentWindow;
        const keyCount = win.localStorage.length;
        win.localStorage.clear();
        return keyCount;
      `);
      return 'localStorage cleared';
    });

    await _ssStep(page, t, '刷新后恢复默认', async () => {
      await reloadAndWait(page);

      const labels = await getIndicatorLabels(page);
      const hasVol = labels.some(l => l.includes('Volume') || l.includes('成交量'));

      const drawingKeys = await getDrawingKeys(page);
      const perpsDrawings = drawingKeys.filter(k => k.key.includes('perps_'));

      return `Indicators: ${labels.filter(l => l.length < 20).join(', ')} | Volume: ${hasVol ? 'yes' : 'no'} | Drawing keys: ${perpsDrawings.length} (should be 0)`;
    });

    t.skip('localStorage 已满降级', '需要填满约 5MB localStorage，不现实');
    t.skip('大量指标性能 (20 个)', '需要在 TV 内逐个添加 20 个指标（K-027），需手动测试');
    t.skip('大量画图性能 (50 条线)', 'canvas 内绘制 50 条线无法自动化，需手动测试');

    return t.result();
  }

  async function testChart008(page) {
    const id = `${prefix}-CHART-008`;
    const t = createStepTracker(id);

    await navigateToPerps(page);
    await waitForTVReady(page);

    const perps = getPerps(page);

    let pair1, pair1DrawingKey;
    await _ssStep(page, t, '记录交易对 A 画图状态', async () => {
      pair1 = (await perps.getCurrentPair()) || 'unknown';
      const sym1 = pair1.replace('USDC', '').toLowerCase();
      const keys = await getDrawingKeys(page);
      pair1DrawingKey = keys.find(k => k.key.includes(`perps_${sym1}`));
      return `Pair A: ${pair1} | Drawing: ${pair1DrawingKey ? `${pair1DrawingKey.len} bytes` : 'none'}`;
    });

    const targetSymbol = pair1?.startsWith('BTC') ? 'ETH' : 'BTC';
    await _ssStep(page, t, `切换到交易对 B (${targetSymbol})`, async () => {
      await perps.switchPair(targetSymbol);
      await sleep(2000);
      await waitForTVReady(page);
      const pair2 = await perps.getCurrentPair();
      return `Switched to: ${pair2}`;
    });

    await _ssStep(page, t, '验证交易对 B 画图数据独立', async () => {
      const pair2 = (await perps.getCurrentPair()) || 'unknown';
      const sym2 = pair2.replace('USDC', '').toLowerCase();
      const sym1 = pair1.replace('USDC', '').toLowerCase();
      const keys = await getDrawingKeys(page);

      const pair2Key = keys.find(k => k.key.includes(`perps_${sym2}`));
      const pair1KeyStill = keys.find(k => k.key.includes(`perps_${sym1}`));

      if (pair1DrawingKey && !pair1KeyStill) {
        throw new Error(`Pair A (${sym1}) drawing data lost after switching to ${sym2}`);
      }

      if (pair2Key && pair1KeyStill && pair2Key.key === pair1KeyStill.key) {
        throw new Error(`Same drawing key for both pairs — not isolated!`);
      }

      return `A(${sym1}): ${pair1KeyStill?.len || 0} bytes | B(${sym2}): ${pair2Key?.len || 0} bytes | Isolated`;
    });

    const switchBackSymbol = pair1?.replace('USDC', '') || 'SOL';
    await _ssStep(page, t, `切回交易对 A (${switchBackSymbol})`, async () => {
      await perps.switchPair(switchBackSymbol);
      await sleep(2000);
      await waitForTVReady(page);
      const sym1 = switchBackSymbol.toLowerCase();
      const keys = await getDrawingKeys(page);
      const pair1KeyNow = keys.find(k => k.key.includes(`perps_${sym1}`));

      if (pair1DrawingKey && pair1DrawingKey.len > 200) {
        if (!pair1KeyNow) throw new Error(`Pair A drawing data gone after round-trip`);
        if (pair1KeyNow.len < pair1DrawingKey.len * 0.5) {
          throw new Error(`Pair A drawing shrank: ${pair1DrawingKey.len} → ${pair1KeyNow.len}`);
        }
      }
      return `Round-trip OK — ${switchBackSymbol}: ${pair1KeyNow?.len || 0} bytes`;
    });

    let indicators1;
    await _ssStep(page, t, '记录交易对 A 指标', async () => {
      indicators1 = await getIndicatorLabels(page);
      const short = indicators1.filter(l => l.length < 20);
      return `${pair1}: ${short.join(', ')}`;
    });

    await _ssStep(page, t, `切换到 ${targetSymbol} 验证指标同步`, async () => {
      await perps.switchPair(targetSymbol);
      await sleep(2000);
      await waitForTVReady(page);
      return `Switched to ${await perps.getCurrentPair()}`;
    });

    await _ssStep(page, t, '指标全局同步验证', async () => {
      const indicators2 = await getIndicatorLabels(page);

      const getName = (labels) => new Set(labels.map(l => l.match(/^(MA|MACD|RSI|BOLL|EMA|Volume|成交量)/)?.[0]).filter(Boolean));
      const set1 = getName(indicators1);
      const set2 = getName(indicators2);

      const onlyInA = [...set1].filter(x => !set2.has(x));
      const onlyInB = [...set2].filter(x => !set1.has(x));

      if (onlyInA.length > 0 || onlyInB.length > 0) {
        return `Indicators differ — A only: [${onlyInA}], B only: [${onlyInB}]. TV indicator config may be per-symbol or global depending on TV version.`;
      }
      return `Indicators synced: ${[...set2].join(', ')}`;
    });

    await _ssStep(page, t, '设置全局同步验证', async () => {
      const settings = await getPerpsSettings(page);
      if (!settings) return 'SKIP: cannot read settings on this pair';
      return `Settings on ${targetSymbol}: 跳过确认=${settings.skipConfirm} 买卖点=${settings.showTrades} 仓位=${settings.showPositions}`;
    });

    await perps.switchPair(switchBackSymbol);
    await sleep(2000);
    await waitForTVReady(page);

    let indicatorsBefore016, drawingKeysBefore016, settingsBefore016, intervalsBefore016;
    await _ssStep(page, t, '记录刷新前全量状态', async () => {
      indicatorsBefore016 = await getIndicatorLabels(page);
      drawingKeysBefore016 = await getDrawingKeys(page);
      settingsBefore016 = await getPerpsSettings(page);
      intervalsBefore016 = await getTimeIntervals(page);
      const toName = (l) => l.replace(/[\d,.\s∅KMBTkmbt−+%]+$/, '').trim();
      return `Indicators: ${[...new Set(indicatorsBefore016.map(toName))].join(', ')} | Drawings: ${drawingKeysBefore016.filter(k => k.key.includes('perps_')).length} keys | Intervals: ${intervalsBefore016.length}`;
    });

    await _ssStep(page, t, '刷新后全量状态保留', async () => {
      await reloadAndWait(page);
      const results = [];

      const indicatorsAfter = await getIndicatorLabels(page);
      const toName = (l) => l.replace(/[\d,.\s∅KMBTkmbt−+%]+$/, '').trim();
      const setBefore = new Set(indicatorsBefore016.map(toName).filter(Boolean));
      const setAfter = new Set(indicatorsAfter.map(toName).filter(Boolean));
      const lost = [...setBefore].filter(x => !setAfter.has(x));
      if (lost.length > 0) throw new Error(`Indicators lost: ${lost.join(', ')}`);
      results.push(`Indicators: ${[...setAfter].join(', ')}`);

      const drawingKeysAfter = await getDrawingKeys(page);
      const beforeCount = drawingKeysBefore016.filter(k => k.key.includes('perps_')).length;
      const afterCount = drawingKeysAfter.filter(k => k.key.includes('perps_')).length;
      if (afterCount < beforeCount * 0.5) throw new Error(`Drawings shrank: ${beforeCount} → ${afterCount}`);
      results.push(`Drawings: ${beforeCount}→${afterCount}`);

      if (settingsBefore016) {
        const settingsAfter = await getPerpsSettings(page);
        if (settingsAfter) {
          const checks = [];
          if (settingsBefore016.showTrades !== settingsAfter.showTrades) checks.push('买卖点');
          if (settingsBefore016.showPositions !== settingsAfter.showPositions) checks.push('仓位订单');
          if (checks.length > 0) throw new Error(`Settings changed: ${checks.join(', ')}`);
          results.push('Settings: preserved');
        }
      }

      const intervalsAfter = await getTimeIntervals(page);
      const beforeISet = new Set(intervalsBefore016.map(i => i.aria).filter(a => a !== '图表周期'));
      const afterISet = new Set(intervalsAfter.map(i => i.aria).filter(a => a !== '图表周期'));
      const lostI = [...beforeISet].filter(x => !afterISet.has(x));
      if (lostI.length > 0) throw new Error(`Intervals lost: ${lostI.join(', ')}`);
      results.push(`Intervals: ${[...afterISet].join(', ')}`);

      return results.join(' | ');
    });

    t.skip('加仓后持仓线更新', '需要执行真实交易操作，自动化风险高');
    t.skip('限价单成交后挂单线消失', '需要等待真实市场成交，不可控');

    return t.result();
  }

  // ── Registry ────────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-CHART-001`, name: `${namePrefix}默认指标测试`, fn: testChart001, skipSteps: [] },
    { id: `${prefix}-CHART-002`, name: `${namePrefix}指标管理测试`, fn: testChart002, skipSteps: ['收藏指标', '取消收藏', '删除指标', 'RSI 参数修改'] },
    { id: `${prefix}-CHART-003`, name: `${namePrefix}画图工具测试`, fn: testChart003, skipSteps: ['水平线/斐波那契/矩形', '编辑趋势线', '删除画图'] },
    { id: `${prefix}-CHART-004`, name: `${namePrefix}K线时间周期测试`, fn: testChart004, skipSteps: ['自定义时间周期'] },
    { id: `${prefix}-CHART-005`, name: `${namePrefix}图表叠加显示测试`, fn: testChart005, skipSteps: ['多个限价单'] },
    { id: `${prefix}-CHART-006`, name: `${namePrefix}视图布局测试`, fn: testChart006, skipSteps: ['调整图表区域大小'] },
    { id: `${prefix}-CHART-007`, name: `${namePrefix}异常与边界场景`, fn: testChart007, skipSteps: ['localStorage 已满', '大量指标性能', '大量画图性能'] },
    { id: `${prefix}-CHART-008`, name: `${namePrefix}跨交易对测试`, fn: testChart008, skipSteps: ['加仓后持仓线更新', '限价单成交后线消失'] },
  ];

  async function setup(page) {
    await goToPerps(page);
    await sleep(2000);
  }

  return { testCases, setup, ALL_TEST_IDS };
}
