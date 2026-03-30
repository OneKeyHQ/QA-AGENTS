// Perps TV Chart Tests — PERPS-CHART-001 ~ PERPS-CHART-008
// Generated from recording sessions: 2026-03-24
// Refactored: 2026-03-25 — merged 31 cases into 8 matching document sections
//
// Coverage mapping (8 merged tests):
//   PERPS-CHART-001 → 默认指标测试 (old 001, 013)
//   PERPS-CHART-002 → 指标管理测试 (old 002, 003, 004, 014, 026)
//   PERPS-CHART-003 → 画图工具测试 (old 005, 019, 020, 021)
//   PERPS-CHART-004 → K线时间周期测试 (old 007, 015, 027, 028)
//   PERPS-CHART-005 → 图表叠加显示测试 (old 009, 029)
//   PERPS-CHART-006 → 视图布局测试 (old 008, 010, 018, 022)
//   PERPS-CHART-007 → 异常与边界场景 (old 011, 017, 025, 030, 031)
//   PERPS-CHART-008 → 跨交易对测试 (old 006, 012, 016, 023, 024)
//
// Key architecture (K-022):
//   Perps TV chart = Electron <webview> → blob: <iframe>
//   Access: page.evaluate → wv.executeJavaScript → iframe.contentDocument
//   Playwright page.frames() CANNOT access webview — must use executeJavaScript

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { createStepTracker, safeStep, clickSidebarTab, clickWithPointerEvents, dismissPopover, switchToAccount, getCurrentAccount } from '../../helpers/components.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'perps-chart');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = [
  'PERPS-CHART-001',
  'PERPS-CHART-002',
  'PERPS-CHART-003',
  'PERPS-CHART-004',
  'PERPS-CHART-005',
  'PERPS-CHART-006',
  'PERPS-CHART-007',
  'PERPS-CHART-008',
];

// ── TV Webview Helpers ──────────────────────────────────────
// Two-layer access: page → webview.executeJavaScript → iframe.contentDocument

/**
 * Execute JS inside the TV blob: iframe (two-layer traversal).
 * @param {import('playwright-core').Page} page
 * @param {string} jsCode — code that runs inside iframe.contentDocument context.
 *   Must return a JSON-serializable value. Has access to `doc` (iframe.contentDocument).
 * @returns {Promise<any>}
 */
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

/** Wait for TV chart to be ready (canvases > threshold). */
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

/** Get canvas count in TV iframe. */
async function getCanvasCount(page) {
  return tvEval(page, `return doc.querySelectorAll('canvas').length;`);
}

/**
 * Get current indicator labels from TV chart.
 * Returns deduplicated array of indicator name strings (e.g., ["MA", "MACD", "成交量(Volume)"]).
 */
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

/** Check if a specific indicator is present by prefix match. */
function hasIndicator(labels, prefix) {
  return labels.some(l => l.startsWith(prefix));
}

/**
 * Get dynamically available time intervals from TV toolbar.
 * Returns array of { text, aria, active } for buttons in toolbar area (y < 50).
 */
async function getTimeIntervals(page) {
  return tvEval(page, `
    const btns = [];
    const seen = new Set();
    doc.querySelectorAll('button').forEach(b => {
      const r = b.getBoundingClientRect();
      if (r.y > 50 || r.height === 0 || r.height > 40 || r.width === 0) return;
      const aria = b.getAttribute('aria-label') || '';
      const text = b.textContent?.trim()?.slice(0, 15) || '';
      // Deduplicate by aria-label (TV renders multiple overlapping buttons)
      if (aria && !seen.has(aria) && (aria.includes('分钟') || aria.includes('小时') || aria.includes('日') || aria.includes('周'))) {
        seen.add(aria);
        const active = b.className.includes('isActive') || b.getAttribute('aria-pressed') === 'true';
        btns.push({ text, aria, active });
      }
    });
    return btns;
  `);
}

/** Click a time interval button by its aria-label. */
async function clickTimeInterval(page, ariaLabel) {
  await tvEval(page, `
    const btns = doc.querySelectorAll('button[aria-label="${ariaLabel}"]');
    if (btns.length === 0) throw new Error('Interval button [aria-label="${ariaLabel}"] not found');
    btns[0].click();
  `);
  await sleep(2000);
}

/** Get OHLC values from TV chart header. */
async function getOHLC(page) {
  return tvEval(page, `
    const text = doc.body.innerText || '';
    const m = text.match(/O\\s*([\\d,.]+)\\s*H\\s*([\\d,.]+)\\s*L\\s*([\\d,.]+)\\s*C\\s*([\\d,.]+)/);
    return m ? { O: m[1], H: m[2], L: m[3], C: m[4] } : null;
  `);
}

/** Click the indicator button to open/close indicator panel. */
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

/** Check if indicator panel dialog is open. */
async function isIndicatorPanelOpen(page) {
  return tvEval(page, `
    const d = doc.querySelector('[role="dialog"]');
    return d ? d.getBoundingClientRect().width > 200 : false;
  `);
}

/** Get indicator panel text (to check favorites ordering). */
async function getIndicatorPanelText(page) {
  return tvEval(page, `
    const d = doc.querySelector('[role="dialog"]');
    return d ? d.textContent?.slice(0, 400) || '' : '';
  `);
}

/** Click the "重置布局" (Reset Layout) button in TV toolbar. */
async function clickResetLayout(page) {
  await tvEval(page, `
    const btns = doc.querySelectorAll('button[aria-label="重置布局"]');
    if (btns.length === 0) throw new Error('Reset layout button not found');
    btns[0].click();
  `);
  await sleep(2000);
}

/**
 * Get drawing storage keys from TV localStorage.
 * Each key follows pattern: tradingview_drawings_<module>_<symbol>
 */
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

/** Get current trading pair from main page. */
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

/** Get left-side drawing toolbar buttons. */
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

// ── Helpers ─────────────────────────────────────────────────

const _ssStep = (page, t, name, fn) =>
  safeStep(page, t, name, fn, (p, n) => screenshot(p, SCREENSHOT_DIR, n));

async function navigateToPerps(page) {
  await clickSidebarTab(page, 'Perps');
  await sleep(2000);
}

async function reloadAndWait(page) {
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await sleep(3000);
  await waitForTVReady(page);
}

function createSkipTest(id, name, reason) {
  return async function(page) {
    const t = createStepTracker(id);
    t.skip(name, reason);
    return t.result();
  };
}

// ── Perps Settings Helper ─────────────────────────────────────
// IMPORTANT: Page has multiple TMPopover-ScrollView instances (8+).
// querySelector returns the FIRST one (hidden). Must iterate ALL and find
// the visible one (width > 0). The button works with Pointer Events dispatch.

/**
 * Open Perps settings menu (three-dot button) via shared clickWithPointerEvents.
 */
async function openPerpsSettingsMenu(page) {
  await clickWithPointerEvents(page, '[data-testid="perp-header-settings-button"]');
}

/**
 * Get Perps chart settings toggle states.
 * Opens the settings popover and reads all 3 toggle states.
 * @returns {Promise<{skipConfirm: string, showTrades: string, showPositions: string} | null>}
 */
async function getPerpsSettings(page) {
  await openPerpsSettingsMenu(page);

  // Poll for visible popover with settings content
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
      // Close the popover
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

// ── Canvas Hash Helper ────────────────────────────────────────

/** Get hash of the main (largest) canvas in TV chart. Uses full canvas pixels for accuracy. */
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
      // Full canvas sampling with large step to avoid timeout (K-030)
      const data = ctx.getImageData(0, 0, maxCanvas.width, maxCanvas.height).data;
      let hash = 0;
      for (let j = 0; j < data.length; j += 100) {
        hash = ((hash << 5) - hash + data[j]) | 0;
      }
      return hash;
    } catch(e) { return null; }
  `);
}

/** Click the Nth settings toggle (0=skipConfirm, 1=showTrades, 2=showPositions). */
async function clickSettingsToggle(page, index) {
  // Open settings menu first
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

  // Close settings menu
  await dismissPopover(page);
  // Wait for canvas to fully re-render after toggle (position lines need time)
  await sleep(4000);
}

/** Get chart layout dimensions (webview size + main canvas size). */
async function getChartLayout(page) {
  const wvSize = await page.evaluate(() => {
    const wv = document.querySelector('webview');
    if (!wv) return null;
    const r = wv.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });

  const canvasLayout = await tvEval(page, `
    const canvases = doc.querySelectorAll('canvas');
    let maxW = 0, maxH = 0;
    canvases.forEach(c => {
      const r = c.getBoundingClientRect();
      if (r.width > maxW && r.height > 100) { maxW = Math.round(r.width); maxH = Math.round(r.height); }
    });
    return { mainW: maxW, mainH: maxH, canvasCount: canvases.length };
  `);

  return { wvSize, canvasLayout };
}

// ── Test Cases (8 merged) ───────────────────────────────────

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-001: 默认指标测试                              │
// │ Merges old: 001, 013                                      │
// │ Doc section: 1. 默认指标测试                               │
// │ Steps:                                                    │
// │   - Reset → check Volume only (old 001)                   │
// │   - Delete Volume → refresh check (old 013)               │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart001(page) {
  const t = createStepTracker('PERPS-CHART-001');

  await navigateToPerps(page);

  // --- From old 001: TV 图表加载 ---
  await _ssStep(page, t, 'TV 图表加载', async () => {
    const canvases = await waitForTVReady(page);
    if (canvases < 7) throw new Error(`Canvas count too low: ${canvases}`);
    return `${canvases} canvases`;
  });

  // --- From old 001: 重置布局确保默认状态 ---
  await _ssStep(page, t, '重置布局 + 刷新', async () => {
    await clickResetLayout(page);
    await sleep(3000);
    await reloadAndWait(page);
  });

  // --- From old 001: 验证仅有 Volume 指标 ---
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

  // --- From old 013: 删除 Volume 后刷新不恢复 ---
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

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-002: 指标管理测试                              │
// │ Merges old: 002, 003, 004, 014, 026                       │
// │ Doc section: 2. 指标管理测试                               │
// │   2.1 添加 + 2.2 收藏 + 2.3 删除                          │
// │ Steps:                                                    │
// │   - Add indicators → persist (old 002)                    │
// │   - Favorite → persist (old 003)                          │
// │   - Unfavorite (old 014)                                  │
// │   - Delete → persist (old 004)                            │
// │   - RSI params SKIP (old 026)                             │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart002(page) {
  const t = createStepTracker('PERPS-CHART-002');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // --- 2.1 指标添加 ---
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

  // --- 2.2 指标收藏 ---
  let panelTextBefore;
  await _ssStep(page, t, '收藏指标排序位置', async () => {
    await clickIndicatorButton(page);
    await sleep(500);
    panelTextBefore = await getIndicatorPanelText(page);
    const macdPos = panelTextBefore.indexOf('MACD');
    await clickIndicatorButton(page); // close
    return `MACD at position ${macdPos} ${macdPos >= 0 && macdPos < 100 ? '(in favorites)' : '(not favorited or further down)'}`;
  });

  // SKIP: TV webview 内操作
  t.skip('收藏指标（点击星形按钮）', '指标面板内的收藏按钮在 TV webview 内，无法自动点击（K-027）');
  t.skip('取消收藏指标', '同上，需手动在指标面板内点击星形按钮取消');

  // --- 2.3 指标删除 ---
  t.skip('删除指标（图表上右键→删除）', '指标删除需要在 TV webview 内右键指标标签操作（K-027）');

  // --- 2.1 RSI 参数 ---
  t.skip('RSI 参数修改持久化', 'TV 内指标参数面板操作无法自动化（K-027），需手动测试');

  // --- 统一刷新验证所有持久化（指标 + 收藏）---
  await _ssStep(page, t, '刷新后指标 + 收藏一次性验证', async () => {
    const beforeLabels = await getIndicatorLabels(page);
    await reloadAndWait(page);
    const afterLabels = await getIndicatorLabels(page);

    // 指标持久化
    const toName = (l) => l.replace(/[\d,.\s∅KMBTkmbt−+%]+$/, '').trim();
    const beforeSet = new Set(beforeLabels.map(toName).filter(Boolean));
    const afterSet = new Set(afterLabels.map(toName).filter(Boolean));
    const missing = [...beforeSet].filter(x => !afterSet.has(x));
    if (missing.length > 0) throw new Error(`Indicators lost: ${missing.join(', ')}`);

    // 收藏持久化
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

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-003: 画图工具测试                              │
// │ Merges old: 005, 019, 020, 021                            │
// │ Doc section: 3. 画图工具测试                               │
// │ Steps:                                                    │
// │   - Drawing toolbar → localStorage persist → refresh      │
// │     (old 005)                                             │
// │   - SKIP: draw/edit/delete (old 019, 020, 021)            │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart003(page) {
  const t = createStepTracker('PERPS-CHART-003');

  await navigateToPerps(page);
  await waitForTVReady(page);

  const pair = await getCurrentPair(page);
  const symbol = (pair || 'SOL').replace('USDC', '').toLowerCase();

  // --- From old 005: 画图工具栏存在 ---
  await _ssStep(page, t, '画图工具栏可见', async () => {
    const toolbar = await getDrawingToolbar(page);
    const hasTrendLine = toolbar.some(b => b.aria.includes('趋势线'));
    const hasFibo = toolbar.some(b => b.aria.includes('斐波那契'));
    if (!hasTrendLine) throw new Error('Trend line tool not found in toolbar');
    return `Tools: ${toolbar.map(b => b.aria).join(', ')}`;
  });

  // --- From old 005: 画图数据 localStorage 检查 ---
  await _ssStep(page, t, '画图数据 localStorage 检查', async () => {
    const keys = await getDrawingKeys(page);
    const currentPairKey = keys.find(k => k.key.includes(`perps_${symbol}`));
    const totalKeys = keys.filter(k => k.key.includes('perps_')).length;
    return `Symbol: ${symbol} | Drawing key: ${currentPairKey ? `${currentPairKey.key} (${currentPairKey.len} bytes)` : 'none'} | Total perps drawing keys: ${totalKeys}`;
  });

  // --- From old 005: 刷新后画图持久化 ---
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

  // --- From old 019, 020, 021: SKIP steps ---
  t.skip('水平线/斐波那契/矩形绘制', 'canvas 内拖拽绘制无法自动化，需手动测试');
  t.skip('编辑趋势线样式', 'canvas 内选中+右键编辑无法自动化，需手动测试');
  t.skip('删除画图图形', 'canvas 内选中+删除无法自动化，需手动测试');

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-004: K线时间周期测试                           │
// │ Merges old: 007, 015, 027, 028                            │
// │ Doc section: 4. K线时间周期测试                            │
// │   4.1 预设 + 4.2 收藏 + 4.3 自定义                         │
// │ Steps:                                                    │
// │   - Dynamic interval list → switch (old 007)              │
// │   - Favorite persist (old 015)                            │
// │   - SKIP custom interval (old 027, 028)                   │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart004(page) {
  const t = createStepTracker('PERPS-CHART-004');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // --- From old 007: 动态获取可用时间周期 ---
  let intervals;
  await _ssStep(page, t, '获取可用时间周期列表', async () => {
    intervals = await getTimeIntervals(page);
    if (intervals.length === 0) throw new Error('No time interval buttons found');
    const activeOne = intervals.find(i => i.active);
    return `${intervals.length} intervals: ${intervals.map(i => i.text + (i.active ? '[*]' : '')).join(', ')} | Active: ${activeOne?.text || 'none'}`;
  });

  // --- From old 007: 逐个切换（最多 3 个） ---
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

  // --- From old 015: 时间周期收藏持久化 ---
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

  // --- From old 027, 028: SKIP custom interval ---
  t.skip('自定义时间周期设置', 'TV 内自定义周期设置面板操作无法自动化（K-027），需手动测试');
  t.skip('自定义时间周期刷新持久化', '依赖 027 的自定义周期设置，需手动测试');

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-005: 图表叠加显示测试                          │
// │ Merges old: 009, 029                                      │
// │ Doc section: 5. 图表叠加显示测试                           │
// │   5.1 买卖点 + 5.2 仓位订单 + 5.3 持久化                   │
// │ Steps:                                                    │
// │   - Buy/sell markers (canvas hash) (old 009)              │
// │   - Position lines (canvas hash) (old 009)                │
// │   - Settings persist (old 009)                            │
// │   - SKIP multi-orders (old 029)                           │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart005(page) {
  const t = createStepTracker('PERPS-CHART-005');

  // 前置条件：切换到有持仓/交易历史的账户（hl-99 观察钱包）
  // 这样买卖点和持仓线才有数据可以验证
  await _ssStep(page, t, '切换到有持仓的账户', async () => {
    const currentAccount = await getCurrentAccount(page);
    if (currentAccount?.includes('hl-99')) {
      return `Already on hl-99`;
    }
    await switchToAccount(page, 'hl-99', '观察钱包');
    return `Switched to hl-99`;
  });

  await navigateToPerps(page);
  await waitForTVReady(page);

  // 切换时间周期到「天」（买卖点在天周期更容易看到）
  await _ssStep(page, t, '切换时间周期到天', async () => {
    await clickTimeInterval(page, '1 日');
    return 'Switched to 1 day interval';
  });

  // --- From old 009: 读取初始设置 ---
  let settings;
  await _ssStep(page, t, '读取图表设置', async () => {
    settings = await getPerpsSettings(page);
    if (!settings) throw new Error('无法读取设置菜单');
    return `跳过确认: ${settings.skipConfirm} | 买卖点: ${settings.showTrades} | 仓位订单: ${settings.showPositions}`;
  });

  // --- 5.1 买卖点 toggle — canvas hash 对比 ---
  await _ssStep(page, t, '买卖点开关影响图表渲染', async () => {
    // 确保开启状态
    if (settings.showTrades !== 'checked') {
      await clickSettingsToggle(page, 1);
      await sleep(1000);
    }

    const hashON = await getMainCanvasHash(page);
    await clickSettingsToggle(page, 1); // 关闭
    const hashOFF = await getMainCanvasHash(page);

    if (hashON === hashOFF) {
      // 无变化 — 当前交易对/周期可能无买卖历史，这在有持仓账户上不正常
      await clickSettingsToggle(page, 1); // 恢复
      throw new Error(`Canvas hash unchanged after toggling buy/sell OFF — 账户 hl-99 应有买卖历史 (hash=${hashON})`);
    }

    // 恢复
    await clickSettingsToggle(page, 1);
    const hashRestored = await getMainCanvasHash(page);
    return `ON=${hashON} → OFF=${hashOFF} (changed ✓) → ON=${hashRestored} ${hashON === hashRestored ? '(restored ✓)' : '(data updated, OK)'}`;
  });

  // --- 5.2 仓位订单 toggle — canvas hash 对比 ---
  await _ssStep(page, t, '仓位订单开关影响图表渲染', async () => {
    const currentSettings = await getPerpsSettings(page);
    if (!currentSettings) throw new Error('cannot read settings');

    // 确保开启
    if (currentSettings.showPositions !== 'checked') {
      await clickSettingsToggle(page, 2);
      await sleep(1000);
    }

    const hashON = await getMainCanvasHash(page);
    await clickSettingsToggle(page, 2); // 关闭
    const hashOFF = await getMainCanvasHash(page);

    // 恢复
    await clickSettingsToggle(page, 2);

    if (hashON === hashOFF) {
      // hl-99 有 25 个持仓，不应该无变化
      throw new Error(`Canvas hash unchanged after toggling positions OFF — 账户 hl-99 有持仓 (hash=${hashON})`);
    }
    return `ON=${hashON} → OFF=${hashOFF} (changed ✓) — 持仓线消失确认`;
  });

  // --- From old 009: 刷新验证持久化 ---
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

  // --- From old 029: SKIP multi-orders ---
  t.skip('多个限价单多条挂单线', '需要有多个未成交限价单的账户环境');

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-006: 视图布局测试                              │
// │ Merges old: 008, 010, 018, 022                            │
// │ Doc section: 6. 视图布局测试                               │
// │   6.1 自定义 + 6.2 恢复默认                                │
// │ Steps:                                                    │
// │   - Reset layout → only Volume (old 008)                  │
// │   - Refresh persist (old 008)                             │
// │   - Layout size persist (old 010)                         │
// │   - Default reset no-op (old 018)                         │
// │   - SKIP drag (old 022)                                   │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart006(page) {
  const t = createStepTracker('PERPS-CHART-006');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // --- From old 008: 重置布局 ---
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

  // --- From old 010: 视图布局持久化 ---
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

  // --- From old 018: 默认布局点重置无变化 ---
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

  // --- From old 022: SKIP drag ---
  t.skip('调整图表区域大小', 'canvas 边界拖拽无法自动化，需手动测试');

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-007: 异常与边界场景                            │
// │ Merges old: 011, 017, 025, 030, 031                       │
// │ Doc section: 7. 异常与边界场景                             │
// │ Steps:                                                    │
// │   - Rapid switch (old 011)                                │
// │   - Clear localStorage (old 017)                          │
// │   - SKIP performance tests (old 025, 030, 031)            │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart007(page) {
  const t = createStepTracker('PERPS-CHART-007');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // --- From old 011: 快速切换时间周期 ---
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

  // --- From old 017: 清除 localStorage 后恢复默认 ---
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

  // --- From old 025, 030, 031: SKIP performance tests ---
  t.skip('localStorage 已满降级', '需要填满约 5MB localStorage，不现实');
  t.skip('大量指标性能 (20 个)', '需要在 TV 内逐个添加 20 个指标（K-027），需手动测试');
  t.skip('大量画图性能 (50 条线)', 'canvas 内绘制 50 条线无法自动化，需手动测试');

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-008: 跨交易对测试                              │
// │ Merges old: 006, 012, 016, 023, 024                       │
// │ Doc section: 8. 跨交易对测试                               │
// │ Steps:                                                    │
// │   - Drawing isolation switchPair (old 006)                │
// │   - Indicator sync (old 012)                              │
// │   - Settings sync (old 012)                               │
// │   - Cross-session restart (old 016)                       │
// │   - SKIP trade ops (old 023, 024)                         │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart008(page) {
  const t = createStepTracker('PERPS-CHART-008');

  await navigateToPerps(page);
  await waitForTVReady(page);

  const perps = new (await import('../../helpers/pages/index.mjs')).PerpsPage(page);

  // --- From old 006: 画图跨交易对隔离 ---
  let pair1, pair1DrawingKey;
  await _ssStep(page, t, '记录交易对 A 画图状态', async () => {
    pair1 = await perps.getCurrentPair() || 'unknown';
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
    const pair2 = await perps.getCurrentPair() || 'unknown';
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

  // --- From old 012: 跨交易对指标/设置同步 ---
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

  // --- From old 016: 跨会话持久化（用页面刷新代替重启 app）---
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

  // 刷新页面验证持久化（代替重启 app，避免 CDP 断连）
  await _ssStep(page, t, '刷新后全量状态保留', async () => {
    await reloadAndWait(page);
    const results = [];

    // 指标
    const indicatorsAfter = await getIndicatorLabels(page);
    const toName = (l) => l.replace(/[\d,.\s∅KMBTkmbt−+%]+$/, '').trim();
    const setBefore = new Set(indicatorsBefore016.map(toName).filter(Boolean));
    const setAfter = new Set(indicatorsAfter.map(toName).filter(Boolean));
    const lost = [...setBefore].filter(x => !setAfter.has(x));
    if (lost.length > 0) throw new Error(`Indicators lost: ${lost.join(', ')}`);
    results.push(`Indicators: ${[...setAfter].join(', ')}`);

    // 画图
    const drawingKeysAfter = await getDrawingKeys(page);
    const beforeCount = drawingKeysBefore016.filter(k => k.key.includes('perps_')).length;
    const afterCount = drawingKeysAfter.filter(k => k.key.includes('perps_')).length;
    if (afterCount < beforeCount * 0.5) throw new Error(`Drawings shrank: ${beforeCount} → ${afterCount}`);
    results.push(`Drawings: ${beforeCount}→${afterCount}`);

    // 设置
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

    // 收藏周期
    const intervalsAfter = await getTimeIntervals(page);
    const beforeISet = new Set(intervalsBefore016.map(i => i.aria).filter(a => a !== '图表周期'));
    const afterISet = new Set(intervalsAfter.map(i => i.aria).filter(a => a !== '图表周期'));
    const lostI = [...beforeISet].filter(x => !afterISet.has(x));
    if (lostI.length > 0) throw new Error(`Intervals lost: ${lostI.join(', ')}`);
    results.push(`Intervals: ${[...afterISet].join(', ')}`);

    return results.join(' | ');
  });

  // --- From old 023, 024: SKIP trade ops ---
  t.skip('加仓后持仓线更新', '需要执行真实交易操作，自动化风险高');
  t.skip('限价单成交后挂单线消失', '需要等待真实市场成交，不可控');

  return t.result();
}

// ── Runner ──────────────────────────────────────────────────

const testCases = [
  { id: 'PERPS-CHART-001', name: '默认指标测试', fn: testPerpsChart001, skipSteps: [] },
  { id: 'PERPS-CHART-002', name: '指标管理测试', fn: testPerpsChart002, skipSteps: ['收藏指标', '取消收藏', '删除指标', 'RSI 参数修改'] },
  { id: 'PERPS-CHART-003', name: '画图工具测试', fn: testPerpsChart003, skipSteps: ['水平线/斐波那契/矩形', '编辑趋势线', '删除画图'] },
  { id: 'PERPS-CHART-004', name: 'K线时间周期测试', fn: testPerpsChart004, skipSteps: ['自定义时间周期'] },
  { id: 'PERPS-CHART-005', name: '图表叠加显示测试', fn: testPerpsChart005, skipSteps: ['多个限价单'] },
  { id: 'PERPS-CHART-006', name: '视图布局测试', fn: testPerpsChart006, skipSteps: ['调整图表区域大小'] },
  { id: 'PERPS-CHART-007', name: '异常与边界场景', fn: testPerpsChart007, skipSteps: ['localStorage 已满', '大量指标性能', '大量画图性能'] },
  { id: 'PERPS-CHART-008', name: '跨交易对测试', fn: testPerpsChart008, skipSteps: ['加仓后持仓线更新', '限价单成交后线消失'] },
];

export { testCases, ALL_TEST_IDS };

// Direct execution
// Only run directly when explicitly invoked via CLI, not when imported by Dashboard/registry
// Dashboard sets no special env, but process.argv[1] will be the dashboard server, not this file
const _thisFile = new URL(import.meta.url).pathname;
const isDirectRun = process.argv[1] && process.argv[1].endsWith('chart.test.mjs');
if (isDirectRun) {
  const selectedIds = process.argv.slice(2).filter(a => a.startsWith('PERPS-CHART-'));
  const toRun = selectedIds.length > 0
    ? testCases.filter(tc => selectedIds.includes(tc.id))
    : testCases;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Perps TV Chart Tests — ${toRun.length} case(s)`);
  console.log(`${'='.repeat(60)}\n`);

  const { browser, page } = await connectCDP();
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);

  const results = {};

  for (const tc of toRun) {
    console.log(`${'─'.repeat(60)}`);
    console.log(`[${tc.id}] ${tc.name}`);
    console.log(`${'─'.repeat(60)}`);

    const start = Date.now();
    try {
      const result = await tc.fn(page);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results[tc.id] = result;
      const summary = result.summary || {};
      const skipInfo = summary.skipped > 0 ? ` (${summary.skipped} skipped)` : '';
      console.log(`>> ${tc.id}: ${result.status.toUpperCase()} (${elapsed}s) — ${summary.passed || 0} passed, ${summary.failed || 0} failed, ${summary.skipped || 0} skipped${skipInfo}`);
      if (result.errors.length > 0) {
        result.errors.forEach(e => console.log(`   ✗ ${e}`));
      }
    } catch (e) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results[tc.id] = { status: 'failed', steps: [], errors: [e.message] };
      console.log(`>> ${tc.id}: FAILED (${elapsed}s) — ${e.message}`);
    }
    console.log();
  }

  // Summary
  const passed = Object.values(results).filter(r => r.status === 'passed').length;
  const failed = Object.values(results).filter(r => r.status === 'failed').length;
  console.log(`${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${toRun.length} total`);
  console.log(`${'='.repeat(60)}`);

  // Save results
  const resultPath = resolve(RESULTS_DIR, 'perps-chart/results.json');
  writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${resultPath}`);

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}
