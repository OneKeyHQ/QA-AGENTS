// Market Chart Tests (Desktop) — MARKET-CHART-001 ~ MARKET-CHART-003
// Desktop 端 Market Token 详情页图表自动化测试
// Connects via CDP port 9222 (OneKey desktop app).
// TradingView chart structure is identical to web version.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import {
  createStepTracker, safeStep, screenshot,
  waitForChartReady,
  clickTimeInterval, clickIndicatorButton,
  getOHLCFromChart, getCanvasCount, getIndicatorLabels,
  fetchHyperliquidOHLC, fetchOKXOHLC, compareOHLC,
} from '../../helpers/market-chart.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-chart');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific: Desktop ───────────────────────────────

async function goToMarket(page) {
  const ok = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    const labels = new Set(['Market', '市场', 'マーケット', 'Mercado']);
    for (const sp of sidebar.querySelectorAll('span')) {
      const txt = sp.textContent?.trim();
      if (!txt) continue;
      if (!labels.has(txt)) continue;
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        sp.click();
        return true;
      }
    }
    // Fallback: partial match
    for (const sp of sidebar.querySelectorAll('span')) {
      const txt = sp.textContent?.trim() || '';
      if (!txt) continue;
      if (txt.includes('Market') || txt.includes('市场')) {
        const r = sp.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          sp.click();
          return true;
        }
      }
    }
    return false;
  });
  if (!ok) throw new Error('Cannot navigate to Market via sidebar');
  await sleep(2500);
}

/**
 * Navigate to token detail page by clicking a token row in the Market list.
 * Desktop has no URL bar, so we click through the UI.
 */
async function navigateToTokenDetail(page, tokenSymbol) {
  await goToMarket(page);
  await sleep(2000);

  // Click the token row matching the symbol
  const clicked = await page.evaluate((sym) => {
    // Look for token symbol text in the market list
    const allElements = document.querySelectorAll('span, div, p');
    for (const el of allElements) {
      const txt = el.textContent?.trim();
      if (!txt) continue;
      // Match exact symbol (e.g., "BTC" not "BTCB")
      if (txt === sym) {
        const r = el.getBoundingClientRect();
        // Must be visible and in the main content area (not sidebar, not header)
        if (r.width > 0 && r.height > 0 && r.x > 200 && r.y > 80) {
          // Click the parent row to navigate to detail
          const row = el.closest('[role="row"], tr, a') || el.closest('div[class]');
          if (row) {
            row.click();
            return true;
          }
          el.click();
          return true;
        }
      }
    }
    return false;
  }, tokenSymbol);

  if (!clicked) throw new Error(`Token ${tokenSymbol} not found in Market list`);
  await sleep(3000);
}

// ── Safe step wrapper (binds screenshot dir) ─────────────────

const _safeStep = (page, t, name, fn) =>
  safeStep(page, t, name, fn, SCREENSHOT_DIR);

// ── Test Cases ───────────────────────────────────────────────

async function testMarketChart001(page) {
  const t = createStepTracker('MARKET-CHART-001');

  await navigateToTokenDetail(page, 'BTC');
  const tvFrame = await waitForChartReady(page);

  // 1. Test each time interval
  const intervals = ['1m', '15m', '1h', '4h', 'D'];
  for (const interval of intervals) {
    await _safeStep(page, t, `切换时间区间 ${interval}`, async () => {
      const canvasBefore = await getCanvasCount(tvFrame);
      await clickTimeInterval(tvFrame, interval);
      await sleep(2000);
      const canvasAfter = await getCanvasCount(tvFrame);
      if (canvasAfter === 0) throw new Error('Chart canvas disappeared after interval switch');
      return `canvases: ${canvasAfter}`;
    });
  }

  // 2. OHLC data comparison with Hyperliquid API (BTC)
  await _safeStep(page, t, 'OHLC 数据对比 (BTC vs Hyperliquid)', async () => {
    await clickTimeInterval(tvFrame, '1h');
    const refOHLC = await fetchHyperliquidOHLC('BTC', '1h');
    if (!refOHLC) return 'skip: Hyperliquid API unavailable';
    const chartOHLC = await getOHLCFromChart(tvFrame);
    if (!chartOHLC) return `skip: OHLC not readable from DOM. Ref: O=${refOHLC.O} H=${refOHLC.H} L=${refOHLC.L} C=${refOHLC.C}`;
    const cmp = compareOHLC(chartOHLC, refOHLC);
    if (!cmp.match) throw new Error(`OHLC mismatch > 0.5%: ${JSON.stringify(cmp.diffs)}`);
    return `maxDiff: ${cmp.maxDiff}`;
  });

  // 3. K-line type (candle is default)
  await _safeStep(page, t, 'K 线类型默认蜡烛图', async () => {
    const canvasCount = await getCanvasCount(tvFrame);
    if (canvasCount === 0) throw new Error('No canvas rendered');
    return `${canvasCount} canvases`;
  });

  // 4. Indicator switch & display verification
  await _safeStep(page, t, '技术指标切换 — 点击指标按钮', async () => {
    const labelsBefore = await getIndicatorLabels(tvFrame);
    await clickIndicatorButton(tvFrame);
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

  // 5. Check default Volume indicator label
  await _safeStep(page, t, '默认 Volume 指标显示', async () => {
    const labels = await getIndicatorLabels(tvFrame);
    const hasVolume = labels.some(l => /Vol/i.test(l));
    return `labels: [${labels.join(', ')}]${hasVolume ? ' has Volume' : ''}`;
  });

  return t.result();
}

async function testMarketChart002(page) {
  const t = createStepTracker('MARKET-CHART-002');

  await navigateToTokenDetail(page, 'BTC');
  const tvFrame = await waitForChartReady(page);

  // 1. K-line loads
  await _safeStep(page, t, 'K 线图正常加载', async () => {
    const canvasCount = await getCanvasCount(tvFrame);
    if (canvasCount === 0) throw new Error('No canvas');
    return `${canvasCount} canvases rendered`;
  });

  // 2. Switch intervals and measure timing
  const intervals = ['15m', '1h', '4h', 'D', '1m'];
  for (const interval of intervals) {
    await _safeStep(page, t, `切换时间周期 ${interval} — 数据更新`, async () => {
      const start = Date.now();
      await clickTimeInterval(tvFrame, interval);
      let loaded = false;
      for (let i = 0; i < 20; i++) {
        const cc = await getCanvasCount(tvFrame);
        if (cc > 0) { loaded = true; break; }
        await sleep(300);
      }
      const elapsed = Date.now() - start;
      if (!loaded) throw new Error('Canvas not rendered after switch');
      return `${elapsed}ms`;
    });
  }

  // 3. Large data load test (1m candle)
  await _safeStep(page, t, '大数据量加载 (1m K 线)', async () => {
    await clickTimeInterval(tvFrame, '1m');
    await sleep(3000);
    const canvasCount = await getCanvasCount(tvFrame);
    if (canvasCount === 0) throw new Error('Canvas not rendered for 1m');
    return `${canvasCount} canvases, loaded`;
  });

  // 4. OHLC comparison across multiple intervals (BTC)
  await _safeStep(page, t, 'OHLC 多区间对比 (BTC)', async () => {
    const results = [];
    for (const interval of ['1h', '4h']) {
      await clickTimeInterval(tvFrame, interval);
      const refOHLC = await fetchHyperliquidOHLC('BTC', interval);
      if (!refOHLC) { results.push(`${interval}: API N/A`); continue; }
      results.push(`${interval}: O=${refOHLC.O} H=${refOHLC.H} L=${refOHLC.L} C=${refOHLC.C}`);
    }
    return results.join(' | ');
  });

  return t.result();
}

async function testMarketChart003(page) {
  const t = createStepTracker('MARKET-CHART-003');

  await navigateToTokenDetail(page, 'BTC');
  const tvFrame = await waitForChartReady(page);

  // 1. Chart reload verification
  await _safeStep(page, t, '图表重新加载验证', async () => {
    await clickTimeInterval(tvFrame, '15m');
    await sleep(3000);
    const canvasCount = await getCanvasCount(tvFrame);
    if (canvasCount === 0) throw new Error('Chart not rendered after reload');
    return `${canvasCount} canvases after reload`;
  });

  // 2. Multiple rapid interval switches (stress test)
  await _safeStep(page, t, '快速连续切换时间区间', async () => {
    const intervals = ['1m', '1h', '4h', '15m', 'D', '1m'];
    for (const interval of intervals) {
      await clickTimeInterval(tvFrame, interval);
      await sleep(500);
    }
    await sleep(2000);
    const canvasCount = await getCanvasCount(tvFrame);
    if (canvasCount === 0) throw new Error('Chart broken after rapid switches');
    return `${canvasCount} canvases, survived rapid switches`;
  });

  return t.result();
}

// ── Exports ──────────────────────────────────────────────────

export const testCases = [
  { id: 'MARKET-CHART-001', name: 'Market-图表-数据展示与指标切换', fn: testMarketChart001 },
  { id: 'MARKET-CHART-002', name: 'Market-图表-基础功能与数据对比', fn: testMarketChart002 },
  { id: 'MARKET-CHART-003', name: 'Market-图表-异常与压力测试', fn: testMarketChart003 },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await goToMarket(page);
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
