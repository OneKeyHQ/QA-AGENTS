// Market Chart Parity Tests (Web) — MARKET-CHART-PARITY-001
// PoC wrapper for built-in chart vs TradingView comparison on a dedicated harness page.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createWebMarketChartParityTests } from '../../shared/market/chart-parity.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const CHART_PARITY_PATH = process.env.CHART_PARITY_PATH || '/market/chart-parity';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-chart-parity');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function ensureChromeRunning() {
  for (let i = 0; i < 2; i++) {
    try {
      const resp = await fetch(`${CDP_URL}/json/version`);
      if (resp.ok) return;
    } catch {}
    if (i === 0) await sleep(500);
  }

  const { spawn } = await import('node:child_process');
  const { existsSync } = await import('node:fs');
  const chromeBin = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].find((candidate) => existsSync(candidate));
  if (!chromeBin) {
    throw new Error('Chrome not found. Please start Chrome with CDP enabled.');
  }

  const port = new URL(CDP_URL).port || '9223';
  const targetUrl = `${WEB_URL}${CHART_PARITY_PATH}`;
  const child = spawn(chromeBin, [`--remote-debugging-port=${port}`, '--user-data-dir=/tmp/chrome-cdp-profile', '--no-first-run', targetUrl], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try {
      const resp = await fetch(`${CDP_URL}/json/version`);
      if (resp.ok) return;
    } catch {}
  }
  throw new Error('Chrome failed to start within 30s');
}

async function connectWebCDP() {
  await ensureChromeRunning();
  const browser = await chromium.connectOverCDP(CDP_URL);
  const contexts = browser.contexts();
  let page = null;
  for (const ctx of contexts) {
    for (const candidate of ctx.pages()) {
      if (candidate.url().includes('onekeytest.com')) {
        page = candidate;
        break;
      }
    }
    if (page) break;
  }

  if (!page) {
    const allPages = contexts.flatMap((ctx) => ctx.pages());
    page = allPages.find((candidate) => !candidate.url().startsWith('chrome://'));
    if (!page) {
      const ctx = contexts[0] || await browser.newContext();
      page = await ctx.newPage();
    }
  }
  return { browser, page };
}

async function navigateToParityHarness(page) {
  const targetUrl = `${WEB_URL}${CHART_PARITY_PATH}`;
  if (page.url().startsWith(targetUrl)) return;
  await page.goto(targetUrl);
  await sleep(3000);
}

export const displayName = '图表对比';

const { testCases } = createWebMarketChartParityTests({
  prefix: 'MARKET-CHART-PARITY',
  namePrefix: '',
  navigateToParityHarness,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases };

export async function setup(page) {
  await navigateToParityHarness(page);
}

export async function run() {
  const filter = process.argv.slice(2).find((arg) => arg.startsWith('MARKET-CHART-PARITY-'));
  const casesToRun = filter ? testCases.filter((item) => item.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  const { page } = await connectWebCDP();
  await setup(page);

  const results = [];
  console.log('\n' + '='.repeat(60));
  console.log(`  Market Chart Parity Tests (Web) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  for (const test of casesToRun) {
    const start = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    try {
      const result = await test.fn(page);
      const duration = Date.now() - start;
      const payload = {
        testId: test.id,
        name: test.name,
        ...result,
        duration,
        timestamp: new Date().toISOString(),
      };
      results.push(payload);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(payload, null, 2));
      console.log(`>> ${test.id}: ${payload.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
    } catch (error) {
      const duration = Date.now() - start;
      const payload = {
        testId: test.id,
        name: test.name,
        status: 'failed',
        errors: [error.message],
        duration,
        timestamp: new Date().toISOString(),
      };
      results.push(payload);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(payload, null, 2));
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
    }
  }

  const passed = results.filter((item) => item.status === 'passed').length;
  const failed = results.filter((item) => item.status !== 'passed').length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) run().catch((e) => { console.error(e); process.exit(1); });
