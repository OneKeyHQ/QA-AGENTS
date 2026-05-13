// Referral Bind Invite Code Tests (Web) — WEB-REFER-001
// Thin wrapper: test logic lives in src/tests/shared/referral/bind-invite-code.mjs
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).
//
// NOTE: On the OneKey web app (app.onekeytest.com), the referral entry card may
// only appear after the user connects/unlocks a wallet in-browser. If the card
// is not visible the test will fail at the first assertion — that's expected
// signal for "feature not supported in this env".

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createBindInviteCodeTests } from '../../shared/referral/bind-invite-code.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-referral');
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
  if (!chromeBin) throw new Error(`Chrome not found. Please start Chrome manually:\n  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9223 ${WEB_URL}`);
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
  const child = spawn(chromeBin, [`--remote-debugging-port=${port}`, `--user-data-dir=${tmpProfile}`, '--no-first-run', `${WEB_URL}`], { detached: true, stdio: 'ignore' });
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
    await page.goto(WEB_URL);
    await sleep(5000);
  }

  return { browser, page };
}

// ── Platform-specific Navigation ─────────────────────────────

/** Try to navigate to wallet home or any page where the referral card might be shown. */
async function goToReferral(page) {
  // First try clicking a "钱包"/Wallets nav entry if present.
  const navigated = await page.evaluate(() => {
    for (const el of document.querySelectorAll('a, button, span, div')) {
      const text = el.textContent?.trim();
      if (['钱包', '资产', 'Wallets', 'Wallet'].includes(text)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.y < 80) { el.click(); return true; }
      }
    }
    return false;
  });
  if (!navigated) {
    // Fallback to root URL — landing page may contain the card
    await page.goto(WEB_URL);
  }
  await sleep(3000);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '返佣';

const { testCases, setup } = createBindInviteCodeTests({
  prefix: 'WEB-REFER',
  namePrefix: 'Web-',
  goToReferral,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

async function screenshotWeb(page, name) {
  try { await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` }); } catch {}
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('WEB-REFER-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Referral Bind Invite Code Tests (Web) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    try {
      if (page?.isClosed?.()) {
        console.log('  Page was closed, reconnecting CDP...');
        ({ browser, page } = await connectWebCDP());
        await setup(page);
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
        testId: test.id, status: 'failed', duration,
        error: error.message, timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) {
        await screenshotWeb(page, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    await sleep(800);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'web-referral-bind-invite-code-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
