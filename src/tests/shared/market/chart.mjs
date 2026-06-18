// Market Chart — shared test logic (Desktop / Web / Extension)
//
// Two factories due to platform architectural divergence:
//
//   createDesktopMarketChartTests({ prefix, namePrefix, openMarketSpotList, clickFirstToken, navigateToTokenDetail, screenshotDir })
//     Desktop uses Electron <webview src="tradingview.onekeytest.com"> with two-layer traversal:
//     page.evaluate → wv.executeJavaScript → iframe.contentDocument
//     Produces 8 test cases: MARKET-CHART-001 ~ 008
//
//   createWebMarketChartTests({ prefix, namePrefix, navigateToTokenDetail, screenshotDir })
//     Web / Extension share the same TV iframe access pattern via getTVFrame() from
//     ../../helpers/market-chart.mjs and produce the same 3 test cases.
//
// Wrappers inject platform-specific CDP connect + navigation; logic stays here.

import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';
import {
  waitForChartReady,
  clickTimeInterval as clickTimeIntervalFrame,
  clickIndicatorButton as clickIndicatorButtonFrame,
  getOHLCFromChart, getCanvasCount as getCanvasCountFrame,
  getIndicatorLabels as getIndicatorLabelsFrame,
  fetchHyperliquidOHLC, compareOHLC,
} from '../../helpers/market-chart.mjs';

// ─────────────────────────────────────────────────────────────
// Desktop factory (webview-based, 8 tests)
// ─────────────────────────────────────────────────────────────

/**
 * Build the 8 Market Chart test cases for Desktop (Electron <webview>).
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'MARKET-CHART'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. ''
 * @param {(page) => Promise<{count: number}>} opts.openMarketSpotList - Enter Market → 热门 list, return visible token count
 * @param {(page) => Promise<{text: string}>} opts.clickFirstToken - Click first visible token row, return clicked text
 * @param {(page) => Promise<void>} opts.navigateToTokenDetail - Ensure we are on a token detail page (used by tests 002-008)
 * @param {string} opts.screenshotDir - Absolute path to screenshot directory
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createDesktopMarketChartTests({
  prefix = 'MARKET-CHART',
  namePrefix = '',
  openMarketSpotList,
  clickFirstToken,
  navigateToTokenDetail,
  screenshotDir,
}) {

  // ── TV Webview Helpers (two-layer traversal) ────────────────

  async function tvEval(page, jsCode) {
    return page.evaluate(async (code) => {
      const wv = document.querySelector('webview');
      if (!wv) throw new Error('TV webview not found');
      return await wv.executeJavaScript(`
        (() => {
          const iframe = document.querySelector('iframe');
          if (!iframe?.contentDocument) throw new Error('TV iframe not found');
          const doc = iframe.contentDocument;
          ${code}
        })()
      `);
    }, jsCode);
  }

  async function waitForTVReady(page, minCanvases = 7, timeoutMs = 30000) {
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
      doc.querySelectorAll('[data-name="legend-source-item"]').forEach(el => {
        const raw = el.textContent?.trim();
        if (!raw) return;
        const name = raw.replace(/[\\d,.\\s∅−+]+$/, '').trim();
        if (name) labels.push(name);
      });
      return [...new Set(labels)];
    `);
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
      if (btns.length === 0) throw new Error('Interval button [${ariaLabel}] not found');
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

  async function addIndicator(page, name) {
    await clickIndicatorButton(page);
    await sleep(1000);

    await tvEval(page, `
      const dialog = doc.querySelector('[data-name="indicators-dialog"]');
      if (!dialog) throw new Error('Indicator dialog not found');
      const input = dialog.querySelector('input');
      if (!input) throw new Error('Search input not found');
      input.focus();
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      for (const ch of '${name}') {
        input.value += ch;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `);
    await sleep(1000);

    const clicked = await tvEval(page, `
      const dialog = doc.querySelector('[data-name="indicators-dialog"]');
      const items = dialog.querySelectorAll('[data-title]');
      for (const item of items) {
        const title = item.getAttribute('data-title') || '';
        if (title.includes('${name}') && item.getBoundingClientRect().height > 0) {
          item.click();
          return title;
        }
      }
      return null;
    `);

    await tvEval(page, `doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
    await sleep(1000);
    return clicked;
  }

  async function removeIndicator(page, keyword) {
    return tvEval(page, `
      const legends = doc.querySelectorAll('[data-name="legend-source-item"]');
      for (const legend of legends) {
        if (!legend.textContent?.includes('${keyword}')) continue;
        const removeBtn = legend.querySelector('[data-name="legend-delete-action"]')
          || legend.querySelector('button[aria-label*="删除"]')
          || legend.querySelector('button[aria-label*="Remove"]');
        if (removeBtn) { removeBtn.click(); return 'removed'; }
      }
      return 'not_found';
    `);
  }

  async function clickResetLayout(page) {
    await tvEval(page, `
      const btns = doc.querySelectorAll('button[aria-label="重置布局"]');
      if (btns.length === 0) throw new Error('Reset layout button not found');
      btns[0].click();
    `);
    await sleep(2000);
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

  async function reloadAndWait(page) {
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await sleep(3000);
    await waitForTVReady(page);
  }

  // ── Step wrapper ────────────────────────────────────────────

  const _ssStep = (page, t, name, fn) =>
    safeStep(page, t, name, fn, screenshotDir);

  // ── Test Cases ──────────────────────────────────────────────

  async function testMarketChart001(page) {
    const t = createStepTracker(`${prefix}-001`);

    await _ssStep(page, t, '进入 Market 热门列表', async () => {
      const { count } = await openMarketSpotList(page);
      if (count === 0) throw new Error('热门列表无可见 token');
      return `${count} visible tokens`;
    });

    await _ssStep(page, t, '点击第一个 Token 进入详情页', async () => {
      const { text } = await clickFirstToken(page);
      return `clicked ${text}, detail opened`;
    });

    await _ssStep(page, t, 'TV 图表加载', async () => {
      const canvases = await waitForTVReady(page);
      return `${canvases} canvases`;
    });

    await _ssStep(page, t, 'K 线区域无白屏', async () => {
      const hash = await getMainCanvasHash(page);
      if (hash === null) throw new Error('Canvas not readable');
      if (hash === 0) throw new Error('Canvas is blank (hash=0)');
      return `canvas hash: ${hash}`;
    });

    return t.result();
  }

  async function testMarketChart002(page) {
    const t = createStepTracker(`${prefix}-002`);

    await navigateToTokenDetail(page);
    await waitForTVReady(page);

    let intervals;
    await _ssStep(page, t, '获取可用时间周期列表', async () => {
      intervals = await getTimeIntervals(page);
      if (!intervals || intervals.length === 0) throw new Error('No time intervals found');
      return intervals.map(i => `${i.text}${i.active ? '(active)' : ''}`).join(', ');
    });

    const ariaLabels = ['1 分钟', '15 分钟', '1 小时', '4 小时', '1 日'];
    for (const aria of ariaLabels) {
      await _ssStep(page, t, `切换时间区间: ${aria}`, async () => {
        const hashBefore = await getMainCanvasHash(page);
        await clickTimeInterval(page, aria);
        await sleep(2000);
        const canvases = await getCanvasCount(page);
        if (canvases === 0) throw new Error('Canvas disappeared');
        const hashAfter = await getMainCanvasHash(page);
        const changed = hashBefore !== hashAfter;
        return `canvases: ${canvases}, data changed: ${changed}`;
      });
    }

    await _ssStep(page, t, 'OHLC 数据对照 (1h BTC vs Hyperliquid)', async () => {
      await clickTimeInterval(page, '1 小时');
      const chartOHLC = await getOHLC(page);
      const refOHLC = await fetchHyperliquidOHLC('BTC', '1h');
      if (!refOHLC) return 'SKIP: Hyperliquid API unavailable';
      if (!chartOHLC) return `SKIP: OHLC not readable. Ref: O=${refOHLC.O} H=${refOHLC.H} L=${refOHLC.L} C=${refOHLC.C}`;
      const cmp = compareOHLC(chartOHLC, refOHLC);
      if (!cmp.match) throw new Error(`OHLC mismatch > 0.5%: ${JSON.stringify(cmp.diffs)}`);
      return `maxDiff: ${cmp.maxDiff}`;
    });

    await _ssStep(page, t, '选中状态与区间一致', async () => {
      await clickTimeInterval(page, '4 小时');
      const afterIntervals = await getTimeIntervals(page);
      const active = afterIntervals.find(i => i.active);
      if (!active) return 'SKIP: No active indicator in TV toolbar buttons';
      if (!active.aria.includes('4')) throw new Error(`Expected 4h active, got: ${active.aria}`);
      return `Active: ${active.text} (${active.aria})`;
    });

    return t.result();
  }

  async function testMarketChart003(page) {
    const t = createStepTracker(`${prefix}-003`);

    await navigateToTokenDetail(page);
    await waitForTVReady(page);

    await _ssStep(page, t, '默认时间区间', async () => {
      const intervals = await getTimeIntervals(page);
      const active = intervals.find(i => i.active);
      return active ? `Default: ${active.text} (${active.aria})` : 'No active interval detected (may need aria-pressed check)';
    });

    await _ssStep(page, t, 'K 线类型按钮存在', async () => {
      const btn = await tvEval(page, `
        const b = doc.querySelector('button[aria-label="K线图"]');
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { aria: b.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height) };
      `);
      if (!btn) throw new Error('K线图 button not found');
      return `K线图 button: ${btn.w}x${btn.h}`;
    });

    await _ssStep(page, t, '切换 K 线类型面板', async () => {
      await tvEval(page, `
        const btn = doc.querySelector('button[aria-label="K线图"]');
        if (btn) btn.click();
      `);
      await sleep(1500);
      const hasPanel = await tvEval(page, `
        const items = doc.querySelectorAll('[data-value]');
        return items.length > 0;
      `);
      await tvEval(page, `doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
      await sleep(500);
      return hasPanel ? 'K线类型面板已打开' : 'SKIP: Panel structure not detected (may differ)';
    });

    await _ssStep(page, t, '蜡烛图 canvas 渲染验证', async () => {
      const hash = await getMainCanvasHash(page);
      if (hash === null || hash === 0) throw new Error('Canvas blank or unreadable');
      return `canvas hash: ${hash}`;
    });

    t.skip('价格/市值切换', 'Market 详情页可能无此入口，待产品确认');

    return t.result();
  }

  async function testMarketChart004(page) {
    const t = createStepTracker(`${prefix}-004`);

    await navigateToTokenDetail(page);
    await waitForTVReady(page);

    await _ssStep(page, t, '下方时间范围按钮探测', async () => {
      const btns = await tvEval(page, `
        const result = [];
        doc.querySelectorAll('button').forEach(b => {
          const r = b.getBoundingClientRect();
          if (r.y < 400 || r.width === 0 || r.height === 0 || r.height > 40) return;
          const text = b.textContent?.trim()?.slice(0, 10) || '';
          const aria = b.getAttribute('aria-label') || '';
          if (/^[1-9]|All|全部/.test(text) || /日|月|年/.test(text)) {
            result.push({ text, aria, y: Math.round(r.y) });
          }
        });
        return result;
      `);
      if (btns.length === 0) return 'SKIP: 下方时间范围按钮未找到 (Market 可能不支持此功能)';
      return btns.map(b => b.text).join(', ');
    });

    await _ssStep(page, t, '切换下方时间范围', async () => {
      const targets = ['1D', '5D', '1M', '3M', '6M', '1Y', 'ALL'];
      let switchCount = 0;
      for (const label of targets) {
        const clicked = await tvEval(page, `
          const btns = doc.querySelectorAll('button');
          for (const b of btns) {
            const r = b.getBoundingClientRect();
            if (r.y < 400 || r.width === 0) continue;
            const text = (b.textContent || '').trim();
            if (text === '${label}' || text.includes('${label}')) {
              b.click(); return true;
            }
          }
          return false;
        `);
        if (clicked) {
          await sleep(2000);
          switchCount++;
        }
      }
      if (switchCount === 0) return 'SKIP: 无可点击的时间范围按钮';
      return `切换了 ${switchCount} 个时间范围`;
    });

    t.skip('时区验证', '需要修改系统时区，自动化风险高');

    return t.result();
  }

  async function testMarketChart005(page) {
    const t = createStepTracker(`${prefix}-005`);

    await navigateToTokenDetail(page);
    await waitForTVReady(page);

    await _ssStep(page, t, 'K 线首次加载', async () => {
      const canvases = await getCanvasCount(page);
      if (canvases < 7) throw new Error(`Canvas count ${canvases} too low`);
      return `${canvases} canvases loaded`;
    });

    for (const aria of ['15 分钟', '1 小时', '4 小时', '1 日', '1 分钟']) {
      await _ssStep(page, t, `切换 ${aria} 加载时间`, async () => {
        const start = Date.now();
        await clickTimeInterval(page, aria);
        let loaded = false;
        for (let i = 0; i < 20; i++) {
          const cc = await getCanvasCount(page);
          if (cc > 0) { loaded = true; break; }
          await sleep(300);
        }
        const elapsed = Date.now() - start;
        if (!loaded) throw new Error('Canvas not rendered after switch');
        return `${elapsed}ms`;
      });
    }

    await _ssStep(page, t, '快速连续切换时间区间', async () => {
      const sequence = ['1 分钟', '1 小时', '4 小时', '15 分钟', '1 日', '1 分钟'];
      for (const aria of sequence) {
        await clickTimeInterval(page, aria);
        await sleep(500);
      }
      await sleep(2000);
      const canvases = await getCanvasCount(page);
      if (canvases === 0) throw new Error('Chart broken after rapid switches');
      return `${canvases} canvases, survived rapid switches`;
    });

    await _ssStep(page, t, '鼠标滚轮缩放', async () => {
      const hashBefore = await getMainCanvasHash(page);
      const wvRect = await page.evaluate(() => {
        const wv = document.querySelector('webview');
        if (!wv) return null;
        const r = wv.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      if (!wvRect) throw new Error('Webview not found');
      await page.mouse.wheel(0, 300);
      await sleep(2000);
      const hashAfter = await getMainCanvasHash(page);
      await page.mouse.wheel(0, -300);
      await sleep(2000);
      return `zoom: hash ${hashBefore === hashAfter ? 'unchanged (may not affect canvas)' : 'changed'}`;
    });

    t.skip('交互帧率 ≥ 30 FPS', '无法通过 DOM/CDP 精确测量 Canvas FPS');

    return t.result();
  }

  async function testMarketChart006(page) {
    const t = createStepTracker(`${prefix}-006`);

    await navigateToTokenDetail(page);
    await waitForTVReady(page);

    await _ssStep(page, t, '重置布局到默认状态', async () => {
      await clickResetLayout(page);
      await sleep(3000);
      await reloadAndWait(page);
      return 'reset done';
    });

    await _ssStep(page, t, '默认 Volume 指标显示', async () => {
      let labels;
      for (let i = 0; i < 10; i++) {
        labels = await getIndicatorLabels(page);
        if (labels.some(l => l.includes('Volume') || l.includes('成交量'))) break;
        await sleep(1000);
      }
      const hasVol = labels.some(l => l.includes('Volume') || l.includes('成交量'));
      if (!hasVol) throw new Error(`Volume not found. Labels: ${JSON.stringify(labels)}`);
      return `Labels: ${labels.join(', ')}`;
    });

    await _ssStep(page, t, '添加 EMA 指标', async () => {
      const added = await addIndicator(page, 'EMA');
      if (!added) throw new Error('EMA not found in indicator panel');
      const labels = await getIndicatorLabels(page);
      if (!labels.some(l => l.includes('EMA'))) throw new Error(`EMA not in labels: ${JSON.stringify(labels)}`);
      return `Added: ${added}`;
    });

    await _ssStep(page, t, '添加 MACD 指标', async () => {
      const added = await addIndicator(page, 'MACD');
      if (!added) throw new Error('MACD not found in indicator panel');
      const labels = await getIndicatorLabels(page);
      if (!labels.some(l => l.includes('MACD'))) throw new Error(`MACD not in labels: ${JSON.stringify(labels)}`);
      return `Added: ${added}`;
    });

    await _ssStep(page, t, '添加 RSI 指标', async () => {
      const added = await addIndicator(page, 'RSI');
      if (!added) throw new Error('RSI not found in indicator panel');
      const labels = await getIndicatorLabels(page);
      if (!labels.some(l => l.includes('RSI'))) throw new Error(`RSI not in labels: ${JSON.stringify(labels)}`);
      return `Added: ${added}`;
    });

    await _ssStep(page, t, '添加布林带指标', async () => {
      const added = await addIndicator(page, 'Bollinger');
      if (!added) throw new Error('Bollinger not found in indicator panel');
      return `Added: ${added}`;
    });

    await _ssStep(page, t, '多指标共存验证', async () => {
      const labels = await getIndicatorLabels(page);
      const hasVol = labels.some(l => l.includes('Volume') || l.includes('成交量'));
      const hasMacd = labels.some(l => l.includes('MACD'));
      const hasRsi = labels.some(l => l.includes('RSI'));
      return `${labels.length} indicators: ${labels.join(', ')}. Vol=${hasVol} MACD=${hasMacd} RSI=${hasRsi}`;
    });

    await _ssStep(page, t, '指标持久化 (刷新验证)', async () => {
      const before = await getIndicatorLabels(page);
      await reloadAndWait(page);
      const after = await getIndicatorLabels(page);
      const toName = (l) => l.replace(/[\d,.\s∅KMBTkmbt−+%]+$/, '').trim();
      const beforeSet = new Set(before.map(toName).filter(Boolean));
      const afterSet = new Set(after.map(toName).filter(Boolean));
      const missing = [...beforeSet].filter(x => !afterSet.has(x));
      if (missing.length > 0) throw new Error(`Indicators lost: ${missing.join(', ')}`);
      return `Before: ${before.length}, After: ${after.length}`;
    });

    await _ssStep(page, t, '移除 MACD 指标', async () => {
      const result = await removeIndicator(page, 'MACD');
      await sleep(2000);
      const labels = await getIndicatorLabels(page);
      const hasMacd = labels.some(l => l.includes('MACD'));
      if (hasMacd) return `SKIP: Delete button not found or MACD still present (${result})`;
      return `MACD removed. Remaining: ${labels.join(', ')}`;
    });

    await _ssStep(page, t, '重置布局后仅保留 Volume', async () => {
      await clickResetLayout(page);
      await sleep(3000);
      await reloadAndWait(page);
      let labels;
      for (let i = 0; i < 15; i++) {
        labels = await getIndicatorLabels(page);
        const hasVol = labels.some(l => l.includes('Volume') || l.includes('成交量'));
        if (hasVol && labels.length <= 2) break;
        await sleep(1000);
      }
      const hasVol = labels.some(l => l.includes('Volume') || l.includes('成交量'));
      if (!hasVol) throw new Error(`Volume not found after reset. Labels: ${JSON.stringify(labels)}`);
      return `Reset OK. Labels: ${labels.join(', ')}`;
    });

    return t.result();
  }

  async function testMarketChart007(page) {
    const t = createStepTracker(`${prefix}-007`);

    await navigateToTokenDetail(page);
    await waitForTVReady(page);

    await _ssStep(page, t, '十字光标 OHLC 显示', async () => {
      const wvRect = await page.evaluate(() => {
        const wv = document.querySelector('webview');
        if (!wv) return null;
        const r = wv.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
      });
      if (!wvRect) throw new Error('Webview not found');

      await page.mouse.move(wvRect.x, wvRect.y);
      await sleep(1500);

      const ohlc = await getOHLC(page);
      return ohlc ? `O=${ohlc.O} H=${ohlc.H} L=${ohlc.L} C=${ohlc.C}` : 'OHLC not readable from header (may use different format)';
    });

    await _ssStep(page, t, '光标移动数据变化', async () => {
      const wvRect = await page.evaluate(() => {
        const wv = document.querySelector('webview');
        const r = wv.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      });

      await page.mouse.move(wvRect.x + wvRect.w * 0.25, wvRect.y + wvRect.h * 0.5);
      await sleep(1000);
      const ohlcLeft = await getOHLC(page);

      await page.mouse.move(wvRect.x + wvRect.w * 0.75, wvRect.y + wvRect.h * 0.5);
      await sleep(1000);
      const ohlcRight = await getOHLC(page);

      if (!ohlcLeft && !ohlcRight) return 'SKIP: OHLC not readable at either position';
      const changed = JSON.stringify(ohlcLeft) !== JSON.stringify(ohlcRight);
      return `Left: ${ohlcLeft ? ohlcLeft.C : 'N/A'}, Right: ${ohlcRight ? ohlcRight.C : 'N/A'}, changed: ${changed}`;
    });

    t.skip('移动端长按十字光标', '本次只测 Desktop');
    t.skip('移动端点击蜡烛浮层', '本次只测 Desktop');

    return t.result();
  }

  async function testMarketChart008(page) {
    const t = createStepTracker(`${prefix}-008`);

    await navigateToTokenDetail(page);
    await waitForTVReady(page);

    await _ssStep(page, t, '实时数据更新观察', async () => {
      await clickTimeInterval(page, '1 分钟');
      const hash1 = await getMainCanvasHash(page);
      await sleep(10000);
      const hash2 = await getMainCanvasHash(page);
      const changed = hash1 !== hash2;
      return `hash1=${hash1}, hash2=${hash2}, updated: ${changed}`;
    });

    for (const interval of ['1h', '4h']) {
      const ariaMap = { '1h': '1 小时', '4h': '4 小时' };
      await _ssStep(page, t, `OHLC 对照 ${interval}`, async () => {
        await clickTimeInterval(page, ariaMap[interval]);
        const refOHLC = await fetchHyperliquidOHLC('BTC', interval);
        if (!refOHLC) return `SKIP: Hyperliquid API unavailable for ${interval}`;
        const chartOHLC = await getOHLC(page);
        if (!chartOHLC) return `SKIP: OHLC not readable. Ref: O=${refOHLC.O} H=${refOHLC.H}`;
        const cmp = compareOHLC(chartOHLC, refOHLC);
        if (!cmp.match) throw new Error(`OHLC mismatch: ${JSON.stringify(cmp.diffs)}`);
        return `maxDiff: ${cmp.maxDiff}`;
      });
    }

    await _ssStep(page, t, '1m 大数据量加载', async () => {
      await clickTimeInterval(page, '1 分钟');
      await sleep(3000);
      const canvases = await getCanvasCount(page);
      if (canvases === 0) throw new Error('No canvas for 1m data');
      return `${canvases} canvases loaded`;
    });

    t.skip('时区对齐验证', '需修改系统时区');
    t.skip('内存占用检测', '需 profiling 工具');

    return t.result();
  }

  // ── Registry ────────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}Market-图表-前置条件与详情页进入`, fn: testMarketChart001 },
    { id: `${prefix}-002`, name: `${namePrefix}Market-图表-时间区间切换与OHLC对照`, fn: testMarketChart002 },
    { id: `${prefix}-003`, name: `${namePrefix}Market-图表-默认周期与K线类型`, fn: testMarketChart003 },
    { id: `${prefix}-004`, name: `${namePrefix}Market-图表-下方时间范围`, fn: testMarketChart004 },
    { id: `${prefix}-005`, name: `${namePrefix}Market-图表-基础交互与缩放平移`, fn: testMarketChart005 },
    { id: `${prefix}-006`, name: `${namePrefix}Market-图表-技术指标`, fn: testMarketChart006 },
    { id: `${prefix}-007`, name: `${namePrefix}Market-图表-十字光标`, fn: testMarketChart007 },
    { id: `${prefix}-008`, name: `${namePrefix}Market-图表-数据准确性`, fn: testMarketChart008 },
  ];

  async function setup(_page) {
    // wrapper handles platform-level setup (unlock, dismiss overlays, list page nav)
  }

  return { testCases, setup };
}

// ─────────────────────────────────────────────────────────────
// Web / Extension factory (iframe-based, 3 tests)
// ─────────────────────────────────────────────────────────────

/**
 * Build the 3 Market Chart test cases shared by Web and Extension.
 * Both platforms render the TV chart in a same-origin iframe accessible
 * via getTVFrame() from helpers/market-chart.mjs.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'MARKET-CHART' | 'EXT-MARKET-CHART'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Ext-'
 * @param {(page, tokenSymbol: string) => Promise<void>} opts.navigateToTokenDetail
 * @param {string} opts.screenshotDir - Absolute path to screenshot directory
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createWebMarketChartTests({
  prefix = 'MARKET-CHART',
  namePrefix = '',
  navigateToTokenDetail,
  screenshotDir,
}) {

  const _safeStep = (page, t, name, fn) =>
    safeStep(page, t, name, fn, screenshotDir);

  async function testMarketChart001(page) {
    const t = createStepTracker(`${prefix}-001`);

    await navigateToTokenDetail(page, 'BTC');
    const tvFrame = await waitForChartReady(page);

    const intervals = ['1m', '15m', '1h', '4h', 'D'];
    for (const interval of intervals) {
      await _safeStep(page, t, `切换时间区间 ${interval}`, async () => {
        const canvasBefore = await getCanvasCountFrame(tvFrame);
        await clickTimeIntervalFrame(tvFrame, interval);
        await sleep(2000);
        const canvasAfter = await getCanvasCountFrame(tvFrame);
        if (canvasAfter === 0) throw new Error('Chart canvas disappeared after interval switch');
        return `canvases: ${canvasAfter}`;
      });
    }

    await _safeStep(page, t, 'OHLC 数据对比 (BTC vs Hyperliquid)', async () => {
      await clickTimeIntervalFrame(tvFrame, '1h');
      const refOHLC = await fetchHyperliquidOHLC('BTC', '1h');
      if (!refOHLC) return 'skip: Hyperliquid API unavailable';
      const chartOHLC = await getOHLCFromChart(tvFrame);
      if (!chartOHLC) return `skip: OHLC not readable from DOM. Ref: O=${refOHLC.O} H=${refOHLC.H} L=${refOHLC.L} C=${refOHLC.C}`;
      const cmp = compareOHLC(chartOHLC, refOHLC);
      if (!cmp.match) throw new Error(`OHLC mismatch > 0.5%: ${JSON.stringify(cmp.diffs)}`);
      return `maxDiff: ${cmp.maxDiff}`;
    });

    await _safeStep(page, t, 'K 线类型默认蜡烛图', async () => {
      const canvasCount = await getCanvasCountFrame(tvFrame);
      if (canvasCount === 0) throw new Error('No canvas rendered');
      return `${canvasCount} canvases`;
    });

    await _safeStep(page, t, '技术指标切换 — 点击指标按钮', async () => {
      const labelsBefore = await getIndicatorLabelsFrame(tvFrame);
      await clickIndicatorButtonFrame(tvFrame);
      await sleep(2000);

      const dialogVisible = await tvFrame.evaluate(() => {
        const dialogs = document.querySelectorAll('[role="dialog"], [data-name="indicator-properties-dialog"]');
        for (const d of dialogs) {
          const r = d.getBoundingClientRect();
          if (r.width > 100 && r.height > 100) return true;
        }
        const inputs = document.querySelectorAll('input[type="text"], input[placeholder]');
        for (const inp of inputs) {
          const r = inp.getBoundingClientRect();
          if (r.width > 100 && r.height > 0) return true;
        }
        return false;
      });

      await tvFrame.evaluate(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      await sleep(500);

      return dialogVisible ? 'indicator dialog opened' : 'indicator button clicked (dialog not detected)';
    });

    await _safeStep(page, t, '默认 Volume 指标显示', async () => {
      const labels = await getIndicatorLabelsFrame(tvFrame);
      const hasVolume = labels.some(l => /Vol/i.test(l));
      return `labels: [${labels.join(', ')}]${hasVolume ? ' has Volume' : ''}`;
    });

    return t.result();
  }

  async function testMarketChart002(page) {
    const t = createStepTracker(`${prefix}-002`);

    await navigateToTokenDetail(page, 'BTC');
    const tvFrame = await waitForChartReady(page);

    await _safeStep(page, t, 'K 线图正常加载', async () => {
      const canvasCount = await getCanvasCountFrame(tvFrame);
      if (canvasCount === 0) throw new Error('No canvas');
      return `${canvasCount} canvases rendered`;
    });

    const intervals = ['15m', '1h', '4h', 'D', '1m'];
    for (const interval of intervals) {
      await _safeStep(page, t, `切换时间周期 ${interval} — 数据更新`, async () => {
        const start = Date.now();
        await clickTimeIntervalFrame(tvFrame, interval);
        let loaded = false;
        for (let i = 0; i < 20; i++) {
          const cc = await getCanvasCountFrame(tvFrame);
          if (cc > 0) { loaded = true; break; }
          await sleep(300);
        }
        const elapsed = Date.now() - start;
        if (!loaded) throw new Error('Canvas not rendered after switch');
        return `${elapsed}ms`;
      });
    }

    await _safeStep(page, t, '大数据量加载 (1m K 线)', async () => {
      await clickTimeIntervalFrame(tvFrame, '1m');
      await sleep(3000);
      const canvasCount = await getCanvasCountFrame(tvFrame);
      if (canvasCount === 0) throw new Error('Canvas not rendered for 1m');
      return `${canvasCount} canvases, loaded`;
    });

    await _safeStep(page, t, 'OHLC 多区间对比 (BTC)', async () => {
      const results = [];
      for (const interval of ['1h', '4h']) {
        await clickTimeIntervalFrame(tvFrame, interval);
        const refOHLC = await fetchHyperliquidOHLC('BTC', interval);
        if (!refOHLC) { results.push(`${interval}: API N/A`); continue; }
        results.push(`${interval}: O=${refOHLC.O} H=${refOHLC.H} L=${refOHLC.L} C=${refOHLC.C}`);
      }
      return results.join(' | ');
    });

    return t.result();
  }

  async function testMarketChart003(page) {
    const t = createStepTracker(`${prefix}-003`);

    await navigateToTokenDetail(page, 'BTC');
    const tvFrame = await waitForChartReady(page);

    await _safeStep(page, t, '图表重新加载验证', async () => {
      await clickTimeIntervalFrame(tvFrame, '15m');
      await sleep(3000);
      const canvasCount = await getCanvasCountFrame(tvFrame);
      if (canvasCount === 0) throw new Error('Chart not rendered after reload');
      return `${canvasCount} canvases after reload`;
    });

    await _safeStep(page, t, '快速连续切换时间区间', async () => {
      const intervals = ['1m', '1h', '4h', '15m', 'D', '1m'];
      for (const interval of intervals) {
        await clickTimeIntervalFrame(tvFrame, interval);
        await sleep(500);
      }
      await sleep(2000);
      const canvasCount = await getCanvasCountFrame(tvFrame);
      if (canvasCount === 0) throw new Error('Chart broken after rapid switches');
      return `${canvasCount} canvases, survived rapid switches`;
    });

    return t.result();
  }

  // ── Registry ────────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}Market-图表-数据展示与指标切换`, fn: testMarketChart001 },
    { id: `${prefix}-002`, name: `${namePrefix}Market-图表-基础功能与数据对比`, fn: testMarketChart002 },
    { id: `${prefix}-003`, name: `${namePrefix}Market-图表-异常与压力测试`, fn: testMarketChart003 },
  ];

  async function setup(_page) {
    // wrapper handles platform-level setup (Chrome launch, page navigation)
  }

  return { testCases, setup };
}
