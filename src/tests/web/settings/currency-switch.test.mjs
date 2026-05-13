// Currency Switch Test (Web) — WEB-SETTINGS-002
// Thin wrapper: test logic lives in src/tests/shared/settings/currency-switch.mjs
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).
//
// Note: Web build may not expose the same "Preferences" modal as Desktop. If the
// settings entry or wallet currency header cannot be found, the test will fail
// with a clear error — which is expected until a Web Settings flow is implemented.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createCurrencySwitchTests } from '../../shared/settings/currency-switch.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-currency-switch');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── CDP Connection (Web) ─────────────────────────────────────

async function ensureChromeRunning() {
  for (let i = 0; i < 2; i++) {
    try {
      const resp = await fetch(`${CDP_URL}/json/version`);
      if (resp.ok) return;
    } catch {}
    if (i === 0) await sleep(500);
  }
  const { spawn } = await import('node:child_process');
  const { existsSync, readdirSync } = await import('node:fs');
  const { execSync } = await import('node:child_process');
  const chromePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  const chromeBin = chromePaths.find(p => existsSync(p));
  if (!chromeBin) throw new Error(`Chrome not found.`);
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
  const child = spawn(chromeBin, [`--remote-debugging-port=${port}`, `--user-data-dir=${tmpProfile}`, '--no-first-run', WEB_URL], { detached: true, stdio: 'ignore' });
  child.unref();
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    try { const resp = await fetch(`${CDP_URL}/json/version`); if (resp.ok) return; } catch {}
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
      if (p.url().includes('onekeytest.com')) { page = p; break; }
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

async function screenshotWeb(page, name) {
  try { await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` }); } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────

async function openSettings(page) {
  const clicked = await page.evaluate(() => {
    const byTestid = document.querySelector(
      '[data-testid*="setting" i], [data-testid*="preference" i], [data-testid*="avatar" i]'
    );
    if (byTestid) {
      const r = byTestid.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { byTestid.click(); return true; }
    }
    const ariaCandidates = document.querySelectorAll('[aria-label*="setting" i], [aria-label*="preference" i]');
    for (const el of ariaCandidates) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { el.click(); return true; }
    }
    return false;
  });
  if (!clicked) throw new Error('Settings entry not found (web)');
  await sleep(1500);

  const labels = ['偏好设置', '偏好設置', 'Preferences', 'Settings', '设置', '設置', 'Préférences', 'Einstellungen'];
  const clickedItem = await page.evaluate((labs) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent?.trim();
      if (t && labs.includes(t)) {
        const el = node.parentElement;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { el.click(); return true; }
      }
    }
    return false;
  }, labels);
  if (clickedItem) await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '切换法币';

const { testCases, setup } = createCurrencySwitchTests({
  prefix: 'WEB-SETTINGS',
  namePrefix: 'Web-',
  openSettings,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('WEB-SETTINGS-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) { console.error(`No tests matching "${filter}"`); return { status: 'error' }; }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Currency Switch Test (Web) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);
  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n[${test.id}] ${test.name}`);
    try {
      if (page?.isClosed?.()) { ({ browser, page } = await connectWebCDP()); await setup(page); }
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = { testId: test.id, status: result.status, duration, steps: result.steps, errors: result.errors, timestamp: new Date().toISOString() };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = { testId: test.id, status: 'failed', duration, error: error.message, timestamp: new Date().toISOString() };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      if (page && !page?.isClosed?.()) await screenshotWeb(page, `${test.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
    await sleep(800);
  }
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
