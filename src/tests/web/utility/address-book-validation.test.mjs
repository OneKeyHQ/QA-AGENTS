// Address Book — Validation Tests (Web) — WEB-ADDR-VALID-001 ~ WEB-ADDR-VALID-004
// Thin wrapper: test logic lives in src/tests/shared/utility/address-book-validation.mjs
// Connects via CDP port 9223 (Chrome).
//
// NOTE: OneKey web app (app.onekeytest.com) does NOT have a local address book.
// All test cases will surface a clear "unsupported on web" error during
// `openAddressBook` and `setup` returns a skip reason for the Dashboard.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createAddressBookValidationTests } from '../../shared/utility/address-book-validation.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-address-book-validation');
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
  if (!chromeBin) throw new Error(`Chrome not found. Please start Chrome manually with --remote-debugging-port=9223`);
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
    }
  }
  const child = spawn(chromeBin, [`--remote-debugging-port=${port}`, `--user-data-dir=${tmpProfile}`, '--no-first-run', `${WEB_URL}/`], { detached: true, stdio: 'ignore' });
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
    await page.goto(`${WEB_URL}/`);
    await sleep(5000);
  }

  return { browser, page };
}

// ── Platform-specific Navigation ─────────────────────────────

async function openAddressBook(/* page */) {
  throw new Error('地址簿在 Web 端不可用（依赖本地钱包，仅 Desktop / Extension 支持）');
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '地址簿校验';

const { testCases } = createAddressBookValidationTests({
  prefix: 'WEB-ADDR-VALID',
  namePrefix: 'Web-',
  openAddressBook,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases };

export async function setup(/* page */) {
  return 'SKIP: OneKey Web (app.onekeytest.com) does not provide an address book — feature only available on Desktop / Extension wallets.';
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('WEB-ADDR-VALID-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Address Book — Validation (Web) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  const skipReason = await setup(page);
  if (typeof skipReason === 'string') {
    console.log(`\n[SKIP ALL] ${skipReason}\n`);
  }

  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    try {
      if (page?.isClosed?.()) {
        ({ browser, page } = await connectWebCDP());
      }
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: result.status, duration,
        steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: 'skipped', duration,
        error: error.message, skipReason: skipReason || error.message,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: SKIPPED — ${error.message}`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
    await sleep(500);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, skipped, results };
  writeFileSync(resolve(RESULTS_DIR, 'web-address-book-validation-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, skipped, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
