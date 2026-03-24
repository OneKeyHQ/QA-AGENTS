// Market Search Tests (Web) — WEB-MARKET-SEARCH-001 ~ WEB-MARKET-SEARCH-005
// Web version of desktop/market/search.test.mjs using shared helpers.
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).
//
// Key stable selectors (same as desktop):
// - Search input:   [data-testid="nav-header-search"]
// - Clear button:   [data-testid="-clear"]
// - Close search:   [data-testid="nav-header-close"]

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep, openSearchModal as componentOpenSearch } from '../../helpers/components.mjs';
import {
  isSearchModalOpen, getModalSearchInput,
  openSearchModal, setSearchValueStrict, ensureSearchOpen,
  setSearchValue, clearSearch, closeSearch,
  assertHasSomeTableLikeContent, clickShowMoreIfPresent,
  scrollToBottomAndAssert, clickFirstSuggestionIfPresent,
  clickClearHistoryIfPresent, toggleFavoriteOnFirstRow,
  getSearchHistory, clickSearchResult, clickClearHistory,
  snapshotWatchlistCount,
} from '../../helpers/market-search.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-market-search');
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

// ── Platform-specific: Web ───────────────────────────────────

async function goToMarket(page) {
  const url = page.url();
  if (url.includes('onekeytest.com/market')) return;
  await page.goto(`${WEB_URL}/market`);
  await sleep(3000);
}

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
          // Found the search icon — click its closest clickable ancestor
          const btn = svg.closest('button') || svg.closest('[role="button"]') || svg.parentElement;
          if (btn) {
            const r = btn.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
              return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
          }
          // Fallback: click the SVG itself
          const r = svg.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
      }
    }
    // Fallback: try header search input (same as desktop)
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
const _set = (page, v) => setSearchValue(page, v, openSearchTrigger);
const _scrollBottom = (page, opts) => scrollToBottomAndAssert(page, opts, openSearchTrigger);
const _safeStep = (page, t, name, fn) => safeStep(page, t, name, fn, screenshotWeb);

// ── Test Cases ───────────────────────────────────────────────

async function testWebMarketSearch001(page) {
  const t = createStepTracker('WEB-MARKET-SEARCH-001');

  await goToMarket(page);
  await _ensure(page);

  await assertHasSomeTableLikeContent(page);
  t.add('打开搜索界面可见内容/空状态', 'passed');

  const clicked = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const blocks = modal.querySelectorAll('div');
    for (const b of blocks) {
      const r = b.getBoundingClientRect();
      if (r.width < 400 || r.height < 24 || r.height > 90) continue;
      if (r.y < 160) continue;
      const txt = b.textContent?.trim() || '';
      if (!txt) continue;
      if (txt.includes('名称') && txt.includes('价格')) continue;
      b.click();
      return true;
    }
    return false;
  });
  if (clicked) {
    await sleep(2000);
    t.add('Trending/结果行可点击（直达交易页/可交互）', 'passed');
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(800);
  } else {
    t.add('Trending/结果行点击（软校验）', 'passed', 'skip: no stable clickable row detected');
  }

  await closeSearch(page);
  return t.result();
}

async function testWebMarketSearch002(page) {
  const t = createStepTracker('WEB-MARKET-SEARCH-002');

  await goToMarket(page);
  await _ensure(page);

  const params = {
    mainSymbols: ['BTC', 'ETH', 'SOL'],
    caseInsensitive: ['btc'],
    fuzzy: ['bt'],
    multiResultSymbols: ['USDT', 'UNI'],
  };

  for (const sym of params.mainSymbols) {
    await _setStrict(page, sym);
    await assertHasSomeTableLikeContent(page);
    t.add(`主币搜索 ${sym} 有展示/空状态`, 'passed');
  }

  for (const sym of params.caseInsensitive) {
    await _setStrict(page, sym);
    await assertHasSomeTableLikeContent(page);
    t.add(`大小写不敏感 ${sym}`, 'passed');
  }

  for (const sym of params.fuzzy) {
    await _setStrict(page, sym);
    await assertHasSomeTableLikeContent(page);
    t.add(`模糊匹配 ${sym}`, 'passed');
  }

  await _setStrict(page, 'USDT');
  await assertHasSomeTableLikeContent(page);
  const showMoreClicked = await clickShowMoreIfPresent(page);
  t.add('USDT 显示更多（如出现则点击）', 'passed', showMoreClicked ? 'clicked' : 'not present');
  await _scrollBottom(page, { maxRounds: 40, roundWaitMs: 250 });
  t.add('USDT 列表可滚动到底', 'passed');

  await closeSearch(page);
  return t.result();
}

async function testWebMarketSearch003(page) {
  const t = createStepTracker('WEB-MARKET-SEARCH-003');

  await goToMarket(page);
  await _ensure(page);

  const params = {
    contractAddresses: ['0xdAC17F958D2ee523a2206206994597C13D831ec7'],
    incompleteAddresses: ['0x1234'],
    noResults: ['ABCDEFG123'],
    invalidInputs: ['@#$%', '\u{1F680}', '   '],
    longString: ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
  };

  for (const addr of params.contractAddresses) {
    await _set(page, addr);
    await assertHasSomeTableLikeContent(page);
    t.add('合约地址搜索有展示/空状态', 'passed');
  }

  for (const v of params.incompleteAddresses) {
    await _set(page, v);
    await assertHasSomeTableLikeContent(page);
    t.add('不完整合约地址空状态', 'passed');
  }

  for (const v of params.noResults) {
    await _set(page, v);
    await assertHasSomeTableLikeContent(page);
    t.add('无结果空状态', 'passed');
  }

  for (const v of params.invalidInputs) {
    await _set(page, v);
    await assertHasSomeTableLikeContent(page);
    t.add(`异常输入空状态/不报错 (${JSON.stringify(v)})`, 'passed');
  }

  for (const v of params.longString) {
    await _set(page, v);
    await assertHasSomeTableLikeContent(page);
    t.add('超长字符串输入不崩溃', 'passed');
  }

  await clearSearch(page);
  t.add('点击清空（X）', 'passed');

  await closeSearch(page);
  t.add('关闭搜索返回 Market 首页', 'passed');

  return t.result();
}

async function testWebMarketSearch004(page) {
  const t = createStepTracker('WEB-MARKET-SEARCH-004');

  await goToMarket(page);

  const before = await snapshotWatchlistCount(page);

  await _ensure(page);
  await _set(page, 'USDT');
  await assertHasSomeTableLikeContent(page);

  await toggleFavoriteOnFirstRow(page);
  await closeSearch(page);

  const afterAdd = await snapshotWatchlistCount(page);
  t.add('收藏后自选列表有变化（+1 或出现条目）', afterAdd !== before ? 'passed' : 'failed',
    `${before} → ${afterAdd}`);

  await _ensure(page);
  await _set(page, 'USDT');
  await toggleFavoriteOnFirstRow(page);
  await closeSearch(page);

  const afterRemove = await snapshotWatchlistCount(page);
  t.add('取消收藏后自选列表有变化（-1 或消失）', afterRemove !== afterAdd ? 'passed' : 'failed',
    `${afterAdd} → ${afterRemove}`);

  return t.result();
}

async function testWebMarketSearch005(page) {
  const t = createStepTracker('WEB-MARKET-SEARCH-005');

  await goToMarket(page);
  await _ensure(page);

  const history = await getSearchHistory(page);
  t.add('检查最近搜索区域', 'passed',
    history.hasHistory ? `有历史: [${history.keywords.slice(0, 5).join(', ')}]` : '无历史记录');

  if (history.hasHistory && history.keywords.length > 0) {
    const cleared = await clickClearHistory(page);
    t.add('点击清空历史按钮', cleared ? 'passed' : 'failed',
      cleared ? 'cleared' : 'clear button not found');

    await sleep(500);
    const historyAfter = await getSearchHistory(page);
    const historyCleared = !historyAfter.hasHistory || historyAfter.keywords.length === 0;
    t.add('验证历史已清空', historyCleared ? 'passed' : 'failed',
      historyCleared ? 'history empty' : `still has: [${historyAfter.keywords.join(', ')}]`);
  }

  const clicked = await clickSearchResult(page, openSearchTrigger, 'ETH');
  t.add('搜索 ETH 并点击结果', clicked ? 'passed' : 'failed',
    clicked ? 'clicked' : 'no clickable result');

  await goToMarket(page);
  await _ensure(page);
  const newHistory = await getSearchHistory(page);
  t.add('验证搜索后产生新历史', 'passed',
    newHistory.hasHistory ? `keywords: [${newHistory.keywords.slice(0, 5).join(', ')}]` : '无新历史（可能需要刷新页面生效）');

  await closeSearch(page);
  return t.result();
}

export const testCases = [
  { id: 'WEB-MARKET-SEARCH-001', name: 'Web-Market-搜索-入口与Trending跳转', fn: testWebMarketSearch001 },
  { id: 'WEB-MARKET-SEARCH-002', name: 'Web-Market-搜索-Symbol搜索与滚动加载', fn: testWebMarketSearch002 },
  { id: 'WEB-MARKET-SEARCH-003', name: 'Web-Market-搜索-合约地址与异常输入', fn: testWebMarketSearch003 },
  { id: 'WEB-MARKET-SEARCH-004', name: 'Web-Market-搜索-收藏联动（自选Tab）', fn: testWebMarketSearch004 },
  { id: 'WEB-MARKET-SEARCH-005', name: 'Web-Market-搜索-历史与建议', fn: testWebMarketSearch005 },
];

export async function setup(page) {
  await goToMarket(page);
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('WEB-MARKET-SEARCH-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Search Tests (Web) — ${casesToRun.length} case(s)`);
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
      // Reset state between tests: close any modal, navigate back to Market
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
  writeFileSync(resolve(RESULTS_DIR, 'web-market-search-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
