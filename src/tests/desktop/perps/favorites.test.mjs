// Perps Favorites Tests — based on 5 recording sessions
// Usage: node src/tests/perps/favorites.test.mjs
// Covers: PERPS-001 ~ PERPS-005
//
// Session 1: 默认推荐代币收藏（清空 → 推荐列表 → 部分取消 → 添加）
// Session 2: 搜索收藏/取消（收藏、取消、空状态、模糊搜索、tab 同步）
// Session 3: 自选列表管理（取消收藏、跳转交易页、空状态）
// Session 4: 行情页顶部（$/% 切换、点击代币跳转）
// Session 5: 跨入口数据一致性
//
// ALL selectors use DOM elements (data-testid, text, structure).
// NEVER use hardcoded coordinates.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { PerpsPage } from '../../helpers/pages/index.mjs';
import { createStepTracker, assertListRendered } from '../../helpers/components.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'perps-favorites');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const DEFAULT_TOKENS = ['BTCUSDC', 'ETHUSDC', 'BNBUSDC', 'SOLUSDC', 'HYPEUSDC', 'XRPUSDC'];

// ── Popover helper (inline, no eval) ──────────────────────

/** Find the visible TMPopover-ScrollView inside page.evaluate */
function findPopover() {
  const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
  for (const p of pops) {
    const r = p.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return p;
  }
  return null;
}

// ── Platform-specific: Desktop (via Page Objects) ────────────

const _perpsCache = { page: null, pp: null };
function getPerpsPage(page) {
  if (_perpsCache.page !== page) {
    _perpsCache.pp = new PerpsPage(page);
    _perpsCache.page = page;
  }
  return _perpsCache.pp;
}

async function goToPerps(page) {
  await getPerpsPage(page).navigate();
}

/** Click text in popover or document */
async function clickText(page, text) {
  const clicked = await page.evaluate((txt) => {
    // Search in visible popover first
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    for (const p of pops) {
      if (p.getBoundingClientRect().width === 0) continue;
      for (const sp of p.querySelectorAll('span')) {
        if (sp.textContent?.trim() === txt && sp.getBoundingClientRect().width > 0) {
          sp.click(); return true;
        }
      }
    }
    // Fallback: entire document
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

/** Get current trading pair name (e.g. "BTCUSDC") — file-specific USDC pair format */
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
 * Returns number of tokens unstarred.
 */
async function clearAllFavorites(page) {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const btnPos = await page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
      if (!pop) return null;
      // Find star BUTTON elements (22x22px, in left column x < 130, below tabs y > 290)
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
 * Must click 自选 tab explicitly after reopening.
 */
async function clearAndTriggerRecommendation(page) {
  const cleared = await clearAllFavorites(page);
  // Always dismiss and reopen to refresh the view
  await dismissPopover(page);
  await sleep(1000);
  await openPairSelector(page);
  await sleep(1500);
  // Assert popover list rendered after opening pair selector
  const lr = await assertListRendered(page, {
    selector: '[data-testid="TMPopover-ScrollView"] span',
    minCount: 3,
  });
  if (lr.errors.length > 0) throw new Error(`List render: ${lr.errors.join('; ')}`);
  // Click 自选 tab — recommendation list only appears here when favorites are empty
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

/** Toggle a recommendation token checkbox by clicking its card.
 *  Accepts partial match (e.g. "SOL", "SOLUSDC", or "SOLUSDCPERPS"). */
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

/** Type in search box (inside popover, uses page.evaluate for React compat) */
async function searchAsset(page, query) {
  // Find the VISIBLE search input inside the popover (not the global header one)
  await page.evaluate((q) => {
    // Find inputs inside visible popovers first
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let input = null;
    for (const pop of pops) {
      if (pop.getBoundingClientRect().width === 0) continue;
      const inp = pop.querySelector('input[data-testid="nav-header-search"]')
        || pop.querySelector('input[placeholder*="搜索"]');
      if (inp && inp.getBoundingClientRect().width > 0) { input = inp; break; }
    }
    // Fallback: find any visible search input
    if (!input) {
      for (const inp of document.querySelectorAll('input[data-testid="nav-header-search"], input[placeholder*="搜索"]')) {
        if (inp.getBoundingClientRect().width > 0 && inp.getBoundingClientRect().height > 0) {
          input = inp; break;
        }
      }
    }
    if (!input) throw new Error('Search input not found');
    input.focus();
    // Use native setter to trigger React's onChange
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
  // Try clicking the clear button (X icon)
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
  // Fallback: clear via native setter
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

/** Click star button at Nth row in search/favorites list (0-based).
 *  Targets the BUTTON element wrapping the star SVG. */
async function clickStarAtIndex(page, index = 0) {
  const result = await page.evaluate((idx) => {
    const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
    let pop = null;
    for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
    if (!pop) return { pos: null, error: 'no popover' };
    const buttons = [];
    for (const btn of pop.querySelectorAll('button')) {
      const r = btn.getBoundingClientRect();
      // Star buttons: 18-28px, in left column (x < 130), below tabs (y > 290)
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

/**
 * PERPS-001: 默认推荐代币收藏（Session 1）
 */
async function testPerps001(page) {
  const t = createStepTracker('PERPS-001');

  // Step 1: Open selector, switch to 自选 tab
  console.log('\n  Step 1: Open pair selector → 自选 tab');
  await openPairSelector(page);
  await clickText(page, '自选');

  // Step 2: Clear existing favorites if any
  console.log('  Step 2: Clear existing favorites (conditional)');
  const recAlready = await isRecommendationVisible(page);
  if (!recAlready) {
    const cleared = await clearAndTriggerRecommendation(page);
    t.add('清空已有自选', 'passed', `removed ${cleared} tokens`);
    await sleep(1000);
  } else {
    t.add('清空已有自选', 'passed', 'already empty');
  }

  // Step 3: Verify recommendation list
  console.log('  Step 3: Verify recommendation list');
  const recVisible = await isRecommendationVisible(page);
  t.add('推荐列表显示', recVisible ? 'passed' : 'failed');

  if (!recVisible) {
    await dismissPopover(page);
    return t.result();
  }

  // Step 4: Verify 6 default tokens
  const recTokens = await getRecommendationTokens(page);
  t.add('显示 6 个默认代币', recTokens.length === 6 ? 'passed' : 'failed',
    `found ${recTokens.length}: ${recTokens.join(', ')}`);

  // Step 5: Deselect BTCUSDC and ETHUSDC
  console.log('  Step 5: Deselect BTCUSDC and ETHUSDC');
  await toggleRecommendationToken(page, 'ETHUSDC');
  await toggleRecommendationToken(page, 'BTCUSDC');

  // Step 6: Click 添加到自选
  console.log('  Step 6: Click 添加到自选');
  await clickText(page, '添加到自选');
  await sleep(2000);

  // Step 7: Verify favorites
  const favTokens = await getFavoritesListTokens(page);
  t.add('自选列表显示 4 个代币', favTokens.length === 4 ? 'passed' : 'failed',
    `found: ${favTokens.join(', ')}`);
  t.add('BTC/ETH 不在自选中',
    (!favTokens.includes('BTC') && !favTokens.includes('ETH')) ? 'passed' : 'failed');

  // Step 8: Verify top bar synced
  const topTokens = await getTopBarTokens(page);
  t.add('顶部行情栏同步',
    (!topTokens.includes('BTC') && !topTokens.includes('ETH')) ? 'passed' : 'failed',
    `top: ${topTokens.join(', ')}`);

  await dismissPopover(page);
  return t.result();
}

/**
 * PERPS-002: 搜索收藏/取消收藏（Session 2）
 */
async function testPerps002(page) {
  const t = createStepTracker('PERPS-002');

  // Step 1: Open selector → search BTC in 永续合约 → favorite
  console.log('\n  Step 1: Search BTC → favorite');
  await openPairSelector(page);
  await searchAsset(page, 'BTC');
  await clickText(page, '永续合约');
  await sleep(1000);

  // Assert search results list rendered
  const lr = await assertListRendered(page, {
    selector: '[data-testid="TMPopover-ScrollView"] span',
    minCount: 1,
  });
  if (lr.errors.length > 0) throw new Error(`List render: ${lr.errors.join('; ')}`);

  await clickStarAtIndex(page, 0);

  // Verify BTC in favorites by switching to 自选 tab
  await clearSearch(page);
  await clickText(page, '自选');
  await sleep(1000);
  const favsAfterAdd = await getFavoritesListTokens(page);
  t.add('搜索 BTC 并收藏', favsAfterAdd.includes('BTC') ? 'passed' : 'failed',
    `favorites: ${favsAfterAdd.join(', ')}`);

  // Step 2: Search XRP → unfavorite
  console.log('  Step 2: Search XRP → unfavorite');
  await clickText(page, '永续合约');
  await sleep(500);
  await searchAsset(page, 'XRP');
  await sleep(1000);
  await clickStarAtIndex(page, 0);

  // Verify XRP removed from favorites
  await clearSearch(page);
  await clickText(page, '自选');
  await sleep(1000);
  const favsAfterRemove = await getFavoritesListTokens(page);
  t.add('搜索 XRP 并取消收藏', !favsAfterRemove.includes('XRP') ? 'passed' : 'failed',
    `favorites: ${favsAfterRemove.join(', ')}`);

  // Step 3: Search non-existent → empty state
  console.log('  Step 3: Search non-existent');
  await clearSearch(page);
  await searchAsset(page, 'ABCDEFG123');
  await sleep(1000);
  const isEmpty = await isSearchEmpty(page);
  t.add('搜索不存在代币显示空状态', isEmpty ? 'passed' : 'failed');

  // Step 4: Fuzzy search (must be in 永续合约 tab)
  console.log('  Step 4: Fuzzy search "SU"');
  await clickText(page, '永续合约');
  await sleep(500);
  await searchAsset(page, 'SU');
  await sleep(1000);
  const fuzzyTokens = await getFavoritesListTokens(page);
  t.add('模糊搜索返回多个结果', fuzzyTokens.length > 1 ? 'passed' : 'failed',
    `found: ${fuzzyTokens.join(', ')}`);

  // Step 5: Already verified sync in steps 1-2 via 自选 tab.
  // Final screenshot of current favorites state.

  await dismissPopover(page);
  return t.result();
}

/**
 * PERPS-003: 自选列表管理（Session 3）
 */
async function testPerps003(page) {
  const t = createStepTracker('PERPS-003');

  // Step 1: View favorites list
  console.log('\n  Step 1: View favorites list');
  await openPairSelector(page);
  await clickText(page, '自选');
  await sleep(1000);

  const initialTokens = await getFavoritesListTokens(page);
  t.add('自选列表显示代币', initialTokens.length > 0 ? 'passed' : 'failed',
    `${initialTokens.length}: ${initialTokens.join(', ')}`);

  // Step 2: Unfavorite one → count decreases
  console.log('  Step 2: Unfavorite one token');
  const countBefore = initialTokens.length;
  await clickStarAtIndex(page, 0);
  await sleep(1000);
  const tokensAfter = await getFavoritesListTokens(page);
  t.add('取消收藏后数量减少', tokensAfter.length < countBefore ? 'passed' : 'failed',
    `${countBefore} → ${tokensAfter.length}`);

  // Step 3: Click token in top bar → navigate
  console.log('  Step 3: Click token → navigate');
  await dismissPopover(page);
  await sleep(500);
  const pairBefore = await getCurrentPair(page);
  const topTokens = await getTopBarTokens(page);
  const target = topTokens.find(tk => tk !== pairBefore?.replace('USDC', ''));
  if (target) {
    await clickTopBarToken(page, target);
    const pairAfter = await getCurrentPair(page);
    t.add('点击代币跳转交易页', pairAfter !== pairBefore ? 'passed' : 'failed',
      `${pairBefore} → ${pairAfter}`);
  } else {
    t.add('点击代币跳转交易页', 'failed', 'no alternate token');
  }

  // Step 4: Clear all → empty state → recommendation
  console.log('  Step 4: Clear all → empty state');
  await openPairSelector(page);
  await clickText(page, '自选');
  await sleep(1000);
  await clearAndTriggerRecommendation(page);
  await sleep(1000);

  const recVisible = await isRecommendationVisible(page);
  t.add('清空后显示推荐列表', recVisible ? 'passed' : 'failed');

  // Restore defaults
  if (recVisible) {
    await clickText(page, '添加到自选');
    await sleep(2000);
  }
  await dismissPopover(page);
  return t.result();
}

/**
 * PERPS-004: 行情页顶部展示与切换（Session 4）
 */
async function testPerps004(page) {
  const t = createStepTracker('PERPS-004');

  // Step 1: Verify top bar
  console.log('\n  Step 1: Verify top bar');
  const topTokens = await getTopBarTokens(page);
  t.add('顶部显示收藏代币', topTokens.length >= 3 ? 'passed' : 'failed',
    `${topTokens.length}: ${topTokens.join(', ')}`);

  const topValues = await getTopBarValues(page);
  const hasPercent = topValues.some(v => v.text.includes('%'));
  t.add('默认百分比模式', hasPercent ? 'passed' : 'failed');

  // Step 2: Click $
  console.log('  Step 2: Click $ toggle');
  await clickToggle(page, '$');
  const dollarValues = await getTopBarValues(page);

  // Step 3: Click %
  console.log('  Step 3: Click % toggle');
  await clickToggle(page, '%');
  const percentValues = await getTopBarValues(page);

  const dollarTexts = dollarValues.map(d => d.text).join(' ');
  const percentTexts = percentValues.map(d => d.text).join(' ');
  t.add('$/% 显示不同数据', dollarTexts !== percentTexts ? 'passed' : 'failed');
  t.add('切回 % 显示百分比', percentValues.some(v => v.text.includes('%')) ? 'passed' : 'failed');

  // Step 4: Click token → navigate
  console.log('  Step 4: Click token → navigate');
  const pairBefore = await getCurrentPair(page);
  const target = topTokens.find(tk => tk !== pairBefore?.replace('USDC', ''));
  if (target) {
    await clickTopBarToken(page, target);
    const pairAfter = await getCurrentPair(page);
    t.add('顶部点击代币跳转', pairAfter?.includes(target) ? 'passed' : 'failed',
      `${pairBefore} → ${pairAfter}`);
  } else {
    t.add('顶部点击代币跳转', 'failed', 'no alternate token');
  }

  return t.result();
}

/**
 * PERPS-005: 跨入口数据一致性（Session 5）
 */
async function testPerps005(page) {
  const t = createStepTracker('PERPS-005');

  // Step 1: Clear all → add via recommendation (skip SOL)
  console.log('\n  Step 1: Clear → add without SOL');
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

  // Step 2: Switch to 永续合约 → verify SOL NOT in top bar
  console.log('  Step 2: Verify 永续合约 tab');
  await clickText(page, '永续合约');
  await sleep(1500);

  const topTokens = await getTopBarTokens(page);
  t.add('推荐收藏 → 顶部无 SOL', !topTokens.includes('SOL') ? 'passed' : 'failed',
    `top: ${topTokens.join(', ')}`);

  // Step 3: Go back to 自选 → unfavorite first token
  console.log('  Step 3: Unfavorite from 自选');
  await clickText(page, '自选');
  await sleep(1000);

  const favsBefore = await getFavoritesListTokens(page);
  await clickStarAtIndex(page, 0);
  await sleep(1000);

  const favsAfter = await getFavoritesListTokens(page);
  // Determine which token was actually removed by comparing before/after
  const removedTokens = favsBefore.filter(t => !favsAfter.includes(t));
  const tokenRemoved = removedTokens[0] || 'unknown';
  t.add(`自选取消 ${tokenRemoved}`, favsAfter.length < favsBefore.length ? 'passed' : 'failed',
    `${favsBefore.length} → ${favsAfter.length}`);

  // Step 4: Verify removed token not in 自选 list
  console.log('  Step 4: Verify sync');
  t.add(`自选同步（${tokenRemoved} 已移除）`,
    !favsAfter.includes(tokenRemoved) ? 'passed' : 'failed',
    `favorites: ${favsAfter.join(', ')}`);

  await dismissPopover(page);
  return t.result();
}

// ── Registry ──────────────────────────────────────────────

export const testCases = [
  { id: 'PERPS-001', name: 'Perps-收藏-默认推荐代币收藏', fn: testPerps001 },
  { id: 'PERPS-002', name: 'Perps-收藏-搜索收藏与取消收藏', fn: testPerps002 },
  { id: 'PERPS-003', name: 'Perps-收藏-自选列表管理', fn: testPerps003 },
  { id: 'PERPS-004', name: 'Perps-收藏-行情页顶部展示与切换', fn: testPerps004 },
  { id: 'PERPS-005', name: 'Perps-收藏-跨入口数据一致性', fn: testPerps005 },
];

export async function setup(page) {
  await goToPerps(page);
  await sleep(2000);
}

// ── Main ──────────────────────────────────────────────────

export async function run() {
  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log('  Perps Favorites Tests — 5 cases');
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);
  await goToPerps(page);
  await sleep(2000);

  const results = [];
  for (const test of testCases) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

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

    // Clean up state between tests
    try { await dismissOverlays(page); } catch {}
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
  writeFileSync(resolve(RESULTS_DIR, 'perps-favorites-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
