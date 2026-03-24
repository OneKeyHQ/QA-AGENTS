// Perps Favorites Tests (Web) — WEB-PERPS-001 ~ WEB-PERPS-005
// Web version of desktop/perps/favorites.test.mjs
// Connects via CDP port 9223 (Chrome) instead of 9222 (OneKey Electron).
//
// Session 1: 默认推荐代币收藏（清空 → 推荐列表 → 部分取消 → 添加）
// Session 2: 搜索收藏/取消（收藏、取消、空状态、模糊搜索、tab 同步）
// Session 3: 自选列表管理（取消收藏、跳转交易页、空状态）
// Session 4: 行情页顶部（$/% 切换、点击代币跳转）
// Session 5: 跨入口数据一致性

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker } from '../../helpers/components.mjs';

const WEB_URL = process.env.WEB_URL || 'https://app.onekeytest.com';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9223';
const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-perps-favorites');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const DEFAULT_TOKENS = ['BTCUSDC', 'ETHUSDC', 'BNBUSDC', 'SOLUSDC', 'HYPEUSDC', 'XRPUSDC'];

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

// ── Screenshot (only on failure) ──────────────────────────

async function screenshotWeb(page, name) {
  try {
    const path = `${SCREENSHOT_DIR}/${name}.png`;
    await page.screenshot({ path });
  } catch {}
}

// ── Navigation: Web ───────────────────────────────────────

/** Navigate to perps page via web header "合约" button */
async function goToPerps(page) {
  // Try clicking "合约" button in header navigation
  const clicked = await page.evaluate(() => {
    // Strategy 1: data-testid Header-Navigation area
    const nav = document.querySelector('[data-testid="Header-Navigation"]');
    if (nav) {
      for (const el of nav.querySelectorAll('a, button, span, div')) {
        const text = el.textContent?.trim();
        if (['合约', 'Perps'].includes(text) && el.getBoundingClientRect().width > 0) {
          el.click(); return true;
        }
      }
    }
    // Strategy 2: header area buttons/links
    for (const el of document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]')) {
      const text = el.textContent?.trim();
      if (['合约', 'Perps'].includes(text)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y < 80) {
          el.click(); return true;
        }
      }
    }
    // Strategy 3: any visible span in top navigation area
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
    // Fallback: navigate directly via URL
    await page.goto(`${WEB_URL}/swap`);
    await sleep(3000);
    // Try clicking 合约 again after page load
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
  await sleep(3000);
}

// ── Helpers (all element-based, no coordinates) ───────────

/** Click text in popover or document */
async function clickText(page, text) {
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
    for (const sp of document.querySelectorAll('span')) {
      if (sp.textContent?.trim() === txt && sp.getBoundingClientRect().width > 0) {
        sp.click(); return true;
      }
    }
    return false;
  }, text);
  if (!clicked) throw new Error(`"${text}" not found`);
  await sleep(1500);
}

/** Dismiss overlay popover */
async function dismissPopover(page) {
  await page.evaluate(() => {
    const overlay = document.querySelector('[data-testid="ovelay-popover"]');
    if (overlay) overlay.click();
  });
  await sleep(1500);
}

/** Get current trading pair name (e.g. "BTCUSDC") */
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

/** Open pair selector popover by clicking current pair header */
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
  await sleep(2000);
}

/** Get favorites list tokens from the popover */
async function getFavoritesListTokens(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return [];
    const tokens = [];
    const ignore = new Set(['自选','永续合约','加密货币','股票','贵金属','指数','大宗商品','外汇','预上线',
      '资产','最新价格','24小时涨跌','资金费率','成交量','合约持仓量','搜索资产']);
    for (const sp of pop.querySelectorAll('span')) {
      const t = sp.textContent?.trim();
      if (!t || sp.children.length !== 0 || sp.getBoundingClientRect().width === 0) continue;
      if (ignore.has(t)) continue;
      if (/^[A-Z]{2,8}$/.test(t)) tokens.push(t);
    }
    return [...new Set(tokens)];
  });
}

/**
 * Clear all favorites by clicking star icons in the popover.
 * Uses page.mouse.click for reliable React event handling.
 */
async function clearAllFavorites(page) {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const btnPos = await page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
      if (!pop) return null;
      for (const btn of pop.querySelectorAll('button')) {
        const r = btn.getBoundingClientRect();
        if (r.width >= 18 && r.width <= 28 && r.height >= 18 && r.height <= 28
            && r.x < 130 && r.y > 290) {
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });
    if (!btnPos) break;
    await page.mouse.click(btnPos.x, btnPos.y);
    total++;
    await sleep(600);
  }
  return total;
}

/**
 * After clearing all favorites, dismiss and reopen popover to trigger recommendation list.
 */
async function clearAndTriggerRecommendation(page) {
  const cleared = await clearAllFavorites(page);
  await dismissPopover(page);
  await sleep(1000);
  await openPairSelector(page);
  await sleep(1500);
  await clickText(page, '自选');
  await sleep(1500);
  return cleared;
}

/** Check if recommendation list (添加到自选 button) is visible */
async function isRecommendationVisible(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const pop of pops) {
      if (pop.getBoundingClientRect().width === 0) continue;
      for (const sp of pop.querySelectorAll('span')) {
        if (sp.textContent?.trim() === '添加到自选' && sp.getBoundingClientRect().width > 0) return true;
      }
    }
    return false;
  });
}

/** Get recommendation list tokens */
async function getRecommendationTokens(page) {
  return page.evaluate(() => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return [];
    const tokens = [];
    for (const div of pop.querySelectorAll('div')) {
      const t = div.textContent?.trim();
      if (t && /^[A-Z]{2,10}USDCPERPS$/.test(t) && div.getBoundingClientRect().width > 0) {
        tokens.push(t.replace('PERPS', ''));
      }
    }
    return [...new Set(tokens)];
  });
}

/** Toggle a recommendation token checkbox */
async function toggleRecommendationToken(page, token) {
  const result = await page.evaluate((tok) => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return { clicked: false, available: [] };
    const available = [];
    for (const div of pop.querySelectorAll('div')) {
      const t = div.textContent?.trim();
      const r = div.getBoundingClientRect();
      if (!t || r.width < 50 || r.height < 30 || r.height > 70) continue;
      if (t.includes('PERPS')) {
        available.push(t);
        if (t.includes(tok)) {
          div.click(); return { clicked: true, available };
        }
      }
    }
    return { clicked: false, available };
  }, token);
  if (!result.clicked) throw new Error(`Recommendation token "${token}" not found. Available: ${result.available.join(', ')}`);
  await sleep(500);
}

/** Type in search box */
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
        if (inp.getBoundingClientRect().width > 0 && inp.getBoundingClientRect().height > 0) {
          input = inp; break;
        }
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
  await sleep(1500);
}

/** Clear search box */
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
    await sleep(500);
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
  await sleep(500);
}

/** Check if search shows empty state */
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

/** Click star button at Nth row in search/favorites list (0-based) */
async function clickStarAtIndex(page, index = 0) {
  const result = await page.evaluate((idx) => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return { pos: null, error: 'no popover' };
    const buttons = [];
    for (const btn of pop.querySelectorAll('button')) {
      const r = btn.getBoundingClientRect();
      if (r.width >= 18 && r.width <= 28 && r.height >= 18 && r.height <= 28
          && r.x < 130 && r.y > 290) {
        buttons.push({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
      }
    }
    if (idx >= buttons.length) return { pos: null, error: `only ${buttons.length} star buttons, want index ${idx}` };
    return { pos: buttons[idx] };
  }, index);
  if (!result.pos) throw new Error(`Cannot click star at index ${index}: ${result.error}`);
  await page.mouse.click(result.pos.x, result.pos.y);
  await sleep(1000);
}

/** Get top bar tokens — only matches the favorites bar at y < 100 */
async function getTopBarTokens(page) {
  return page.evaluate(() => {
    const tokens = [];
    for (const sp of document.querySelectorAll('span')) {
      const text = sp.textContent?.trim();
      if (!text || !/^[A-Z]{2,6}$/.test(text) || sp.children.length !== 0) continue;
      const r = sp.getBoundingClientRect();
      if (r.width === 0 || r.y > 100) continue;
      const parent = sp.parentElement;
      if (!parent) continue;
      const parentText = parent.textContent?.trim();
      if (parentText && /^[A-Z]{2,6}[+\-\d,.%]/.test(parentText)) {
        tokens.push(text);
      }
    }
    return [...new Set(tokens)];
  });
}

/** Get top bar display values — only matches the favorites bar at y < 100 */
async function getTopBarValues(page) {
  return page.evaluate(() => {
    const items = [];
    for (const sp of document.querySelectorAll('span')) {
      const text = sp.textContent?.trim();
      if (!text || sp.children.length !== 0) continue;
      const r = sp.getBoundingClientRect();
      if (r.width === 0 || r.y > 100) continue;
      const parent = sp.parentElement;
      if (!parent) continue;
      const parentText = parent.textContent?.trim();
      if (/^[A-Z]{2,6}/.test(parentText) && /[\d,.%+-]/.test(parentText)) {
        items.push({ text, x: Math.round(r.x) });
      }
    }
    return items.sort((a, b) => a.x - b.x);
  });
}

/** Click $ or % toggle */
async function clickToggle(page, mode) {
  const clicked = await page.evaluate((target) => {
    for (const el of document.querySelectorAll('span, div')) {
      const text = el.textContent?.trim();
      if (text !== target || el.children.length !== 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.width < 30 && r.height > 0 && r.height < 30) {
        el.click(); return true;
      }
    }
    return false;
  }, mode);
  if (!clicked) throw new Error(`Toggle "${mode}" not found`);
  await sleep(1000);
}

/** Click a token in the top bar — only matches y < 100 */
async function clickTopBarToken(page, symbol) {
  const clicked = await page.evaluate((sym) => {
    for (const sp of document.querySelectorAll('span')) {
      const text = sp.textContent?.trim();
      if (text !== sym || sp.children.length !== 0) continue;
      const r = sp.getBoundingClientRect();
      if (r.width === 0 || r.y > 100) continue;
      const parent = sp.parentElement;
      if (parent && /^[A-Z]{2,6}[+\-\d,.%]/.test(parent.textContent?.trim())) {
        parent.click(); return true;
      }
    }
    return false;
  }, symbol);
  if (!clicked) throw new Error(`Top bar token "${symbol}" not found`);
  await sleep(2000);
}

// ── Test Cases ────────────────────────────────────────────

async function testWebPerps001(page) {
  const t = createStepTracker('WEB-PERPS-001');

  console.log('\n  Step 1: Open pair selector -> 自选 tab');
  await openPairSelector(page);
  await clickText(page, '自选');

  console.log('  Step 2: Clear existing favorites (conditional)');
  const recAlready = await isRecommendationVisible(page);
  if (!recAlready) {
    const cleared = await clearAndTriggerRecommendation(page);
    t.add('清空已有自选', 'passed', `removed ${cleared} tokens`);
    await sleep(1000);
  } else {
    t.add('清空已有自选', 'passed', 'already empty');
  }

  console.log('  Step 3: Verify recommendation list');
  const recVisible = await isRecommendationVisible(page);
  t.add('推荐列表显示', recVisible ? 'passed' : 'failed');

  if (!recVisible) {
    await dismissPopover(page);
    return t.result();
  }

  const recTokens = await getRecommendationTokens(page);
  t.add('显示 6 个默认代币', recTokens.length === 6 ? 'passed' : 'failed',
    `found ${recTokens.length}: ${recTokens.join(', ')}`);

  console.log('  Step 5: Deselect BTCUSDC and ETHUSDC');
  await toggleRecommendationToken(page, 'ETHUSDC');
  await toggleRecommendationToken(page, 'BTCUSDC');

  console.log('  Step 6: Click 添加到自选');
  await clickText(page, '添加到自选');
  await sleep(2000);

  const favTokens = await getFavoritesListTokens(page);
  t.add('自选列表显示 4 个代币', favTokens.length === 4 ? 'passed' : 'failed',
    `found: ${favTokens.join(', ')}`);
  t.add('BTC/ETH 不在自选中',
    (!favTokens.includes('BTC') && !favTokens.includes('ETH')) ? 'passed' : 'failed');

  const topTokens = await getTopBarTokens(page);
  t.add('顶部行情栏同步',
    (!topTokens.includes('BTC') && !topTokens.includes('ETH')) ? 'passed' : 'failed',
    `top: ${topTokens.join(', ')}`);

  await dismissPopover(page);
  return t.result();
}

async function testWebPerps002(page) {
  const t = createStepTracker('WEB-PERPS-002');

  console.log('\n  Step 1: Search BTC -> favorite');
  await openPairSelector(page);
  await searchAsset(page, 'BTC');
  await clickText(page, '永续合约');
  await sleep(1000);

  await clickStarAtIndex(page, 0);

  await clearSearch(page);
  await clickText(page, '自选');
  await sleep(1000);
  const favsAfterAdd = await getFavoritesListTokens(page);
  t.add('搜索 BTC 并收藏', favsAfterAdd.includes('BTC') ? 'passed' : 'failed',
    `favorites: ${favsAfterAdd.join(', ')}`);

  console.log('  Step 2: Search XRP -> unfavorite');
  await clickText(page, '永续合约');
  await sleep(500);
  await searchAsset(page, 'XRP');
  await sleep(1000);
  await clickStarAtIndex(page, 0);

  await clearSearch(page);
  await clickText(page, '自选');
  await sleep(1000);
  const favsAfterRemove = await getFavoritesListTokens(page);
  t.add('搜索 XRP 并取消收藏', !favsAfterRemove.includes('XRP') ? 'passed' : 'failed',
    `favorites: ${favsAfterRemove.join(', ')}`);

  console.log('  Step 3: Search non-existent');
  await clearSearch(page);
  await searchAsset(page, 'ABCDEFG123');
  await sleep(1000);
  const isEmpty = await isSearchEmpty(page);
  t.add('搜索不存在代币显示空状态', isEmpty ? 'passed' : 'failed');

  console.log('  Step 4: Fuzzy search "SU"');
  await clickText(page, '永续合约');
  await sleep(500);
  await searchAsset(page, 'SU');
  await sleep(1000);
  const fuzzyTokens = await getFavoritesListTokens(page);
  t.add('模糊搜索返回多个结果', fuzzyTokens.length > 1 ? 'passed' : 'failed',
    `found: ${fuzzyTokens.join(', ')}`);

  await dismissPopover(page);
  return t.result();
}

async function testWebPerps003(page) {
  const t = createStepTracker('WEB-PERPS-003');

  console.log('\n  Step 1: View favorites list');
  await openPairSelector(page);
  await clickText(page, '自选');
  await sleep(1000);

  const initialTokens = await getFavoritesListTokens(page);
  t.add('自选列表显示代币', initialTokens.length > 0 ? 'passed' : 'failed',
    `${initialTokens.length}: ${initialTokens.join(', ')}`);

  console.log('  Step 2: Unfavorite one token');
  const countBefore = initialTokens.length;
  await clickStarAtIndex(page, 0);
  await sleep(1000);
  const tokensAfter = await getFavoritesListTokens(page);
  t.add('取消收藏后数量减少', tokensAfter.length < countBefore ? 'passed' : 'failed',
    `${countBefore} -> ${tokensAfter.length}`);

  console.log('  Step 3: Click token -> navigate');
  await dismissPopover(page);
  await sleep(500);
  const pairBefore = await getCurrentPair(page);
  const topTokens = await getTopBarTokens(page);
  const target = topTokens.find(tk => tk !== pairBefore?.replace('USDC', ''));
  if (target) {
    await clickTopBarToken(page, target);
    const pairAfter = await getCurrentPair(page);
    t.add('点击代币跳转交易页', pairAfter !== pairBefore ? 'passed' : 'failed',
      `${pairBefore} -> ${pairAfter}`);
  } else {
    t.add('点击代币跳转交易页', 'failed', 'no alternate token');
  }

  console.log('  Step 4: Clear all -> empty state');
  await openPairSelector(page);
  await clickText(page, '自选');
  await sleep(1000);
  await clearAndTriggerRecommendation(page);
  await sleep(1000);

  const recVisible = await isRecommendationVisible(page);
  t.add('清空后显示推荐列表', recVisible ? 'passed' : 'failed');

  if (recVisible) {
    await clickText(page, '添加到自选');
    await sleep(2000);
  }
  await dismissPopover(page);
  return t.result();
}

async function testWebPerps004(page) {
  const t = createStepTracker('WEB-PERPS-004');

  console.log('\n  Step 1: Verify top bar');
  const topTokens = await getTopBarTokens(page);
  t.add('顶部显示收藏代币', topTokens.length >= 3 ? 'passed' : 'failed',
    `${topTokens.length}: ${topTokens.join(', ')}`);

  const topValues = await getTopBarValues(page);
  const hasPercent = topValues.some(v => v.text.includes('%'));
  t.add('默认百分比模式', hasPercent ? 'passed' : 'failed');

  console.log('  Step 2: Click $ toggle');
  await clickToggle(page, '$');
  const dollarValues = await getTopBarValues(page);

  console.log('  Step 3: Click % toggle');
  await clickToggle(page, '%');
  const percentValues = await getTopBarValues(page);

  const dollarTexts = dollarValues.map(d => d.text).join(' ');
  const percentTexts = percentValues.map(d => d.text).join(' ');
  t.add('$/% 显示不同数据', dollarTexts !== percentTexts ? 'passed' : 'failed');
  t.add('切回 % 显示百分比', percentValues.some(v => v.text.includes('%')) ? 'passed' : 'failed');

  console.log('  Step 4: Click token -> navigate');
  const pairBefore = await getCurrentPair(page);
  const target2 = topTokens.find(tk => tk !== pairBefore?.replace('USDC', ''));
  if (target2) {
    await clickTopBarToken(page, target2);
    const pairAfter = await getCurrentPair(page);
    t.add('顶部点击代币跳转', pairAfter?.includes(target2) ? 'passed' : 'failed',
      `${pairBefore} -> ${pairAfter}`);
  } else {
    t.add('顶部点击代币跳转', 'failed', 'no alternate token');
  }

  return t.result();
}

async function testWebPerps005(page) {
  const t = createStepTracker('WEB-PERPS-005');

  console.log('\n  Step 1: Clear -> add without SOL');
  await openPairSelector(page);
  await clickText(page, '自选');
  await sleep(1000);

  if (!(await isRecommendationVisible(page))) {
    await clearAndTriggerRecommendation(page);
    await sleep(1000);
  }

  await toggleRecommendationToken(page, 'SOL');
  await clickText(page, '添加到自选');
  await sleep(2000);

  console.log('  Step 2: Verify 永续合约 tab');
  await clickText(page, '永续合约');
  await sleep(1500);

  const topTokens = await getTopBarTokens(page);
  t.add('推荐收藏 -> 顶部无 SOL', !topTokens.includes('SOL') ? 'passed' : 'failed',
    `top: ${topTokens.join(', ')}`);

  console.log('  Step 3: Unfavorite from 自选');
  await clickText(page, '自选');
  await sleep(1000);

  const favsBefore = await getFavoritesListTokens(page);
  await clickStarAtIndex(page, 0);
  await sleep(1000);

  const favsAfter = await getFavoritesListTokens(page);
  const removedTokens = favsBefore.filter(t => !favsAfter.includes(t));
  const tokenRemoved = removedTokens[0] || 'unknown';
  t.add(`自选取消 ${tokenRemoved}`, favsAfter.length < favsBefore.length ? 'passed' : 'failed',
    `${favsBefore.length} -> ${favsAfter.length}`);

  console.log('  Step 4: Verify sync');
  t.add(`自选同步（${tokenRemoved} 已移除）`,
    !favsAfter.includes(tokenRemoved) ? 'passed' : 'failed',
    `favorites: ${favsAfter.join(', ')}`);

  await dismissPopover(page);
  return t.result();
}

// ── Registry ──────────────────────────────────────────────

export const testCases = [
  { id: 'WEB-PERPS-001', name: 'Web-Perps-收藏-默认推荐代币收藏', fn: testWebPerps001 },
  { id: 'WEB-PERPS-002', name: 'Web-Perps-收藏-搜索收藏与取消收藏', fn: testWebPerps002 },
  { id: 'WEB-PERPS-003', name: 'Web-Perps-收藏-自选列表管理', fn: testWebPerps003 },
  { id: 'WEB-PERPS-004', name: 'Web-Perps-收藏-行情页顶部展示与切换', fn: testWebPerps004 },
  { id: 'WEB-PERPS-005', name: 'Web-Perps-收藏-跨入口数据一致性', fn: testWebPerps005 },
];

export async function setup(page) {
  await goToPerps(page);
  await sleep(2000);
}

// ── Main ──────────────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('WEB-PERPS-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { browser, page } = await connectWebCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Perps Favorites Tests (Web) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await goToPerps(page);
  await sleep(2000);

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
        await goToPerps(page);
        await sleep(2000);
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

    await sleep(1000);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));
  results.forEach(r => {
    const icon = r.status === 'passed' ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.testId} (${(r.duration / 1000).toFixed(1)}s)${r.error ? ' — ' + r.error : ''}`);
  });

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'web-perps-favorites-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
