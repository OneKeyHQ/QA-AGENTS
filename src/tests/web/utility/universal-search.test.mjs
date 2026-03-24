// Universal Search Tests (Web) — WEB-SEARCH-UTIL-001 ~ WEB-SEARCH-UTIL-002
// Web version: only 3 tabs available (市场/合约/代币). No 账户/我的资产/dApps/设置.
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).
//
// Key stable selectors:
// - Search input:   [data-testid="nav-header-search"] (inside APP-Modal-Screen)
// - Clear button:   [data-testid="-clear"]
// - Close search:   [data-testid="nav-header-close"]
// - Back button:    [data-testid="nav-header-back"]
// - Search results: [data-testid="select-item-"], [data-testid="select-item-subtitle-"]

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';
import {
  isSearchModalOpen, getModalSearchInput,
  openSearchModal, setSearchValueStrict, ensureSearchOpen,
  clearSearch, closeSearch,
} from '../../helpers/market-search.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-universal-search');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── CONFIG — all search parameters ─────────────────────────────
const CONFIG = {
  // Scenario 1: Tokens Tab
  tokenUSDC: 'USDC',
  tokenBTC: 'btc',
  tokenPOWR: 'POWER',
  tokenPOWRExpected: 'POWR',
  tokenAIP: 'aip',
  tokenAIPExpected: 'PettAI',

  // Scenario 2: Perps Tab
  perpsChinese: '比特',
  perpsETH: 'eth',
  perpsETHExpected: 'ETH - USDC',
  perpsUnsupported: 'usdc',

  // Tab names (Web only has 3 tabs)
  tabs: {
    market: '市场',
    perps: '合约',
    tokens: '代币',
  },
};

const ALL_TEST_IDS = [
  'WEB-SEARCH-UTIL-001',
  'WEB-SEARCH-UTIL-002',
];

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

// ── Platform-specific: Web ───────────────────────────────────

async function screenshotWeb(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

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

// Convenience wrappers that bind the web trigger
const _open = (page) => openSearchModal(page, openSearchTrigger);
const _ensure = (page) => ensureSearchOpen(page, openSearchTrigger);
const _setStrict = (page, v) => setSearchValueStrict(page, v, openSearchTrigger);

// ── Universal Search Helper Functions ────────────────────────

/**
 * Reset to market home page — close modals, navigate to /market.
 */
async function resetToHome(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);

  const url = page.url();
  if (!url.includes('onekeytest.com/market') || url.includes('/market/')) {
    // Navigate to market home via header button or direct URL
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

/**
 * Open search modal — resets to home first if needed, then opens search.
 */
async function openSearch(page) {
  if (await isSearchModalOpen(page)) return;
  try {
    await _ensure(page);
  } catch {
    await resetToHome(page);
    await _ensure(page);
  }
}

/**
 * Input search value — clears existing and types new value with pressSequentially.
 * If modal input is not accessible, resets to home and retries.
 */
async function inputSearch(page, value) {
  try {
    await _setStrict(page, value);
  } catch {
    await resetToHome(page);
    await openSearch(page);
    await _setStrict(page, value);
  }
}

/**
 * Switch to a specific tab inside the search modal.
 * @param {string} tabName - Tab text (e.g., '市场', '合约', '代币')
 */
async function switchSearchTab(page, tabName) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const clicked = await page.evaluate((name) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      for (const el of modal.querySelectorAll('span')) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() !== name) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 130 && r.y < 200) {
          el.click();
          return true;
        }
      }
      return false;
    }, tabName);
    if (clicked) { await sleep(1000); return; }
    await sleep(500);
  }
  throw new Error(`Tab "${tabName}" not found in search modal`);
}

/**
 * Get search results from the modal.
 */
async function getSearchResults(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return [];
    const items = modal.querySelectorAll('[data-testid^="select-item-"]');
    const results = [];
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const subtitle = item.querySelector('[data-testid^="select-item-subtitle-"]');
      results.push({
        text: item.textContent?.trim() || '',
        subtitle: subtitle?.textContent?.trim() || '',
      });
    }
    return results;
  });
}

/**
 * Check if search results exist (with polling retry).
 */
async function hasSearchResults(page, maxRetries = 10, intervalMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    const count = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return 0;
      const items = modal.querySelectorAll('[data-testid^="select-item-"]');
      let visible = 0;
      for (const item of items) {
        const r = item.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) visible++;
      }
      if (visible > 0) return visible;
      const rows = modal.querySelectorAll('div[tabindex], div[role="button"], div[role="option"]');
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        if (r.width > 200 && r.height > 20 && r.height < 100 && r.y > 150) visible++;
      }
      return visible;
    });
    if (count > 0) return true;
    await sleep(intervalMs);
  }
  return false;
}

/**
 * Assert that search results exist. Throws if not found after polling.
 */
async function assertHasResults(page, context = '') {
  const found = await hasSearchResults(page);
  if (!found) {
    const fallback = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      const text = modal.textContent || '';
      const hasEmpty = text.includes('未找到') || text.includes('No results')
        || text.includes('暂无') || text.includes('无结果');
      if (hasEmpty) return false;
      const divs = modal.querySelectorAll('div');
      let contentRows = 0;
      for (const d of divs) {
        const r = d.getBoundingClientRect();
        if (r.width < 200 || r.height < 20 || r.height > 80 || r.y < 180) continue;
        const t = d.textContent?.trim() || '';
        if (t.length > 3 && t.length < 200) contentRows++;
      }
      return contentRows > 2;
    });
    if (!fallback) {
      throw new Error(`No search results found${context ? ` (${context})` : ''}`);
    }
  }
}

/**
 * Assert that there are NO search results (empty state).
 */
async function assertNoResults(page, context = '') {
  await sleep(2000);
  const hasResults = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const text = modal.textContent || '';
    const hasEmpty = text.includes('未找到') || text.includes('No results')
      || text.includes('暂无') || text.includes('无结果') || text.includes('没有找到');
    if (hasEmpty) return false;
    const items = modal.querySelectorAll('[data-testid^="select-item-"]');
    let visible = 0;
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) visible++;
    }
    return visible > 0;
  });
  if (hasResults) {
    throw new Error(`Expected no results but found some${context ? ` (${context})` : ''}`);
  }
}

/**
 * Click a search result by index (0-based).
 */
async function clickSearchResultByIndex(page, index = 0) {
  const clicked = await page.evaluate((idx) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const items = modal.querySelectorAll('[data-testid^="select-item-"]');
    const visible = [];
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) visible.push(item);
    }
    if (visible.length === 0) {
      const rows = [];
      modal.querySelectorAll('div').forEach(d => {
        const r = d.getBoundingClientRect();
        if (r.width > 200 && r.height > 30 && r.height < 80 && r.y > 180) {
          const t = d.textContent?.trim() || '';
          if (t.length > 3) rows.push(d);
        }
      });
      if (idx < rows.length) { rows[idx].click(); return true; }
      return false;
    }
    if (idx < visible.length) { visible[idx].click(); return true; }
    return false;
  }, index);
  if (clicked) await sleep(1500);
  return clicked;
}

/**
 * Click a search result containing specific text.
 */
async function clickSearchResultByText(page, text) {
  const clicked = await page.evaluate((searchText) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const items = modal.querySelectorAll('[data-testid^="select-item-"]');
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const t = item.textContent?.trim() || '';
      if (t.includes(searchText)) { item.click(); return true; }
    }
    const divs = modal.querySelectorAll('div');
    for (const d of divs) {
      const r = d.getBoundingClientRect();
      if (r.width < 200 || r.height < 20 || r.height > 80 || r.y < 180) continue;
      const t = d.textContent?.trim() || '';
      if (t.includes(searchText)) { d.click(); return true; }
    }
    return false;
  }, text);
  if (clicked) await sleep(2000);
  return clicked;
}

/**
 * Click the back button to return to search results.
 * With retry and resetToHome fallback.
 */
async function clickBack(page) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const backBtn = page.locator('[data-testid="nav-header-back"]').first();
      await backBtn.click({ force: true, timeout: 3000 });
      await sleep(1500);
      // Check if we returned (modal or home visible)
      const onHome = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (modal && modal.getBoundingClientRect().width > 0) return true;
        const selector = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
        return selector && selector.getBoundingClientRect().width > 0;
      });
      if (onHome) return true;
    } catch {
      const pos = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="nav-header-back"]');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return r.width > 0 ? { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) } : null;
      });
      if (pos) {
        await page.mouse.click(pos.x, pos.y);
        await sleep(1500);
        return true;
      }
    }
  }
  // Last fallback: resetToHome
  await resetToHome(page);
  return false;
}

/**
 * Close the search modal.
 */
async function closeSearchModal(page) {
  await closeSearch(page);
}

// ── Test Cases ───────────────────────────────────────────────

// WEB-SEARCH-UTIL-001: 代币 Tab 搜索（USDC/btc/详情/null价格Token）
async function testWebSearchUtil001(page) {
  await resetToHome(page);
  const t = createStepTracker('WEB-SEARCH-UTIL-001');

  // Step 1: Input USDC → switch to "代币" tab → assert results
  await openSearch(page);
  await inputSearch(page, CONFIG.tokenUSDC);
  await switchSearchTab(page, CONFIG.tabs.tokens);
  await assertHasResults(page, 'USDC token');
  t.add('搜索 USDC 在代币 Tab 有结果', 'passed');

  // Step 2: Clear → input btc → "代币" tab → assert results
  await clearSearch(page);
  await inputSearch(page, CONFIG.tokenBTC);
  await switchSearchTab(page, CONFIG.tabs.tokens);
  await assertHasResults(page, 'btc tokens');
  t.add('搜索 btc 在代币 Tab 有结果', 'passed');

  // Step 3: Click "Bitcoin" result → view detail → back
  const btcClicked = await clickSearchResultByText(page, 'Bitcoin');
  t.add('点击 Bitcoin 进入详情', btcClicked ? 'passed' : 'failed',
    btcClicked ? 'navigated' : 'result not found');
  if (btcClicked) {
    await clickBack(page);
  }

  // Step 4: Input POWER → "代币" tab → click POWR → back
  await openSearch(page);
  await inputSearch(page, CONFIG.tokenPOWR);
  await switchSearchTab(page, CONFIG.tabs.tokens);
  await assertHasResults(page, 'POWER token');
  const powrClicked = await clickSearchResultByText(page, CONFIG.tokenPOWRExpected);
  t.add(`搜索 POWER 点击 ${CONFIG.tokenPOWRExpected}`, powrClicked ? 'passed' : 'failed',
    powrClicked ? 'navigated' : 'result not found');
  if (powrClicked) {
    await clickBack(page);
  }

  // Step 5: Input aip → "代币" tab → click PettAI → back
  await openSearch(page);
  await inputSearch(page, CONFIG.tokenAIP);
  await switchSearchTab(page, CONFIG.tabs.tokens);
  await assertHasResults(page, 'aip token');
  const aipClicked = await clickSearchResultByText(page, CONFIG.tokenAIPExpected);
  t.add(`搜索 aip 点击 ${CONFIG.tokenAIPExpected}`, aipClicked ? 'passed' : 'failed',
    aipClicked ? 'navigated' : 'result not found');
  if (aipClicked) {
    await clickBack(page);
  }

  await closeSearchModal(page);
  return t.result();
}

// WEB-SEARCH-UTIL-002: 合约 Tab 搜索（中文/英文/详情/不支持Token）
async function testWebSearchUtil002(page) {
  await resetToHome(page);
  const t = createStepTracker('WEB-SEARCH-UTIL-002');

  // Step 1: Input 比特 (Chinese) → "合约" tab → assert results
  await openSearch(page);
  await inputSearch(page, CONFIG.perpsChinese);
  await switchSearchTab(page, CONFIG.tabs.perps);
  await assertHasResults(page, '比特 Chinese');
  t.add('搜索中文"比特"在合约 Tab 有结果', 'passed');

  // Step 2: Input eth → "合约" tab → click "ETH - USDC" → jumps to perps detail
  await clearSearch(page);
  await inputSearch(page, CONFIG.perpsETH);
  await switchSearchTab(page, CONFIG.tabs.perps);
  await assertHasResults(page, 'eth perps');
  const ethClicked = await clickSearchResultByText(page, CONFIG.perpsETHExpected);
  t.add(`点击 ${CONFIG.perpsETHExpected} 进入合约详情`, ethClicked ? 'passed' : 'failed',
    ethClicked ? 'navigated' : 'result not found');

  // Step 3: Reopen search → input usdc → "合约" tab → assert NO results
  await openSearch(page);
  await inputSearch(page, CONFIG.perpsUnsupported);
  await switchSearchTab(page, CONFIG.tabs.perps);
  await assertNoResults(page, 'usdc not supported in perps');
  t.add('搜索 usdc 在合约 Tab 无结果（不支持的Token）', 'passed');

  await closeSearchModal(page);
  return t.result();
}

// ── Exports ──────────────────────────────────────────────────

export const testCases = [
  { id: 'WEB-SEARCH-UTIL-001', name: 'Web-代币 Tab 搜索（USDC/btc/详情/null价格Token）', fn: testWebSearchUtil001 },
  { id: 'WEB-SEARCH-UTIL-002', name: 'Web-合约 Tab 搜索（中文/英文/详情/不支持Token）', fn: testWebSearchUtil002 },
];

export async function setup(page) {
  await resetToHome(page);
}

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
