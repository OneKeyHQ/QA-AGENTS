// Market Chart Tests (Web) — MARKET-CHART-001 ~ MARKET-CHART-003
// Thin wrapper: test logic lives in src/tests/shared/market/chart.mjs
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createWebMarketChartTests } from '../../shared/market/chart.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
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
  console.log('  Chrome CDP not responding, launching Chrome...');
  const { spawn } = await import('node:child_process');
  const { existsSync, readdirSync } = await import('node:fs');
  const { execSync } = await import('node:child_process');
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const chromeBin = chromePaths.find(p => existsSync(p));
  if (!chromeBin) throw new Error(`Chrome not found. Please start Chrome manually:\n  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9223 ${WEB_URL}/market`);
  const port = new URL(CDP_URL).port || '9223';
  const tmpProfile = '/tmp/chrome-cdp-profile';
  if (!existsSync(`${tmpProfile}/Default/Preferences`)) {
    const chromeDir = `${process.env.HOME}/Library/Application Support/Google/Chrome`;
    let profileDir = null;
    if (existsSync(chromeDir)) {
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

  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      if (p.url().includes('onekeytest.com')) {
        page = p;
        break;
      }
    }
    if (page) break;
  }

  if (!page) {
    const allPages = contexts.flatMap(c => c.pages());
    page = allPages.find(p => !p.url().startsWith('chrome://'));
    if (!page) {
      const ctx = contexts[0] || await browser.newContext();
      page = await ctx.newPage();
    }
    await page.goto(`${WEB_URL}/market`);
    await sleep(5000);
  }

  return { browser, page };
}

// ── Platform-specific Navigation ─────────────────────────────

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

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '图表';

const { testCases } = createWebMarketChartTests({
  prefix: 'MARKET-CHART',
  namePrefix: '',
  navigateToTokenDetail,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases };

export async function setup(page) {
  // Navigate to Market if not already there
  if (!page.url().includes('onekeytest.com')) {
    await page.goto(`${WEB_URL}/market`);
    await sleep(3000);
  }
}

// ── Main (CLI Runner) ────────────────────────────────────────

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
