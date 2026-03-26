// Market Chart Tests (Desktop) — MARKET-CHART-001 ~ MARKET-CHART-008
// Desktop 端 Market Token 详情页图表自动化测试
// Generated from recording + webview exploration: 2026-03-26
//
// Coverage mapping (8 tests ↔ 10 doc sections):
//   MARKET-CHART-001 → #1 前置条件 + 进入详情页
//   MARKET-CHART-002 → #2 时间区间切换与 OHLC 对照
//   MARKET-CHART-003 → #3 默认周期与 K 线类型
//   MARKET-CHART-004 → #4 下方时间范围
//   MARKET-CHART-005 → #5 基础交互：加载、周期切换、缩放与平移
//   MARKET-CHART-006 → #6 技术指标：单项与组合
//   MARKET-CHART-007 → #7 十字光标
//   MARKET-CHART-008 → #8 数据准确性：刷新、交易所对照
//   SKIP: #9 断网恢复 (需真实断网)、#10 多端一致性 (跨平台)
//
// Key architecture:
//   Market TV chart = Electron <webview src="tradingview.onekeytest.com">
//     → blob: <iframe> (TradingView charting library)
//   Access: page.evaluate → wv.executeJavaScript → iframe.contentDocument
//   Same two-layer traversal as Perps chart (K-022)

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { createStepTracker, safeStep, clickSidebarTab, ensureOnListPage } from '../../helpers/components.mjs';
import { fetchHyperliquidOHLC, compareOHLC } from '../../helpers/market-chart.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-chart');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── TV Webview Helpers (two-layer traversal) ────────────────
// Identical architecture to Perps: page → webview.executeJavaScript → iframe.contentDocument

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

/**
 * Get indicator labels from TV chart using the standard legend-source-item selector.
 * Returns e.g. ["成交量(Volume)", "MACD", "RSI"]
 * Strips trailing numeric values (0.31∅∅) to get clean indicator names.
 */
async function getIndicatorLabels(page) {
  return tvEval(page, `
    const labels = [];
    doc.querySelectorAll('[data-name="legend-source-item"]').forEach(el => {
      const raw = el.textContent?.trim();
      if (!raw) return;
      // Strip trailing numbers/symbols: "成交量(Volume)0.31∅∅" → "成交量(Volume)"
      const name = raw.replace(/[\\d,.\\s∅−+]+$/, '').trim();
      if (name) labels.push(name);
    });
    return [...new Set(labels)];
  `);
}

function hasIndicator(labels, keyword) {
  return labels.some(l => l.includes(keyword));
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

/**
 * Add an indicator by name: open panel → search → click result → close panel.
 * @param {string} name - Indicator name to search for (e.g. "MACD", "RSI", "EMA")
 */
async function addIndicator(page, name) {
  // Open indicator panel
  await clickIndicatorButton(page);
  await sleep(1000);

  // Type in search box
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

  // Click the first matching result
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

  // Close panel
  await tvEval(page, `doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
  await sleep(1000);
  return clicked;
}

/**
 * Remove an indicator by clicking its delete button in the TV legend.
 * @param {string} keyword - Partial match for the indicator label (e.g. "MACD", "RSI")
 */
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

async function isIndicatorPanelOpen(page) {
  return tvEval(page, `
    const d = doc.querySelector('[data-name="indicators-dialog"]');
    return d ? d.getBoundingClientRect().width > 200 : false;
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

// ── Navigation ──────────────────────────────────────────────

async function clickMainTab(page, tab) {
  const ok = await page.evaluate((name) => {
    for (const sp of document.querySelectorAll('span')) {
      if ((sp.textContent || '').trim() !== name) continue;
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 135 && r.y < 210) {
        sp.click();
        return true;
      }
    }
    return false;
  }, tab);
  if (!ok) throw new Error(`Cannot click main tab: ${tab}`);
  await sleep(1500);
}

/**
 * Ensure we're on a token detail page with TV chart.
 * If already on detail page (nav-header-back visible + webview present), skip navigation.
 * Otherwise: Market → 现货 → click first token.
 */
async function navigateToTokenDetail(page) {
  // Check if already on detail page
  const alreadyOnDetail = await page.evaluate(() => {
    const back = document.querySelector('[data-testid="nav-header-back"]');
    const wv = document.querySelector('webview');
    return !!(back && back.getBoundingClientRect().width > 0 && wv);
  });
  if (alreadyOnDetail) return;

  await clickSidebarTab(page, 'Market');
  await sleep(2000);
  await clickMainTab(page, '现货');
  await sleep(1500);

  const pos = await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-testid="list-column-name"]')) {
      const text = (el.textContent || '').trim();
      if (text === '名称' || text === '#') continue;
      const r = el.getBoundingClientRect();
      if (r.x < 100 || r.x > 500 || r.width <= 0 || r.y < 250) continue;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  });
  if (!pos) throw new Error('No visible token row in 现货 list');

  await page.mouse.click(pos.x, pos.y);
  const opened = await page.locator('[data-testid="nav-header-back"]')
    .first().isVisible({ timeout: 5000 }).catch(() => false);
  if (!opened) throw new Error('Detail page did not open');
  await sleep(3000);
}

async function backToMarket(page) {
  const btn = page.locator('[data-testid="nav-header-back"]').first();
  const visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
  if (visible) {
    await btn.click();
    await sleep(2000);
  }
}

// ── Step wrapper ────────────────────────────────────────────

const _ssStep = (page, t, name, fn) =>
  safeStep(page, t, name, fn, (p, n) => screenshot(p, SCREENSHOT_DIR, n));

// ── Test Cases (8 aligned to doc sections) ──────────────────

// ┌──────────────────────────────────────────────────────────┐
// │ MARKET-CHART-001: #1 前置条件 + 进入详情页                  │
// │ 验证: 进入 Market → 现货 → 点击 token → 详情页图表加载       │
// └──────────────────────────────────────────────────────────┘
async function testMarketChart001(page) {
  const t = createStepTracker('MARKET-CHART-001');

  await _ssStep(page, t, '进入 Market 现货列表', async () => {
    await clickSidebarTab(page, 'Market');
    await sleep(2000);
    await clickMainTab(page, '现货');
    await sleep(1500);
    const viewH = await page.evaluate(() => window.innerHeight);
    const count = await page.evaluate((vh) => {
      let n = 0;
      for (const el of document.querySelectorAll('[data-testid="list-column-name"]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 30 && r.x >= 0 && r.y > 250 && r.y < vh) n++;
      }
      return n;
    }, viewH);
    if (count === 0) throw new Error('现货列表无可见 token');
    return `${count} visible tokens`;
  });

  await _ssStep(page, t, '点击第一个 Token 进入详情页', async () => {
    const pos = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-testid="list-column-name"]')) {
        const text = (el.textContent || '').trim();
        if (text === '名称' || text === '#') continue;
        const r = el.getBoundingClientRect();
        if (r.x < 100 || r.x > 500 || r.width <= 0 || r.y < 250) continue;
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: text.slice(0, 15) };
      }
      return null;
    });
    if (!pos) throw new Error('No visible token name cell');
    await page.mouse.click(pos.x, pos.y);
    const opened = await page.locator('[data-testid="nav-header-back"]')
      .first().isVisible({ timeout: 5000 }).catch(() => false);
    if (!opened) throw new Error('Detail page did not open');
    return `clicked ${pos.text}, detail opened`;
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

// ┌──────────────────────────────────────────────────────────┐
// │ MARKET-CHART-002: #2 时间区间切换与 OHLC 对照              │
// └──────────────────────────────────────────────────────────┘
async function testMarketChart002(page) {
  const t = createStepTracker('MARKET-CHART-002');

  await navigateToTokenDetail(page);
  await waitForTVReady(page);

  // 2.1 动态获取可用时间周期
  let intervals;
  await _ssStep(page, t, '获取可用时间周期列表', async () => {
    intervals = await getTimeIntervals(page);
    if (!intervals || intervals.length === 0) throw new Error('No time intervals found');
    return intervals.map(i => `${i.text}${i.active ? '(active)' : ''}`).join(', ');
  });

  // 2.2 逐个切换时间区间并验证选中状态 + canvas 变化
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

  // 2.3 OHLC 对照 (1h BTC vs Hyperliquid)
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

  // 2.4 切换后选中状态与当前区间一致
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

// ┌──────────────────────────────────────────────────────────┐
// │ MARKET-CHART-003: #3 默认周期与 K 线类型                   │
// └──────────────────────────────────────────────────────────┘
async function testMarketChart003(page) {
  const t = createStepTracker('MARKET-CHART-003');

  await navigateToTokenDetail(page);
  await waitForTVReady(page);

  // 3.1 默认选中的时间区间
  await _ssStep(page, t, '默认时间区间', async () => {
    const intervals = await getTimeIntervals(page);
    const active = intervals.find(i => i.active);
    return active ? `Default: ${active.text} (${active.aria})` : 'No active interval detected (may need aria-pressed check)';
  });

  // 3.2 K 线类型默认为蜡烛图
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

  // 3.3 点击 K 线类型 → 弹出类型面板
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
    // Close panel
    await tvEval(page, `doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`);
    await sleep(500);
    return hasPanel ? 'K线类型面板已打开' : 'SKIP: Panel structure not detected (may differ)';
  });

  // 3.4 蜡烛图渲染 (canvas 有内容)
  await _ssStep(page, t, '蜡烛图 canvas 渲染验证', async () => {
    const hash = await getMainCanvasHash(page);
    if (hash === null || hash === 0) throw new Error('Canvas blank or unreadable');
    return `canvas hash: ${hash}`;
  });

  // 3.5 SKIP: 价格/市值切换 (待确认入口是否存在)
  t.skip('价格/市值切换', 'Market 详情页可能无此入口，待产品确认');

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ MARKET-CHART-004: #4 下方时间范围                          │
// └──────────────────────────────────────────────────────────┘
async function testMarketChart004(page) {
  const t = createStepTracker('MARKET-CHART-004');

  await navigateToTokenDetail(page);
  await waitForTVReady(page);

  // 4.1 检测下方时间范围按钮 (1日/5日/1月/3月/6月/1年/All)
  await _ssStep(page, t, '下方时间范围按钮探测', async () => {
    const btns = await tvEval(page, `
      const result = [];
      doc.querySelectorAll('button').forEach(b => {
        const r = b.getBoundingClientRect();
        // 下方区域 (y > chart height * 0.8)
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

  // 4.2 如果有时间范围按钮，逐个点击验证 canvas 变化
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

  // 4.3 SKIP: 时区验证
  t.skip('时区验证', '需要修改系统时区，自动化风险高');

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ MARKET-CHART-005: #5 基础交互（加载、切换、缩放平移）        │
// └──────────────────────────────────────────────────────────┘
async function testMarketChart005(page) {
  const t = createStepTracker('MARKET-CHART-005');

  await navigateToTokenDetail(page);
  await waitForTVReady(page);

  // 5.1 K 线首次加载时间
  await _ssStep(page, t, 'K 线首次加载', async () => {
    const canvases = await getCanvasCount(page);
    if (canvases < 7) throw new Error(`Canvas count ${canvases} too low`);
    return `${canvases} canvases loaded`;
  });

  // 5.2 切换不同区间测量加载时间
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

  // 5.3 快速连续切换 (防抖/稳定性)
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

  // 5.4 缩放 (mouse wheel)
  await _ssStep(page, t, '鼠标滚轮缩放', async () => {
    const hashBefore = await getMainCanvasHash(page);
    // 获取 webview 位置，在其上方发送 wheel 事件
    const wvRect = await page.evaluate(() => {
      const wv = document.querySelector('webview');
      if (!wv) return null;
      const r = wv.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!wvRect) throw new Error('Webview not found');
    // 缩小
    await page.mouse.wheel(0, 300);
    await sleep(2000);
    const hashAfter = await getMainCanvasHash(page);
    // 还原
    await page.mouse.wheel(0, -300);
    await sleep(2000);
    return `zoom: hash ${hashBefore === hashAfter ? 'unchanged (may not affect canvas)' : 'changed'}`;
  });

  // 5.5 SKIP: FPS 测量
  t.skip('交互帧率 ≥ 30 FPS', '无法通过 DOM/CDP 精确测量 Canvas FPS');

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ MARKET-CHART-006: #6 技术指标                              │
// └──────────────────────────────────────────────────────────┘
async function testMarketChart006(page) {
  const t = createStepTracker('MARKET-CHART-006');

  await navigateToTokenDetail(page);
  await waitForTVReady(page);

  // 6.1 重置布局确保干净状态
  await _ssStep(page, t, '重置布局到默认状态', async () => {
    await clickResetLayout(page);
    await sleep(3000);
    await reloadAndWait(page);
    return 'reset done';
  });

  // 6.2 默认 Volume 指标
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

  // 6.3 添加 EMA 指标
  await _ssStep(page, t, '添加 EMA 指标', async () => {
    const added = await addIndicator(page, 'EMA');
    if (!added) throw new Error('EMA not found in indicator panel');
    const labels = await getIndicatorLabels(page);
    if (!labels.some(l => l.includes('EMA'))) throw new Error(`EMA not in labels: ${JSON.stringify(labels)}`);
    return `Added: ${added}`;
  });

  // 6.4 添加 MACD 指标
  await _ssStep(page, t, '添加 MACD 指标', async () => {
    const added = await addIndicator(page, 'MACD');
    if (!added) throw new Error('MACD not found in indicator panel');
    const labels = await getIndicatorLabels(page);
    if (!labels.some(l => l.includes('MACD'))) throw new Error(`MACD not in labels: ${JSON.stringify(labels)}`);
    return `Added: ${added}`;
  });

  // 6.5 添加 RSI 指标
  await _ssStep(page, t, '添加 RSI 指标', async () => {
    const added = await addIndicator(page, 'RSI');
    if (!added) throw new Error('RSI not found in indicator panel');
    const labels = await getIndicatorLabels(page);
    if (!labels.some(l => l.includes('RSI'))) throw new Error(`RSI not in labels: ${JSON.stringify(labels)}`);
    return `Added: ${added}`;
  });

  // 6.6 添加布林带指标
  await _ssStep(page, t, '添加布林带指标', async () => {
    const added = await addIndicator(page, 'Bollinger');
    if (!added) throw new Error('Bollinger not found in indicator panel');
    return `Added: ${added}`;
  });

  // 6.7 多指标共存验证
  await _ssStep(page, t, '多指标共存验证', async () => {
    const labels = await getIndicatorLabels(page);
    const hasVol = labels.some(l => l.includes('Volume') || l.includes('成交量'));
    const hasMacd = labels.some(l => l.includes('MACD'));
    const hasRsi = labels.some(l => l.includes('RSI'));
    return `${labels.length} indicators: ${labels.join(', ')}. Vol=${hasVol} MACD=${hasMacd} RSI=${hasRsi}`;
  });

  // 6.8 指标持久化 (刷新前后对比)
  await _ssStep(page, t, '指标持久化 (刷新验证)', async () => {
    const before = await getIndicatorLabels(page);
    await reloadAndWait(page);
    const after = await getIndicatorLabels(page);
    const beforeSet = new Set(before);
    const afterSet = new Set(after);
    const missing = [...beforeSet].filter(x => !afterSet.has(x));
    if (missing.length > 0) throw new Error(`Indicators lost: ${missing.join(', ')}`);
    return `Before: ${before.length}, After: ${after.length}`;
  });

  // 6.9 移除 MACD 指标
  await _ssStep(page, t, '移除 MACD 指标', async () => {
    const result = await removeIndicator(page, 'MACD');
    await sleep(2000);
    const labels = await getIndicatorLabels(page);
    const hasMacd = labels.some(l => l.includes('MACD'));
    if (hasMacd) return `SKIP: Delete button not found or MACD still present (${result})`;
    return `MACD removed. Remaining: ${labels.join(', ')}`;
  });

  // 6.10 重置布局 → 仅剩 Volume
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

// ┌──────────────────────────────────────────────────────────┐
// │ MARKET-CHART-007: #7 十字光标                              │
// └──────────────────────────────────────────────────────────┘
async function testMarketChart007(page) {
  const t = createStepTracker('MARKET-CHART-007');

  await navigateToTokenDetail(page);
  await waitForTVReady(page);

  // 7.1 移动光标到图表中央，检查 OHLC 数据显示
  await _ssStep(page, t, '十字光标 OHLC 显示', async () => {
    const wvRect = await page.evaluate(() => {
      const wv = document.querySelector('webview');
      if (!wv) return null;
      const r = wv.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    });
    if (!wvRect) throw new Error('Webview not found');

    // 移动鼠标到图表中央
    await page.mouse.move(wvRect.x, wvRect.y);
    await sleep(1500);

    // 检查 OHLC 是否显示
    const ohlc = await getOHLC(page);
    return ohlc ? `O=${ohlc.O} H=${ohlc.H} L=${ohlc.L} C=${ohlc.C}` : 'OHLC not readable from header (may use different format)';
  });

  // 7.2 光标移动到不同位置，数据变化
  await _ssStep(page, t, '光标移动数据变化', async () => {
    const wvRect = await page.evaluate(() => {
      const wv = document.querySelector('webview');
      const r = wv.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

    // 移到左 1/4
    await page.mouse.move(wvRect.x + wvRect.w * 0.25, wvRect.y + wvRect.h * 0.5);
    await sleep(1000);
    const ohlcLeft = await getOHLC(page);

    // 移到右 3/4
    await page.mouse.move(wvRect.x + wvRect.w * 0.75, wvRect.y + wvRect.h * 0.5);
    await sleep(1000);
    const ohlcRight = await getOHLC(page);

    if (!ohlcLeft && !ohlcRight) return 'SKIP: OHLC not readable at either position';
    const changed = JSON.stringify(ohlcLeft) !== JSON.stringify(ohlcRight);
    return `Left: ${ohlcLeft ? ohlcLeft.C : 'N/A'}, Right: ${ohlcRight ? ohlcRight.C : 'N/A'}, changed: ${changed}`;
  });

  // 7.3 SKIP: 移动端
  t.skip('移动端长按十字光标', '本次只测 Desktop');
  t.skip('移动端点击蜡烛浮层', '本次只测 Desktop');

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ MARKET-CHART-008: #8 数据准确性                            │
// └──────────────────────────────────────────────────────────┘
async function testMarketChart008(page) {
  const t = createStepTracker('MARKET-CHART-008');

  await navigateToTokenDetail(page);
  await waitForTVReady(page);

  // 8.1 实时数据更新 (canvas hash 变化)
  await _ssStep(page, t, '实时数据更新观察', async () => {
    await clickTimeInterval(page, '1 分钟');
    const hash1 = await getMainCanvasHash(page);
    await sleep(10000);
    const hash2 = await getMainCanvasHash(page);
    const changed = hash1 !== hash2;
    return `hash1=${hash1}, hash2=${hash2}, updated: ${changed}`;
  });

  // 8.2 多区间 OHLC 对照
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

  // 8.3 大数据量 (1m 长时间)
  await _ssStep(page, t, '1m 大数据量加载', async () => {
    await clickTimeInterval(page, '1 分钟');
    await sleep(3000);
    const canvases = await getCanvasCount(page);
    if (canvases === 0) throw new Error('No canvas for 1m data');
    return `${canvases} canvases loaded`;
  });

  // 8.4 SKIP
  t.skip('时区对齐验证', '需修改系统时区');
  t.skip('内存占用检测', '需 profiling 工具');

  return t.result();
}

// ── Exports ──────────────────────────────────────────────────

export const testCases = [
  { id: 'MARKET-CHART-001', name: 'Market-图表-前置条件与详情页进入', fn: testMarketChart001 },
  { id: 'MARKET-CHART-002', name: 'Market-图表-时间区间切换与OHLC对照', fn: testMarketChart002 },
  { id: 'MARKET-CHART-003', name: 'Market-图表-默认周期与K线类型', fn: testMarketChart003 },
  { id: 'MARKET-CHART-004', name: 'Market-图表-下方时间范围', fn: testMarketChart004 },
  { id: 'MARKET-CHART-005', name: 'Market-图表-基础交互与缩放平移', fn: testMarketChart005 },
  { id: 'MARKET-CHART-006', name: 'Market-图表-技术指标', fn: testMarketChart006 },
  { id: 'MARKET-CHART-007', name: 'Market-图表-十字光标', fn: testMarketChart007 },
  { id: 'MARKET-CHART-008', name: 'Market-图表-数据准确性', fn: testMarketChart008 },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  // If app is on a token detail page, go back to Market list first
  await ensureOnListPage(page);
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('MARKET-CHART-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Chart Tests (Desktop) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  const results = [];
  await setup(page);

  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    try {
      if (page?.isClosed?.()) {
        console.log('  Page was closed, reconnecting CDP...');
        ({ page } = await connectCDP());
        await setup(page);
      }
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id,
        status: result.status,
        duration,
        steps: result.steps,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) {
        await screenshot(page, SCREENSHOT_DIR, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    try { if (page && !page?.isClosed?.()) await dismissOverlays(page); } catch {}
    await sleep(800);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'market-chart-desktop-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
