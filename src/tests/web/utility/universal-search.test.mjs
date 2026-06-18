// Universal Search Tests (Web) — WEB-SEARCH-UTIL-001 ~ WEB-SEARCH-UTIL-002
// Thin wrapper: test logic lives in src/tests/shared/utility/universal-search.mjs
// Web search tabs are dynamic; token coverage verifies token-type results
// instead of requiring a standalone "代币/Tokens" tab.
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import {
  createUniversalSearchTests,
  DEFAULT_CONFIG,
} from '../../shared/utility/universal-search.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-universal-search');
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

async function screenshotWeb(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Platform-specific: Web ───────────────────────────────────

/** Web search trigger: click the magnifying-glass SVG icon button. */
async function openSearchTrigger(page) {
  const pos = await page.evaluate(() => {
    // Find the SVG magnifying glass icon (path starts with "M11 3a8")
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
    // Fallback: try header search input
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
    throw new Error('Search trigger (SVG icon or header input) not found');
  });
  await page.mouse.click(pos.x, pos.y);
}

/** Reset to market home page — close modals, navigate to /market. */
async function resetToHome(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);

  const url = page.url();
  if (!url.includes('onekeytest.com/market') || url.includes('/market/')) {
    const clicked = await page.evaluate(() => {
      const links = document.querySelectorAll('a, button, [role="tab"]');
      for (const el of links) {
        const txt = (el.textContent || '').trim();
        const href = el.getAttribute('href') || '';
        if ((txt === '市场' || txt === 'Market') && !href.includes('/market/')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.y < 80) {
            el.click();
            return true;
          }
        }
      }
      return false;
    });
    if (!clicked) {
      await page.goto(`${WEB_URL}/market`);
    }
    await sleep(2000);
  }
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '通用搜索';

// Web tabs are dynamic. Keep labels only as optional matching hints.
const WEB_CONFIG = {
  ...DEFAULT_CONFIG,
  tabs: {
    market: '市场',
    perps: '合约',
    tokens: '代币',
  },
};

// Web renumbers tests: 003 → WEB-SEARCH-UTIL-001, 006 → WEB-SEARCH-UTIL-002
const { testCases, setup } = createUniversalSearchTests({
  prefix: 'WEB-SEARCH-UTIL',
  namePrefix: 'Web-',
  triggerFn: openSearchTrigger,
  resetToHome,
  config: WEB_CONFIG,
  customTests: [
    { id: 'WEB-SEARCH-UTIL-001', name: 'Web-代币类型搜索（USDC/btc/详情/null价格Token）', testFn: '003' },
    { id: 'WEB-SEARCH-UTIL-002', name: 'Web-合约类型搜索（中文/英文/详情/不支持Token）', testFn: '006' },
  ],
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('WEB-SEARCH-UTIL-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Universal Search Tests (Web) — ${casesToRun.length} case(s)`);
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
        ({ browser, page } = await connectWebCDP());
      }
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(300);
      await resetToHome(page);

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
  writeFileSync(resolve(RESULTS_DIR, 'web-universal-search-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
