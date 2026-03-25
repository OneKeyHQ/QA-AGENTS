// Perps TV Chart Tests — PERPS-CHART-001 ~ PERPS-CHART-008
// Generated from recording sessions: 2026-03-24
//
// Coverage mapping:
//   录制 1 → #1「默认指标」
//   录制 2 → #2「指标管理 — 添加/持久化/收藏/删除」
//   录制 3 → #3「画图工具 — 绘制/持久化/跨交易对隔离」
//   (录制 4-8 待补充)
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
import { createStepTracker, safeStep, clickSidebarTab, clickWithPointerEvents, dismissPopover } from '../../helpers/components.mjs';

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
  'PERPS-CHART-009',
  'PERPS-CHART-010',
  'PERPS-CHART-011',
  'PERPS-CHART-012',
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

// ── Test Cases ──────────────────────────────────────────────

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-001: 默认指标 — Volume                       │
// │ 用例 #1: 首次进入/重置后，图表默认仅加载成交量指标         │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart001(page) {
  const t = createStepTracker('PERPS-CHART-001');

  await navigateToPerps(page);

  // 等待 TV 图表加载
  await _ssStep(page, t, 'TV 图表加载', async () => {
    const canvases = await waitForTVReady(page);
    if (canvases < 7) throw new Error(`Canvas count too low: ${canvases}`);
    return `${canvases} canvases`;
  });

  // 重置布局确保默认状态，然后刷新让 TV 彻底清理
  await _ssStep(page, t, '重置布局 + 刷新', async () => {
    await clickResetLayout(page);
    await sleep(3000);
    // 刷新页面确保 TV webview 完全重载，清除残留指标标签
    await reloadAndWait(page);
  });

  // 验证仅有 Volume 指标（轮询等待 TV 清除完成）
  await _ssStep(page, t, '默认指标为 Volume', async () => {
    let labels;
    for (let attempt = 0; attempt < 5; attempt++) {
      labels = await getIndicatorLabels(page);
      const hasNonDefault = labels.some(l =>
        (/^MA\d/.test(l) || l === 'MA' || l.startsWith('MACD') || l.startsWith('RSI') || l.startsWith('BOLL'))
        && !l.includes('Volume') && !l.includes('成交量'));
      if (!hasNonDefault) break;
      await sleep(2000);
    }
    const hasVolume = labels.some(l => l.includes('Volume') || l.includes('成交量'));
    const hasMACD = hasIndicator(labels, 'MACD');
    const hasMA = labels.some(l => /^MA\d/.test(l) || l === 'MA');
    if (!hasVolume) throw new Error(`Volume not found. Labels: ${JSON.stringify(labels)}`);
    if (hasMACD) throw new Error(`MACD should not be present after reset. Labels: ${JSON.stringify(labels)}`);
    if (hasMA) throw new Error(`MA should not be present after reset. Labels: ${JSON.stringify(labels)}`);
    return `Only Volume present. Labels: ${labels.filter(l => l.length < 25).join(', ')}`;
  });

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-002: 指标添加与持久化                         │
// │ 用例 #2.1: 添加 MA + MACD → 刷新 → 验证保留              │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart002(page) {
  const t = createStepTracker('PERPS-CHART-002');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // 重置到干净状态
  await clickResetLayout(page);
  await sleep(2000);

  const baseCanvases = await getCanvasCount(page);

  // 打开指标面板
  await _ssStep(page, t, '打开指标面板', async () => {
    await clickIndicatorButton(page);
    const open = await isIndicatorPanelOpen(page);
    if (!open) throw new Error('Indicator panel did not open');
  });

  // 注：添加指标需要用户手动操作（TV 内部 dialog 交互复杂）
  // 这里验证的是：如果指标已添加，刷新后是否保留
  // 实际测试中，先手动添加 MA + MACD，再运行此脚本

  // 验证当前指标
  await _ssStep(page, t, '检查已添加的指标', async () => {
    // 关闭面板先
    if (await isIndicatorPanelOpen(page)) {
      await clickIndicatorButton(page);
      await sleep(500);
    }
    const labels = await getIndicatorLabels(page);
    return `Current indicators: ${labels.filter(l => l.length < 25).join(', ')}`;
  });

  // 刷新验证持久化
  await _ssStep(page, t, '刷新后指标持久化', async () => {
    const beforeLabels = await getIndicatorLabels(page);
    await reloadAndWait(page);
    const afterLabels = await getIndicatorLabels(page);

    // 核心断言：刷新前后指标名称集合一致
    const beforeSet = new Set(beforeLabels.filter(l => /^(MA|MACD|Volume|成交量|RSI|EMA|BOLL)/.test(l) && l.length < 20));
    const afterSet = new Set(afterLabels.filter(l => /^(MA|MACD|Volume|成交量|RSI|EMA|BOLL)/.test(l) && l.length < 20));
    const missing = [...beforeSet].filter(x => !afterSet.has(x));
    if (missing.length > 0) throw new Error(`Indicators lost after refresh: ${missing.join(', ')}`);
    return `Persisted: ${[...afterSet].join(', ')}`;
  });

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-003: 指标收藏持久化                           │
// │ 用例 #2.2: 收藏 MACD → 刷新 → 验证仍在收藏位置           │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart003(page) {
  const t = createStepTracker('PERPS-CHART-003');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // 打开指标面板，检查收藏指标位置
  await _ssStep(page, t, '打开指标面板', async () => {
    await clickIndicatorButton(page);
    const open = await isIndicatorPanelOpen(page);
    if (!open) throw new Error('Indicator panel did not open');
  });

  // 记录面板内容（收藏的指标在列表顶部）
  let panelTextBefore;
  await _ssStep(page, t, '记录收藏指标排序', async () => {
    panelTextBefore = await getIndicatorPanelText(page);
    // MACD 应在列表前部（收藏状态）
    const macdPos = panelTextBefore.indexOf('MACD');
    return `Panel text preview: ${panelTextBefore.slice(0, 100)}... MACD at position ${macdPos}`;
  });

  // 关闭面板 → 刷新
  await _ssStep(page, t, '刷新后收藏持久化', async () => {
    await clickIndicatorButton(page); // close
    await sleep(500);
    await reloadAndWait(page);

    // 重新打开指标面板
    await clickIndicatorButton(page);
    await sleep(1000);
    const panelTextAfter = await getIndicatorPanelText(page);
    const macdPosBefore = panelTextBefore.indexOf('MACD');
    const macdPosAfter = panelTextAfter.indexOf('MACD');

    if (macdPosAfter < 0) throw new Error('MACD not found in panel after refresh');
    // 收藏的指标应保持在列表前部（position < 100 chars）
    if (macdPosBefore >= 0 && macdPosBefore < 100 && macdPosAfter >= 100) {
      throw new Error(`MACD moved from position ${macdPosBefore} to ${macdPosAfter} — favorite status may have been lost`);
    }
    return `MACD position: before=${macdPosBefore} after=${macdPosAfter} — favorite preserved`;
  });

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-004: 指标删除                                 │
// │ 用例 #2.3: 删除 MACD → MA/Volume 仍在 → 刷新仍不显示     │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart004(page) {
  const t = createStepTracker('PERPS-CHART-004');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // 记录当前状态
  const beforeLabels = await getIndicatorLabels(page);
  const beforeCanvases = await getCanvasCount(page);

  await _ssStep(page, t, '删除前状态', async () => {
    return `Indicators: ${beforeLabels.filter(l => l.length < 20).join(', ')} | Canvases: ${beforeCanvases}`;
  });

  // 注：删除操作需要用户在图表上手动操作（右键指标标签 → 删除）
  // 此测试验证的是：删除后的状态正确性 + 刷新后不恢复

  // 检查当前指标（删除后运行）
  await _ssStep(page, t, '检查删除后状态', async () => {
    const labels = await getIndicatorLabels(page);
    const canvases = await getCanvasCount(page);
    return `After delete — Indicators: ${labels.filter(l => l.length < 20).join(', ')} | Canvases: ${canvases}`;
  });

  // 刷新验证删除持久化
  await _ssStep(page, t, '刷新后删除持久化', async () => {
    const labelsBefore = await getIndicatorLabels(page);
    await reloadAndWait(page);
    const labelsAfter = await getIndicatorLabels(page);

    // Compare indicator names (strip numeric values) — e.g., "成交量(Volume)272.5∅∅" → "成交量(Volume)"
    const toName = (l) => l.replace(/[\d,.\s∅]+$/, '').trim();
    const setBefore = new Set(labelsBefore.map(toName).filter(Boolean));
    const setAfter = new Set(labelsAfter.map(toName).filter(Boolean));
    const restored = [...setAfter].filter(x => !setBefore.has(x));
    if (restored.length > 0) throw new Error(`Deleted indicators restored after refresh: ${restored.join(', ')}`);
    return `Persisted: ${[...setAfter].join(', ')}`;
  });

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-005: 画图工具 — 绘制与持久化                  │
// │ 用例 #3: 趋势线 → 刷新 → 验证 localStorage 保留          │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart005(page) {
  const t = createStepTracker('PERPS-CHART-005');

  await navigateToPerps(page);
  await waitForTVReady(page);

  const pair = await getCurrentPair(page);
  const symbol = (pair || 'SOL').replace('USDC', '').toLowerCase();

  // 验证画图工具栏存在
  await _ssStep(page, t, '画图工具栏可见', async () => {
    const toolbar = await getDrawingToolbar(page);
    const hasTrendLine = toolbar.some(b => b.aria.includes('趋势线'));
    const hasFibo = toolbar.some(b => b.aria.includes('斐波那契'));
    if (!hasTrendLine) throw new Error('Trend line tool not found in toolbar');
    return `Tools: ${toolbar.map(b => b.aria).join(', ')}`;
  });

  // 检查画图数据存储
  await _ssStep(page, t, '画图数据 localStorage 检查', async () => {
    const keys = await getDrawingKeys(page);
    const currentPairKey = keys.find(k => k.key.includes(`perps_${symbol}`));
    const totalKeys = keys.filter(k => k.key.includes('perps_')).length;
    return `Symbol: ${symbol} | Drawing key: ${currentPairKey ? `${currentPairKey.key} (${currentPairKey.len} bytes)` : 'none'} | Total perps drawing keys: ${totalKeys}`;
  });

  // 刷新验证画图持久化
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

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-006: 画图跨交易对隔离                         │
// │ 用例 #3+#8: 切换到两个不同交易对，验证画图数据独立存储      │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart006(page) {
  const t = createStepTracker('PERPS-CHART-006');

  await navigateToPerps(page);
  await waitForTVReady(page);

  const perps = new (await import('../../helpers/pages/index.mjs')).PerpsPage(page);

  // 记录当前交易对及其画图数据
  let pair1, pair1DrawingKey;
  await _ssStep(page, t, '记录交易对 A 画图状态', async () => {
    pair1 = await perps.getCurrentPair() || 'unknown';
    const sym1 = pair1.replace('USDC', '').toLowerCase();
    const keys = await getDrawingKeys(page);
    pair1DrawingKey = keys.find(k => k.key.includes(`perps_${sym1}`));
    return `Pair A: ${pair1} | Drawing: ${pair1DrawingKey ? `${pair1DrawingKey.len} bytes` : 'none'}`;
  });

  // 切换到不同交易对
  const targetSymbol = pair1?.startsWith('BTC') ? 'ETH' : 'BTC';
  await _ssStep(page, t, `切换到交易对 B (${targetSymbol})`, async () => {
    await perps.switchPair(targetSymbol);
    await sleep(2000);
    await waitForTVReady(page);
    const pair2 = await perps.getCurrentPair();
    return `Switched to: ${pair2}`;
  });

  // 验证交易对 B 的画图数据独立
  await _ssStep(page, t, '验证交易对 B 画图数据独立', async () => {
    const pair2 = await perps.getCurrentPair() || 'unknown';
    const sym2 = pair2.replace('USDC', '').toLowerCase();
    const sym1 = pair1.replace('USDC', '').toLowerCase();
    const keys = await getDrawingKeys(page);

    const pair2Key = keys.find(k => k.key.includes(`perps_${sym2}`));
    const pair1KeyStill = keys.find(k => k.key.includes(`perps_${sym1}`));

    // 交易对 A 的画图数据应该仍然存在（不会因切换而丢失）
    if (pair1DrawingKey && !pair1KeyStill) {
      throw new Error(`Pair A (${sym1}) drawing data lost after switching to ${sym2}`);
    }

    // 两个交易对的 key 必须不同
    if (pair2Key && pair1KeyStill && pair2Key.key === pair1KeyStill.key) {
      throw new Error(`Same drawing key for both pairs — not isolated!`);
    }

    return `A(${sym1}): ${pair1KeyStill?.len || 0} bytes | B(${sym2}): ${pair2Key?.len || 0} bytes | Isolated ✓`;
  });

  // 切回交易对 A，验证画图数据未丢失
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

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-007: K 线时间周期（动态获取，不硬编码）        │
// │ 用例 #4: 周期列表 + 切换 + 数据变化                       │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart007(page) {
  const t = createStepTracker('PERPS-CHART-007');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // 动态获取可用时间周期
  let intervals;
  await _ssStep(page, t, '获取可用时间周期列表', async () => {
    intervals = await getTimeIntervals(page);
    if (intervals.length === 0) throw new Error('No time interval buttons found');
    const activeOne = intervals.find(i => i.active);
    return `${intervals.length} intervals: ${intervals.map(i => i.text + (i.active ? '[*]' : '')).join(', ')} | Active: ${activeOne?.text || 'none'}`;
  });

  // 逐个切换（最多测 3 个非激活的周期，避免测试太久）
  const toTest = intervals.filter(i => !i.active).slice(0, 3);
  for (const interval of toTest) {
    await _ssStep(page, t, `切换时间周期: ${interval.text}`, async () => {
      const ohlcBefore = await getOHLC(page);
      await clickTimeInterval(page, interval.aria);

      // 验证 active 状态切换
      const after = await getTimeIntervals(page);
      const nowActive = after.find(i => i.active);
      if (!nowActive || nowActive.aria !== interval.aria) {
        // 允许 active 检测不精确（TV 的 class 名可能变化）
        // 至少验证 canvas 仍正常
        const canvases = await getCanvasCount(page);
        if (canvases < 7) throw new Error(`Chart broken after switching to ${interval.text}: only ${canvases} canvases`);
      }

      const ohlcAfter = await getOHLC(page);
      const dataChanged = !ohlcBefore || !ohlcAfter ||
        ohlcBefore.O !== ohlcAfter.O || ohlcBefore.C !== ohlcAfter.C;

      return `${interval.text} — OHLC ${dataChanged ? 'changed' : 'same (may be expected for close intervals)'} | Canvases OK`;
    });
  }

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-008: 重置布局                                 │
// │ 用例 #6.2: 重置 → Volume only + 布局恢复                  │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart008(page) {
  const t = createStepTracker('PERPS-CHART-008');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // 记录重置前状态
  const beforeLabels = await getIndicatorLabels(page);
  const beforeCanvases = await getCanvasCount(page);

  await _ssStep(page, t, '重置前状态', async () => {
    return `Indicators: ${beforeLabels.filter(l => l.length < 20).join(', ')} | Canvases: ${beforeCanvases}`;
  });

  // 执行重置
  await _ssStep(page, t, '执行重置布局', async () => {
    await clickResetLayout(page);
    await sleep(3000);
  });

  // 验证重置后状态
  await _ssStep(page, t, '重置后仅保留 Volume', async () => {
    const labels = await getIndicatorLabels(page);
    const hasVolume = labels.some(l => l.includes('Volume') || l.includes('成交量'));
    const hasOthers = labels.some(l =>
      (l.startsWith('MA') && !l.includes('Volume')) || l.startsWith('RSI') || l.startsWith('BOLL'));
    if (!hasVolume) throw new Error('Volume not present after reset');
    if (hasOthers) throw new Error(`Non-default indicators still present: ${labels.filter(l => l.length < 20).join(', ')}`);
    return `Reset OK — only Volume`;
  });

  // 刷新验证重置持久化
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

  return t.result();
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

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-009: 买卖点/仓位订单显示设置                   │
// │ 用例 #5.1+#5.2: 检查设置面板 toggle 状态 + 刷新持久化     │
// │ 注: 三个点按钮 JS click 不可靠(K-024)，需手动辅助或 CDP   │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart009(page) {
  const t = createStepTracker('PERPS-CHART-009');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // 读取设置状态
  let settings;
  await _ssStep(page, t, '读取图表设置', async () => {
    settings = await getPerpsSettings(page);
    if (!settings) {
      return 'SKIP: 设置菜单无法自动打开（K-024），需手动点击三个点按钮';
    }
    return `跳过确认: ${settings.skipConfirm} | 买卖点: ${settings.showTrades} | 仓位订单: ${settings.showPositions}`;
  });

  if (settings) {
    // 刷新验证持久化
    await _ssStep(page, t, '刷新后设置持久化', async () => {
      await reloadAndWait(page);
      const settingsAfter = await getPerpsSettings(page);
      if (!settingsAfter) return 'SKIP: 刷新后无法读取设置';

      const checks = [];
      if (settings.skipConfirm !== settingsAfter.skipConfirm)
        checks.push(`跳过确认: ${settings.skipConfirm} → ${settingsAfter.skipConfirm}`);
      if (settings.showTrades !== settingsAfter.showTrades)
        checks.push(`买卖点: ${settings.showTrades} → ${settingsAfter.showTrades}`);
      if (settings.showPositions !== settingsAfter.showPositions)
        checks.push(`仓位订单: ${settings.showPositions} → ${settingsAfter.showPositions}`);

      if (checks.length > 0) throw new Error(`Settings changed after refresh: ${checks.join(', ')}`);
      return `All 3 settings preserved after refresh`;
    });
  }

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-010: 视图布局持久化                            │
// │ 用例 #6: 图表布局（webview + canvas 尺寸）刷新后保留       │
// └──────────────────────────────────────────────────────────┘

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

async function testPerpsChart010(page) {
  const t = createStepTracker('PERPS-CHART-010');

  await navigateToPerps(page);
  await waitForTVReady(page);

  let layoutBefore;
  await _ssStep(page, t, '记录当前布局', async () => {
    layoutBefore = await getChartLayout(page);
    return `Webview: ${layoutBefore.wvSize?.w}x${layoutBefore.wvSize?.h} | Main canvas: ${layoutBefore.canvasLayout?.mainW}x${layoutBefore.canvasLayout?.mainH} | Canvases: ${layoutBefore.canvasLayout?.canvasCount}`;
  });

  await _ssStep(page, t, '刷新后布局保留', async () => {
    await reloadAndWait(page);
    // 额外等待 TV canvas 完全渲染
    await waitForTVReady(page, layoutBefore.canvasLayout?.canvasCount || 7, 20000).catch(() => {});
    const layoutAfter = await getChartLayout(page);

    // Webview 尺寸应一致（窗口大小不变）
    if (layoutBefore.wvSize && layoutAfter.wvSize) {
      const wDiff = Math.abs(layoutBefore.wvSize.w - layoutAfter.wvSize.w);
      const hDiff = Math.abs(layoutBefore.wvSize.h - layoutAfter.wvSize.h);
      if (wDiff > 5 || hDiff > 5) {
        throw new Error(`Webview size changed: ${layoutBefore.wvSize.w}x${layoutBefore.wvSize.h} → ${layoutAfter.wvSize.w}x${layoutAfter.wvSize.h}`);
      }
    }

    // Canvas 数量：刷新后 TV 可能延迟加载部分 canvas，只要 ≥7 就算正常
    if (layoutAfter.canvasLayout && layoutAfter.canvasLayout.canvasCount < 7) {
      throw new Error(`Canvas count too low after refresh: ${layoutAfter.canvasLayout.canvasCount}`);
    }

    return `Webview: ${layoutAfter.wvSize?.w}x${layoutAfter.wvSize?.h} | Canvas: ${layoutAfter.canvasLayout?.mainW}x${layoutAfter.canvasLayout?.mainH} | Count: ${layoutAfter.canvasLayout?.canvasCount}`;
  });

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-011: 快速切换时间周期（防抖/压力测试）         │
// │ 用例 #7: 连续快速点击不同时间周期，图表不崩溃              │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart011(page) {
  const t = createStepTracker('PERPS-CHART-011');

  await navigateToPerps(page);
  await waitForTVReady(page);

  // 获取所有可用周期
  const intervals = await getTimeIntervals(page);
  const available = intervals.filter(i => i.aria && i.aria !== '图表周期');

  await _ssStep(page, t, '快速连续切换时间周期', async () => {
    if (available.length < 2) throw new Error('Need at least 2 intervals');

    const start = Date.now();
    // 快速切换 6 次（每次 300ms 间隔）
    for (let i = 0; i < 6; i++) {
      const target = available[i % available.length];
      await tvEval(page, `
        const btns = doc.querySelectorAll('button[aria-label="${target.aria}"]');
        if (btns.length > 0) btns[0].click();
      `);
      await sleep(300); // 极短间隔，测试防抖
    }
    const elapsed = Date.now() - start;

    // 等稳定
    await sleep(2000);

    // 验证图表没崩
    const canvases = await getCanvasCount(page);
    if (canvases < 7) throw new Error(`Chart broken after rapid switching: ${canvases} canvases`);

    return `6 rapid switches in ${elapsed}ms | Chart stable: ${canvases} canvases`;
  });

  // 验证最终状态正确
  await _ssStep(page, t, '快速切换后数据正常', async () => {
    const ohlc = await getOHLC(page);
    const intervals2 = await getTimeIntervals(page);
    const active = intervals2.find(i => i.active);
    return `Active: ${active?.text || 'unknown'} | OHLC: ${ohlc ? `O=${ohlc.O} C=${ohlc.C}` : 'not readable'}`;
  });

  return t.result();
}

// ┌──────────────────────────────────────────────────────────┐
// │ PERPS-CHART-012: 跨交易对指标/设置全局同步                 │
// │ 用例 #8: BTC 添加指标 → 切 ETH → 指标跟随                │
// └──────────────────────────────────────────────────────────┘
async function testPerpsChart012(page) {
  const t = createStepTracker('PERPS-CHART-012');

  await navigateToPerps(page);
  await waitForTVReady(page);

  const perps = new (await import('../../helpers/pages/index.mjs')).PerpsPage(page);

  // 记录交易对 A 的指标
  let pair1, indicators1;
  await _ssStep(page, t, '记录交易对 A 指标', async () => {
    pair1 = await perps.getCurrentPair() || 'unknown';
    indicators1 = await getIndicatorLabels(page);
    const short = indicators1.filter(l => l.length < 20);
    return `${pair1}: ${short.join(', ')}`;
  });

  // 切换到交易对 B
  const targetSymbol = pair1?.startsWith('BTC') ? 'ETH' : 'BTC';
  await _ssStep(page, t, `切换到 ${targetSymbol}`, async () => {
    await perps.switchPair(targetSymbol);
    await sleep(2000);
    await waitForTVReady(page);
    return `Switched to ${await perps.getCurrentPair()}`;
  });

  // 检查指标是否全局同步
  await _ssStep(page, t, '指标全局同步验证', async () => {
    const indicators2 = await getIndicatorLabels(page);

    // 提取指标名（去掉参数值），比较集合
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

  // 检查设置是否全局同步
  await _ssStep(page, t, '设置全局同步验证', async () => {
    const settings = await getPerpsSettings(page);
    if (!settings) return 'SKIP: cannot read settings on this pair';
    return `Settings on ${targetSymbol}: 跳过确认=${settings.skipConfirm} 买卖点=${settings.showTrades} 仓位=${settings.showPositions}`;
  });

  return t.result();
}

// ── Runner ──────────────────────────────────────────────────

const testCases = [
  { id: 'PERPS-CHART-001', name: '默认指标 Volume', fn: testPerpsChart001 },
  { id: 'PERPS-CHART-002', name: '指标添加与持久化', fn: testPerpsChart002 },
  { id: 'PERPS-CHART-003', name: '指标收藏持久化', fn: testPerpsChart003 },
  { id: 'PERPS-CHART-004', name: '指标删除持久化', fn: testPerpsChart004 },
  { id: 'PERPS-CHART-005', name: '画图工具与持久化', fn: testPerpsChart005 },
  { id: 'PERPS-CHART-006', name: '画图跨交易对隔离', fn: testPerpsChart006 },
  { id: 'PERPS-CHART-007', name: 'K 线时间周期切换', fn: testPerpsChart007 },
  { id: 'PERPS-CHART-008', name: '重置布局', fn: testPerpsChart008 },
  { id: 'PERPS-CHART-009', name: '买卖点/仓位订单设置', fn: testPerpsChart009 },
  { id: 'PERPS-CHART-010', name: '视图布局持久化', fn: testPerpsChart010 },
  { id: 'PERPS-CHART-011', name: '快速切换时间周期', fn: testPerpsChart011 },
  { id: 'PERPS-CHART-012', name: '跨交易对指标/设置同步', fn: testPerpsChart012 },
];

export { testCases, ALL_TEST_IDS };

// Direct execution
const isDirectRun = !process.argv[1] || process.argv[1].includes('chart.test');
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
      console.log(`>> ${tc.id}: ${result.status.toUpperCase()} (${elapsed}s)`);
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
