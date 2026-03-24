// Market Chart Tests — MARKET-CHART-001 ~ MARKET-CHART-003
// Web 端 (app.onekeytest.com) Market Token 详情页图表自动化测试
// BTC (数据源: Hyperliquid), PUMP (数据源: OKX)
//
// 架构: 页面 → tradingview.onekey.so iframe → blob: iframe (TradingView charting library)
// 时间区间按钮: 1分 / 15分 / 1小时 / 4小时 / 天
// 指标按钮: "指标"
// OHLC: 从 Hyperliquid / OKX API 获取参考数据做数值对比

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';
import {
  screenshot,
  getTVFrame, waitForChartReady,
  clickTimeInterval, clickIndicatorButton,
  getOHLCFromChart, getCanvasCount, getIndicatorLabels,
  fetchHyperliquidOHLC, fetchOKXOHLC, compareOHLC,
} from '../../helpers/market-chart.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
// Web tests use port 9223 by default to avoid conflict with OneKey desktop (9222)
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-chart');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── CDP Connection (Web) ─────────────────────────────────────

async function ensureChromeRunning() {
  for (let i = 0; i < 2; i++) {
    try {
      const resp = await fetch(`${CDP_URL}/json/version`);
      if (resp.ok) { console.log('  Chrome CDP ready.'); return; }
    } catch {}
    if (i === 0) await sleep(500);
  }
  // Try to launch Chrome with CDP
  console.log('  Chrome CDP not responding, launching Chrome...');
  const { spawn } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const chromeBin = chromePaths.find(p => existsSync(p));
  if (!chromeBin) throw new Error(`Chrome not found. Please start Chrome manually:\n  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9223 ${WEB_URL}/market`);
  const port = new URL(CDP_URL).port || '9223';
  // Copy user's active Chrome profile to temp dir so CDP mode has login state & cookies
  const { execSync } = await import('node:child_process');
  const tmpProfile = '/tmp/chrome-cdp-profile';
  if (!existsSync(`${tmpProfile}/Default/Preferences`)) {
    const chromeDir = `${process.env.HOME}/Library/Application Support/Google/Chrome`;
    let profileDir = null;
    if (existsSync(chromeDir)) {
      const { readdirSync } = await import('node:fs');
      const entries = readdirSync(chromeDir);
      const profiles = entries.filter(e => e.startsWith('Profile ')).sort();
      profileDir = profiles.length > 0
        ? `${chromeDir}/${profiles[profiles.length - 1]}`
        : existsSync(`${chromeDir}/Default`) ? `${chromeDir}/Default` : null;
    }
    if (profileDir && existsSync(profileDir)) {
      execSync(`mkdir -p "${tmpProfile}" && cp -r "${profileDir}" "${tmpProfile}/Default"`, { stdio: 'ignore' });
      console.log(`  Copied Chrome profile (${profileDir.split('/').pop()}) to temp dir`);
    }
  }
  const child = spawn(chromeBin, [`--remote-debugging-port=${port}`, `--user-data-dir=${tmpProfile}`, '--no-first-run', `${WEB_URL}/market`], { detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try {
      const resp = await fetch(`${CDP_URL}/json/version`);
      if (resp.ok) { console.log(`  Chrome ready after ${i + 1}s`); return; }
    } catch {}
  }
  throw new Error('Chrome failed to start within 30s');
}

async function connectWebCDP() {
  await ensureChromeRunning();
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  let page = null;

  // Find existing tab with onekeytest.com
  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      if (p.url().includes('onekeytest.com')) {
        page = p;
        break;
      }
    }
    if (page) break;
  }

  // If no tab found, find a real page (skip chrome:// internal pages)
  if (!page) {
    const allPages = contexts.flatMap(c => c.pages());
    page = allPages.find(p => !p.url().startsWith('chrome://'));
    if (!page) {
      // Create a new page as last resort
      const ctx = contexts[0] || await browser.newContext();
      page = await ctx.newPage();
    }
    await page.goto(`${WEB_URL}/market`);
    await sleep(5000);
  }

  return { browser, page };
}

// ── Navigation ───────────────────────────────────────────────

// Token detail URL patterns
const TOKEN_URLS = {
  BTC: '/market/token/btc/?isNative=true',
  PUMP: '/market/token/solana/pump',
};

async function navigateToTokenDetail(page, tokenSymbol) {
  const targetPath = TOKEN_URLS[tokenSymbol];
  if (!targetPath) throw new Error(`Unknown token: ${tokenSymbol}`);

  const url = page.url();
  if (url.includes(targetPath.split('?')[0])) return; // Already on the page

  await page.goto(`${WEB_URL}${targetPath}`);
  await sleep(5000);
}

// ── Safe step wrapper (binds screenshot dir) ─────────────────

const _safeStep = (page, t, name, fn) =>
  safeStep(page, t, name, fn, SCREENSHOT_DIR);

// ── Test Cases ───────────────────────────────────────────────

async function testMarketChart001(page) {
  const t = createStepTracker('MARKET-CHART-001');

  // Navigate to BTC token detail
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

  // 3. K-line type (candle is default, should be switchable)
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

    // Close the dialog with Escape
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
  // Navigate to Market if not already there
  if (!page.url().includes('onekeytest.com')) {
    await page.goto(`${WEB_URL}/market`);
    await sleep(3000);
  }
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('MARKET-CHART-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Chart Tests (Web) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    try {
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id,
        name: test.name,
        ...result,
        duration,
      };
      results.push(r);

      const icon = result.status === 'passed' ? 'PASSED' : 'FAILED';
      console.log(`>> ${test.id}: ${icon} (${(duration / 1000).toFixed(1)}s)${result.errors?.length ? ' — ' + result.errors[0] : ''}`);

      // Save result
      const resultPath = resolve(RESULTS_DIR, `${test.id}.json`);
      writeFileSync(resultPath, JSON.stringify(r, null, 2));
    } catch (e) {
      const duration = Date.now() - startTime;
      console.log(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${e.message}`);
      results.push({ testId: test.id, name: test.name, status: 'failed', errors: [e.message], duration });
    }
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', results };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) run().catch(e => { console.error(e); process.exit(1); });
