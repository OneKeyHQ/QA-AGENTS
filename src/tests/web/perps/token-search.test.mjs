// Token Search Tests (Web) — WEB-PERPS-SEARCH-001 ~ WEB-PERPS-SEARCH-004
// Web version of desktop/perps/token-search.test.mjs
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).
//
// 弹窗结构（两级 tab，2026-05 之后）：
//   顶级 tab (y≈180): 自选 / 永续合约 / 现货
//   子级 tab (y≈227, 仅 永续合约 下): 全部 / 加密货币 / 股票 / 贵金属 / 指数 / 大宗商品 / 外汇 / 预上线
//   现货下无子级 tab，列：资产/最新价格/24h涨跌/成交量/市值（无资金费率）
//   现货行: "BTC/USDC"（带斜杠的 pair）；永续行: "BTC" + "40x" + "比特币"
//
// WEB-PERPS-SEARCH-001: 永续合约/全部 下英文搜索 + 跨子 tab 联动
// WEB-PERPS-SEARCH-002: 永续合约/全部 下中文关键词搜索（比特 / 以太）
// WEB-PERPS-SEARCH-003: 永续合约 下子 tab 遍历
// WEB-PERPS-SEARCH-004: 现货 tab 下搜索（BTC / HYPE）

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { runPreconditions, createTracker } from '../../helpers/preconditions.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-perps-search');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = [
  'WEB-PERPS-SEARCH-001',
  'WEB-PERPS-SEARCH-002',
  'WEB-PERPS-SEARCH-003',
  'WEB-PERPS-SEARCH-004',
];

const TOP_TABS = new Set(['自选', '永续合约', '现货']);
const SUB_TABS = new Set(['全部', '加密货币', '股票', '贵金属', '指数', '大宗商品', '外汇', '预上线']);

let _preReport = null;

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
  if (!chromeBin) throw new Error(`Chrome not found. Please start Chrome manually:\n  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --remote-debugging-port=9223 ${WEB_URL}/swap`);
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
  const child = spawn(chromeBin, [`--remote-debugging-port=${port}`, `--user-data-dir=${tmpProfile}`, '--no-first-run', `${WEB_URL}/swap`], { detached: true, stdio: 'ignore' });
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
    await page.goto(`${WEB_URL}/swap`);
    await sleep(5000);
  }

  return { browser, page };
}

// ── Navigation: Web ───────────────────────────────────────

/** Navigate to perps page via web header "合约" button */
async function goToPerps(page) {
  const clicked = await page.evaluate(() => {
    const nav = document.querySelector('[data-testid="Header-Navigation"]');
    if (nav) {
      for (const el of nav.querySelectorAll('a, button, span, div')) {
        const text = el.textContent?.trim();
        if (['合约', 'Perps'].includes(text) && el.getBoundingClientRect().width > 0) {
          el.click(); return true;
        }
      }
    }
    for (const el of document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]')) {
      const text = el.textContent?.trim();
      if (['合约', 'Perps'].includes(text)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y < 80) {
          el.click(); return true;
        }
      }
    }
    for (const sp of document.querySelectorAll('span')) {
      const text = sp.textContent?.trim();
      if (['合约', 'Perps'].includes(text)) {
        const r = sp.getBoundingClientRect();
        if (r.width > 0 && r.y < 80) {
          sp.click(); return true;
        }
      }
    }
    return false;
  });
  if (!clicked) {
    await page.goto(`${WEB_URL}/swap`);
    await sleep(3000);
    const retry = await page.evaluate(() => {
      for (const el of document.querySelectorAll('a, button, span, div')) {
        const text = el.textContent?.trim();
        if (['合约', 'Perps'].includes(text)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.y < 80) { el.click(); return true; }
        }
      }
      return false;
    });
    if (!retry) throw new Error('Cannot navigate to perps page (web)');
  }
  await sleep(1500);
}

// ── Helpers ─────────────────────────────────────────────────

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

/**
 * 点击顶级 tab（自选 / 永续合约 / 现货）。
 * 顶级 tab 通常在弹窗顶部第一行（相对 y < 60px）。
 */
async function clickTopTab(page, tabName) {
  const clicked = await page.evaluate((txt) => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const pop of pops) {
      const pr = pop.getBoundingClientRect();
      if (pr.width === 0) continue;
      for (const sp of pop.querySelectorAll('span')) {
        if (sp.textContent?.trim() !== txt) continue;
        const sr = sp.getBoundingClientRect();
        if (sr.width === 0) continue;
        if (sr.y - pr.y < 100) {
          sp.click(); return true;
        }
      }
    }
    return false;
  }, tabName);
  if (!clicked) throw new Error(`Top tab "${tabName}" not found`);
  await sleep(1200);
}

/**
 * 点击子级 tab（全部 / 加密货币 / 股票 ...，仅 永续合约 下出现）。
 * 子级 tab 在顶级 tab 下方第二行（相对 y >= 100px 且 < 200px）。
 */
async function clickSubTab(page, tabName) {
  const clicked = await page.evaluate((txt) => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const pop of pops) {
      const pr = pop.getBoundingClientRect();
      if (pr.width === 0) continue;
      for (const sp of pop.querySelectorAll('span')) {
        if (sp.textContent?.trim() !== txt) continue;
        const sr = sp.getBoundingClientRect();
        if (sr.width === 0) continue;
        const dy = sr.y - pr.y;
        if (dy >= 100 && dy < 200) {
          sp.click(); return true;
        }
      }
    }
    return false;
  }, tabName);
  if (!clicked) throw new Error(`Sub tab "${tabName}" not found`);
  await sleep(800);
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

/**
 * 提取弹窗内的代币列表。
 * - 永续 tab 下：单 ticker 如 "BTC", "ETH"
 * - 现货 tab 下：pair 格式如 "BTC/USDC", "HYPE/USDC"
 * 同时收集两种格式，调用方自行根据 mode 过滤。
 */
async function getTokenList(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return [];
    const tokens = [];
    const ignore = new Set([
      '自选','永续合约','现货','全部',
      '加密货币','股票','贵金属','指数','大宗商品','外汇','预上线',
      '资产','最新价格','24小时涨跌','资金费率','成交量','成交额','合约持仓量','市值',
      '搜索资产','未找到匹配的代币','添加到自选',
    ]);
    const tickerRe = /^[A-Z][A-Z0-9]{1,9}$/;
    const pairRe = /^[A-Z][A-Z0-9]{1,9}\/[A-Z]{2,6}$/;
    for (const sp of pop.querySelectorAll('span')) {
      const t = sp.textContent?.trim();
      if (!t || sp.children.length !== 0 || sp.getBoundingClientRect().width === 0) continue;
      if (ignore.has(t)) continue;
      if ((tickerRe.test(t) || pairRe.test(t)) && !tokens.includes(t)) tokens.push(t);
    }
    return tokens;
  });
}

/** 提取 base ticker（去掉 /USDC 等后缀），用于断言「现货搜 BTC 命中 BTC/USDC」之类。 */
function baseTicker(token) {
  return token.includes('/') ? token.split('/')[0] : token;
}

/** 返回当前弹窗的子级 tab 列表（仅在 永续合约 顶级 tab 下出现）。 */
async function getSubTabs(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return [];
    const pr = pop.getBoundingClientRect();
    const tabs = [];
    const known = ['全部','加密货币','股票','贵金属','指数','大宗商品','外汇','预上线'];
    for (const sp of pop.querySelectorAll('span')) {
      const t = sp.textContent?.trim();
      if (!t || !known.includes(t)) continue;
      const sr = sp.getBoundingClientRect();
      if (sr.width === 0) continue;
      const dy = sr.y - pr.y;
      if (dy >= 100 && dy < 200 && !tabs.includes(t)) tabs.push(t);
    }
    return tabs;
  });
}

async function screenshotWeb(page, dir, name) {
  try {
    const path = `${dir}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Test Cases ───────────────────────────────────────────────

async function testWebPerpsSearch001(page) {
  const t = createTracker('WEB-PERPS-SEARCH-001', _preReport);

  // 前置：进入 永续合约 / 全部
  await clickTopTab(page, '永续合约');
  await clickSubTab(page, '全部');

  await searchAsset(page, 'BT');

  const perpsTokens = await getTokenList(page);
  t.add('永续合约/全部 搜索 BT 有结果', perpsTokens.length > 0 ? 'passed' : 'failed',
    `results: ${perpsTokens.join(', ') || 'none'}`, { dataKey: 'BT' });
  t.add('永续合约/全部 搜索 BT 含 BTC', perpsTokens.includes('BTC') ? 'passed' : 'failed',
    `results: ${perpsTokens.join(', ')}`, { dataKey: 'BT' });

  // 跨子 tab 联动：搜索词保留，切换子 tab 应显示当前子 tab 下的过滤结果或空状态
  const subTabs = await getSubTabs(page);
  const otherSubTabs = subTabs.filter(s => s !== '全部');

  for (const sub of otherSubTabs) {
    await clickSubTab(page, sub);
    const tokens = await getTokenList(page);
    const empty = await isSearchEmpty(page);

    if (tokens.length > 0) {
      t.add(`${sub} 搜索 BT 有联想`, 'passed',
        `${tokens.length} results: ${tokens.join(', ')}`);
    } else if (empty) {
      t.add(`${sub} 搜索 BT 显示空状态`, 'passed', '未找到匹配的代币');
    } else {
      await screenshotWeb(page, SCREENSHOT_DIR, `WEB-PERPS-SEARCH-001-bt-${sub}-error`);
      t.add(`${sub} 搜索 BT 状态异常`, 'failed', '既无结果也无空状态提示');
    }
  }

  await clearSearch(page);
  await clickSubTab(page, '全部');
  return t.result();
}

async function testWebPerpsSearch002(page) {
  const t = createTracker('WEB-PERPS-SEARCH-002', _preReport);

  // 前置：进入 永续合约 / 全部
  await clickTopTab(page, '永续合约');
  await clickSubTab(page, '全部');

  await clearSearch(page);
  await searchAsset(page, '比特');

  const btTokens = await getTokenList(page);
  t.add('永续合约/全部 搜索「比特」有结果', btTokens.length > 0 ? 'passed' : 'failed',
    `results: ${btTokens.join(', ') || 'none'}`, { dataKey: '比特' });
  t.add('「比特」匹配 BTC', btTokens.includes('BTC') ? 'passed' : 'failed',
    `results: ${btTokens.join(', ')}`, { dataKey: '比特' });

  await clearSearch(page);
  await searchAsset(page, '以太');

  const ethTokens = await getTokenList(page);
  t.add('永续合约/全部 搜索「以太」有结果', ethTokens.length > 0 ? 'passed' : 'failed',
    `results: ${ethTokens.join(', ') || 'none'}`, { dataKey: '以太' });
  t.add('「以太」匹配 ETH', ethTokens.includes('ETH') ? 'passed' : 'failed',
    `results: ${ethTokens.join(', ')}`, { dataKey: '以太' });

  await clearSearch(page);
  return t.result();
}

async function testWebPerpsSearch003(page) {
  const t = createTracker('WEB-PERPS-SEARCH-003', _preReport);

  // 前置：进入 永续合约（默认子 tab 通常是「全部」）
  await clickTopTab(page, '永续合约');
  await clearSearch(page);

  const subTabs = await getSubTabs(page);
  t.add('检测到永续合约子 tabs', subTabs.length > 0 ? 'passed' : 'failed',
    `tabs: ${subTabs.join(', ')}`);

  for (const sub of subTabs) {
    await clickSubTab(page, sub);
    const tokens = await getTokenList(page);
    const empty = await isSearchEmpty(page);

    if (tokens.length > 0) {
      const preview = tokens.length > 5
        ? tokens.slice(0, 5).join(', ') + `... (${tokens.length})`
        : tokens.join(', ');
      t.add(`${sub} 有代币`, 'passed', preview);
    } else if (empty) {
      t.add(`${sub} 空状态`, 'passed', '暂无代币');
    } else {
      await screenshotWeb(page, SCREENSHOT_DIR, `WEB-PERPS-SEARCH-003-${sub}-error`);
      t.add(`${sub} 状态异常`, 'failed', '既无代币也无空状态提示');
    }
  }

  await clickSubTab(page, '全部');
  return t.result();
}

async function testWebPerpsSearch004(page) {
  const t = createTracker('WEB-PERPS-SEARCH-004', _preReport);

  // 前置：进入 现货 顶级 tab
  await clickTopTab(page, '现货');
  await clearSearch(page);

  // 默认列表非空检查
  const defaultList = await getTokenList(page);
  const hasPair = defaultList.some(x => /\/USDC$/.test(x));
  t.add('现货默认列表展示 pair', hasPair ? 'passed' : 'failed',
    `default: ${defaultList.slice(0, 5).join(', ')}${defaultList.length > 5 ? '...' : ''}`);

  // 搜索 BTC
  await searchAsset(page, 'BTC');
  const btcList = await getTokenList(page);
  const btcBases = btcList.map(baseTicker);
  t.add('现货搜索 BTC 有结果', btcList.length > 0 ? 'passed' : 'failed',
    `results: ${btcList.join(', ') || 'none'}`, { dataKey: 'BTC' });
  t.add('现货搜索 BTC 命中 BTC pair', btcBases.includes('BTC') ? 'passed' : 'failed',
    `bases: ${btcBases.join(', ')}`, { dataKey: 'BTC' });
  t.add('现货 BTC 结果仅含 pair 格式',
    btcList.length > 0 && btcList.every(x => /\/[A-Z]{2,6}$/.test(x)) ? 'passed' : 'failed',
    `results: ${btcList.join(', ')}`);

  await clearSearch(page);

  // 搜索 HYPE
  await searchAsset(page, 'HYPE');
  const hypeList = await getTokenList(page);
  const hypeBases = hypeList.map(baseTicker);
  t.add('现货搜索 HYPE 有结果', hypeList.length > 0 ? 'passed' : 'failed',
    `results: ${hypeList.join(', ') || 'none'}`, { dataKey: 'HYPE' });
  t.add('现货搜索 HYPE 命中 HYPE pair', hypeBases.includes('HYPE') ? 'passed' : 'failed',
    `bases: ${hypeBases.join(', ')}`, { dataKey: 'HYPE' });

  await clearSearch(page);
  return t.result();
}

// ── Registry ────────────────────────────────────────────────

export const displayName = '代币搜索';
export const testCases = [
  { id: 'WEB-PERPS-SEARCH-001', name: 'Web-Perps-搜索-永续合约/全部 英文BT 跨子Tab联动', fn: testWebPerpsSearch001 },
  { id: 'WEB-PERPS-SEARCH-002', name: 'Web-Perps-搜索-永续合约/全部 中文比特/以太', fn: testWebPerpsSearch002 },
  { id: 'WEB-PERPS-SEARCH-003', name: 'Web-Perps-搜索-永续合约 子Tab遍历', fn: testWebPerpsSearch003 },
  { id: 'WEB-PERPS-SEARCH-004', name: 'Web-Perps-搜索-现货 BTC/HYPE', fn: testWebPerpsSearch004 },
];

export async function setup(page) {
  await goToPerps(page);
  await openPairSelector(page);

  _preReport = await runPreconditions(page, ALL_TEST_IDS);

  await ensurePopoverOpen(page);
}

// ── Main (CLI) ──────────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('WEB-PERPS-SEARCH-'));
  const casesToRun = filter
    ? testCases.filter(c => c.id === filter)
    : testCases;

  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Token Search Tests (Web) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

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

    await ensurePopoverOpen(page);

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
        await screenshotWeb(page, SCREENSHOT_DIR, `${test.id}-error`);
      }
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
  writeFileSync(resolve(RESULTS_DIR, 'web-perps-search-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, skipped, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
