// Market Favorite Tests (Web) — WEB-MARKET-FAV-001 ~ WEB-MARKET-FAV-007
// Thin wrapper: test logic lives in src/tests/shared/market/favorite.mjs
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createMarketFavoriteTests } from '../../shared/market/favorite.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-market-favorite');
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
    await page.goto(`${WEB_URL}/market`);
    await sleep(5000);
  }

  return { browser, page };
}

async function screenshotWeb(page, name) {
  try { await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` }); } catch {}
}

// ── Platform-specific Navigation ─────────────────────────────

async function goToMarket(page) {
  const url = page.url();
  if (url.includes('onekeytest.com/market')) return;
  await page.goto(`${WEB_URL}/market`);
  await sleep(3000);
}

/**
 * Web has no in-page Wallet entry (Wallet is a separate page/section that
 * usually requires sign-in / different navigation). For now we don't provide
 * goToWallet on Web; case 005 will be marked SKIP automatically.
 */
const goToWallet = undefined;

async function triggerSearch(page) {
  const pos = await page.evaluate(() => {
    const svgs = document.querySelectorAll('svg');
    for (const svg of svgs) {
      const paths = svg.querySelectorAll('path');
      for (const p of paths) {
        const d = p.getAttribute('d') || '';
        if (d.startsWith('M11 3a8') || d.startsWith('M11 3')) {
          const btn = svg.closest('button') || svg.closest('[role="button"]') || svg.parentElement;
          if (btn) {
            const r = btn.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
          }
          const r = svg.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
    }
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const inputs = Array.from(document.querySelectorAll('input[data-testid="nav-header-search"]'));
    const input = inputs.find(el => {
      if (modal && modal.contains(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (input) {
      const r = input.getBoundingClientRect();
      return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
    }
    throw new Error('Search trigger not found');
  });
  await page.mouse.click(pos.x, pos.y);
}

/** Web: main tabs are typically at y~60-220. */
async function clickMainTab(page, name) {
  const clicked = await page.evaluate((tabName) => {
    for (const el of document.querySelectorAll('span')) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() !== tabName) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.y > 60 && r.y < 220) {
        el.click();
        return true;
      }
    }
    return false;
  }, name);
  if (!clicked) throw new Error(`Cannot click tab "${name}"`);
  await sleep(1500);
}

/** Web: sub-tabs appear below the main-tab area. */
async function clickSubTab(page, name) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const clicked = await page.evaluate((tabName) => {
      const matches = [];
      for (const el of document.querySelectorAll('span')) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() !== tabName) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 130 && r.y < 360) {
          matches.push({ el, y: r.y });
        }
      }
      if (matches.length === 0) return false;
      matches.sort((a, b) => a.y - b.y);
      matches[0].el.click();
      return true;
    }, name);
    if (clicked) { await sleep(1500); return; }
    await sleep(500);
  }
  throw new Error(`Cannot click sub-tab "${name}"`);
}

async function clickNetworkFilter(page, network) {
  const clicked = await page.evaluate((net) => {
    for (const el of document.querySelectorAll('span')) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() !== net) continue;
      el.scrollIntoView({ inline: 'center', block: 'nearest' });
      el.click();
      return true;
    }
    for (const el of document.querySelectorAll('button, div, [role="option"]')) {
      if (el.textContent?.trim() !== net || el.children.length > 2) continue;
      el.scrollIntoView({ inline: 'center', block: 'nearest' });
      el.click();
      return true;
    }
    return false;
  }, network);
  if (!clicked) throw new Error(`Cannot click network filter "${network}"`);
  await sleep(1500);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '收藏';

const { testCases, setup: sharedSetup } = createMarketFavoriteTests({
  prefix: 'WEB-MARKET-FAV',
  namePrefix: 'Web-',
  goToMarket,
  goToWallet,
  triggerSearch,
  clickMainTab,
  clickSubTab,
  clickNetworkFilter,
});

export { testCases };

export async function setup(page) {
  if (!page.url().includes('onekeytest.com')) {
    await page.goto(`${WEB_URL}/market`);
    await sleep(3000);
  }
  await sharedSetup(page);
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('WEB-MARKET-FAV-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Favorite Tests (Web) — ${casesToRun.length} case(s)`);
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
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(300);
      await goToMarket(page);

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
  writeFileSync(resolve(RESULTS_DIR, 'web-market-favorite-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
