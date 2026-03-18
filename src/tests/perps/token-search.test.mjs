// Token Search Tests — SEARCH-001 ~ SEARCH-003
// Based on recording session 2026-03-17
//
// SEARCH-001: 英文搜索 + 跨 tab 联动验证（搜 BT → 逐个切 tab → 有结果显示联想，无结果显示空状态）
// SEARCH-002: 中文关键词搜索（比特 → BTC/BCH, 以太 → ETH/ETC）
// SEARCH-003: 版块 Tab 遍历（清空搜索 → 逐个 tab 验证代币列表）

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../helpers/index.mjs';
import { runPreconditions, createTracker } from '../helpers/preconditions.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'search');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = ['SEARCH-001', 'SEARCH-002', 'SEARCH-003'];

let _preReport = null;

// ── Helpers ─────────────────────────────────────────────────

async function goToPerps(page) {
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="perp"]');
    if (el) { el.click(); return true; }
    const container = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!container) return false;
    for (const sp of container.querySelectorAll('span')) {
      if (['合约', 'Perps'].includes(sp.textContent.trim()) && sp.getBoundingClientRect().width > 0) {
        sp.click(); return true;
      }
    }
    return false;
  });
  if (!clicked) throw new Error('Cannot navigate to perps page');
  await sleep(1500);
}

async function getCurrentPair(page) {
  return page.evaluate(() => {
    for (const sp of document.querySelectorAll('span')) {
      const text = sp.textContent?.trim();
      if (text && /^[A-Z]{2,10}USDC$/.test(text) && sp.children.length === 0) {
        const r = sp.getBoundingClientRect();
        if (r.width > 50 && r.height > 20) return text;
      }
    }
    return null;
  });
}

async function openPairSelector(page) {
  const pair = await getCurrentPair(page);
  if (!pair) throw new Error('Cannot detect current pair');
  await page.evaluate((p) => {
    for (const sp of document.querySelectorAll('span')) {
      if (sp.textContent?.trim() === p && sp.getBoundingClientRect().width > 50) {
        sp.click(); return;
      }
    }
  }, pair);
  await sleep(1500);
}

async function ensurePopoverOpen(page) {
  const open = await page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) return true; }
    return false;
  });
  if (!open) {
    await openPairSelector(page);
  }
}

async function dismissPopover(page) {
  await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="ovelay-popover"]');
    if (overlay) overlay.click();
  });
  await sleep(1500);
}

async function searchAsset(page, query) {
  await page.evaluate((q) => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let input = null;
    for (const pop of pops) {
      if (pop.getBoundingClientRect().width === 0) continue;
      const inp = pop.querySelector('input[data-testid="nav-header-search"]')
        || pop.querySelector('input[placeholder*="搜索"]');
      if (inp && inp.getBoundingClientRect().width > 0) { input = inp; break; }
    }
    if (!input) {
      for (const inp of document.querySelectorAll('input[data-testid="nav-header-search"], input[placeholder*="搜索"]')) {
        if (inp.getBoundingClientRect().width > 0) { input = inp; break; }
      }
    }
    if (!input) throw new Error('Search input not found');
    input.focus();
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (nativeSet) {
      nativeSet.call(input, q);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, query);
  await sleep(800);
}

async function clearSearch(page) {
  const clearPos = await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-testid="-clear"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    return null;
  });
  if (clearPos) {
    await page.mouse.click(clearPos.x, clearPos.y);
    await sleep(300);
    return;
  }
  await page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const pop of pops) {
      if (pop.getBoundingClientRect().width === 0) continue;
      const input = pop.querySelector('input');
      if (input) {
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSet) { nativeSet.call(input, ''); input.dispatchEvent(new Event('input', { bubbles: true })); }
        return;
      }
    }
  });
  await sleep(300);
}

async function clickTab(page, tabName) {
  const clicked = await page.evaluate((txt) => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const p of pops) {
      if (p.getBoundingClientRect().width === 0) continue;
      for (const sp of p.querySelectorAll('span')) {
        if (sp.textContent?.trim() === txt && sp.getBoundingClientRect().width > 0) {
          sp.click(); return true;
        }
      }
    }
    return false;
  }, tabName);
  if (!clicked) throw new Error(`Tab "${tabName}" not found`);
  await sleep(500);
}

async function isSearchEmpty(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const pop of pops) {
      if (pop.getBoundingClientRect().width === 0) continue;
      const text = pop.textContent || '';
      if (text.includes('未找到') || text.includes('No results')) return true;
    }
    return false;
  });
}

async function getTokenList(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return [];
    const tokens = [];
    const ignore = new Set([
      '自选','永续合约','加密货币','股票','贵金属','指数','大宗商品','外汇','预上线',
      '资产','最新价格','24小时涨跌','资金费率','成交量','成交额','合约持仓量',
      '搜索资产','未找到匹配的代币','添加到自选',
    ]);
    for (const sp of pop.querySelectorAll('span')) {
      const t = sp.textContent?.trim();
      if (!t || sp.children.length !== 0 || sp.getBoundingClientRect().width === 0) continue;
      if (ignore.has(t)) continue;
      if (/^[A-Z][A-Z0-9]{1,9}$/.test(t) && !tokens.includes(t)) tokens.push(t);
    }
    return tokens;
  });
}

async function getSectionTabs(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return [];
    const tabs = [];
    const known = ['自选','永续合约','加密货币','股票','贵金属','指数','大宗商品','外汇','预上线'];
    for (const sp of pop.querySelectorAll('span')) {
      const t = sp.textContent?.trim();
      if (t && known.includes(t) && sp.getBoundingClientRect().width > 0 && !tabs.includes(t)) tabs.push(t);
    }
    return tabs;
  });
}

// ── Test Cases ───────────────────────────────────────────────

/**
 * SEARCH-001: 英文搜索 + 跨 tab 联动
 *
 * 连贯流程（对应录制 steps 3-7）：
 *   1. 在永续合约 tab 搜索 BT → 验证有 BTC
 *   2. 保持搜索词，逐个切换 tab
 *   3. 每个 tab：有匹配 → 显示联想列表；无匹配 → 显示空状态
 */
async function testSearch001(page) {
  const t = createTracker('SEARCH-001', _preReport);

  // Step 1: 在永续合约 tab 搜索 BT
  await clickTab(page, '永续合约');
  await searchAsset(page, 'BT');

  const perpsTokens = await getTokenList(page);
  t.add('永续合约搜索 BT 有结果', perpsTokens.length > 0 ? 'passed' : 'failed',
    `results: ${perpsTokens.join(', ') || 'none'}`, { dataKey: 'BT' });
  t.add('永续合约搜索 BT 含 BTC', perpsTokens.includes('BTC') ? 'passed' : 'failed',
    `results: ${perpsTokens.join(', ')}`, { dataKey: 'BT' });

  // Step 2: 保持 BT 搜索词，逐个切换其他 tab
  const tabs = await getSectionTabs(page);
  const otherTabs = tabs.filter(t => t !== '自选' && t !== '永续合约');

  for (const tab of otherTabs) {
    await clickTab(page, tab);
    const tokens = await getTokenList(page);
    const empty = await isSearchEmpty(page);

    if (tokens.length > 0) {
      t.add(`${tab} 搜索 BT 有联想`, 'passed',
        `${tokens.length} results: ${tokens.join(', ')}`);
    } else if (empty) {
      t.add(`${tab} 搜索 BT 显示空状态`, 'passed', '未找到匹配的代币');
    } else {
      await screenshot(page, SCREENSHOT_DIR, `SEARCH-001-bt-${tab}-error`);
      t.add(`${tab} 搜索 BT 状态异常`, 'failed', '既无结果也无空状态提示');
    }
  }

  // 清空搜索，切回永续合约（为下一个用例准备）
  await clearSearch(page);
  await clickTab(page, '永续合约');
  return t.result();
}

/**
 * SEARCH-002: 中文关键词搜索
 *
 * 连贯流程（对应录制 steps 8-10）：
 *   1. 在永续合约 tab 搜索「比特」→ 验证 BTC/BCH
 *   2. 清空，搜索「以太」→ 验证 ETH/ETC
 */
async function testSearch002(page) {
  const t = createTracker('SEARCH-002', _preReport);

  // Step 1: 搜索「比特」
  await searchAsset(page, '比特');

  const btTokens = await getTokenList(page);
  t.add('搜索「比特」有结果', btTokens.length > 0 ? 'passed' : 'failed',
    `results: ${btTokens.join(', ') || 'none'}`, { dataKey: '比特' });
  t.add('「比特」匹配 BTC', btTokens.includes('BTC') ? 'passed' : 'failed',
    `results: ${btTokens.join(', ')}`, { dataKey: '比特' });

  // Step 2: 清空，搜索「以太」
  await clearSearch(page);
  await searchAsset(page, '以太');

  const ethTokens = await getTokenList(page);
  t.add('搜索「以太」有结果', ethTokens.length > 0 ? 'passed' : 'failed',
    `results: ${ethTokens.join(', ') || 'none'}`, { dataKey: '以太' });
  t.add('「以太」匹配 ETH', ethTokens.includes('ETH') ? 'passed' : 'failed',
    `results: ${ethTokens.join(', ')}`, { dataKey: '以太' });

  await clearSearch(page);
  return t.result();
}

/**
 * SEARCH-003: 版块 Tab 遍历
 *
 * 连贯流程（对应录制 steps 11-21）：
 *   1. 清空搜索
 *   2. 逐个点击每个 tab，验证列表有代币或正常显示空状态
 */
async function testSearch003(page) {
  const t = createTracker('SEARCH-003', _preReport);

  await clearSearch(page);
  const tabs = await getSectionTabs(page);
  t.add('检测到版块 tabs', tabs.length > 0 ? 'passed' : 'failed',
    `tabs: ${tabs.join(', ')}`);

  for (const tab of tabs) {
    if (tab === '自选') continue;

    await clickTab(page, tab);
    const tokens = await getTokenList(page);
    const empty = await isSearchEmpty(page);

    if (tokens.length > 0) {
      const preview = tokens.length > 5
        ? tokens.slice(0, 5).join(', ') + `... (${tokens.length})`
        : tokens.join(', ');
      t.add(`${tab} 有代币`, 'passed', preview);
    } else if (empty) {
      t.add(`${tab} 空状态`, 'passed', '暂无代币');
    } else {
      await screenshot(page, SCREENSHOT_DIR, `SEARCH-003-${tab}-error`);
      t.add(`${tab} 状态异常`, 'failed', '既无代币也无空状态提示');
    }
  }

  return t.result();
}

// ── Registry ────────────────────────────────────────────────

export const testCases = [
  { id: 'SEARCH-001', name: '英文搜索 + 跨 tab 联动', fn: testSearch001 },
  { id: 'SEARCH-002', name: '中文关键词搜索', fn: testSearch002 },
  { id: 'SEARCH-003', name: '版块 Tab 遍历', fn: testSearch003 },
];

export async function setup(page) {
  await goToPerps(page);
  await openPairSelector(page);

  // Run precondition checks and cache
  _preReport = await runPreconditions(page, ALL_TEST_IDS);

  // Re-open selector if preconditions closed it
  await ensurePopoverOpen(page);
}

// ── Main (CLI) ──────────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('SEARCH-'));
  const casesToRun = filter
    ? testCases.filter(c => c.id === filter)
    : testCases;

  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Token Search Tests — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);
  await setup(page);

  if (!_preReport?.canRun) {
    console.log('\n  Preconditions not met, aborting.');
    return { status: 'failed', error: 'preconditions_failed' };
  }

  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    if (_preReport.shouldSkip(test.id)) {
      const r = { testId: test.id, status: 'skipped', duration: 0,
        reason: 'precondition warned', timestamp: new Date().toISOString() };
      console.log(`>> ${test.id}: SKIPPED (precondition)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
      continue;
    }

    // Ensure popover is still open before each case
    await ensurePopoverOpen(page);

    try {
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
      await screenshot(page, SCREENSHOT_DIR, `${test.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
  }

  await dismissPopover(page);

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, skipped, results };
  writeFileSync(resolve(RESULTS_DIR, 'search-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, skipped, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
