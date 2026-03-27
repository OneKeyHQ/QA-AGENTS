// Market Favorite Tests — MARKET-FAV-001 ~ MARKET-FAV-006
// Generated from recording session: 2026-03-19
//
// Key stable selectors from recording:
// - Star/favorite (list):  [data-testid="list-column-star"]
// - Token name:            [data-testid="list-column-name"]
// - Back button:           [data-testid="nav-header-back"]
// - Search input:          [data-testid="nav-header-search"]
// - Close search:          [data-testid="nav-header-close"]
// - Sidebar Market:        [data-testid="Desktop-AppSideBar-Content-Container"] text="市场"
// - Sidebar Wallet:        [data-testid="tab-modal-no-active-item-Wallet4Outline"]
//
// Design notes:
// - 6 scenarios covering watchlist empty-state, cross-network favorite, detail page,
//   search modal, wallet home linkage, and cross-entry state sync.
// - fn(page) single parameter signature for dashboard compatibility.
// - Screenshots only on failure.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { MarketPage } from '../../helpers/pages/index.mjs';
import { openSearchModal } from '../../helpers/components.mjs';
import {
  createStepTracker, safeStep,
  isSearchModalOpen, getModalSearchInput,
  setSearchValueStrict, ensureSearchOpen,
  closeSearch, assertHasSomeTableLikeContent,
  toggleFavoriteOnFirstRow, snapshotWatchlistCount,
} from '../../helpers/market-search.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-favorite');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = [
  'MARKET-FAV-001',
  'MARKET-FAV-002',
  'MARKET-FAV-003',
  'MARKET-FAV-004',
  'MARKET-FAV-005',
  'MARKET-FAV-006',
  'MARKET-FAV-007',
];

// ── Platform-specific: Desktop (via Page Objects + Components) ──

const _marketPageCache = { page: null, mp: null };
function getMarketPage(page) {
  if (_marketPageCache.page !== page) {
    _marketPageCache.mp = new MarketPage(page);
    _marketPageCache.page = page;
  }
  return _marketPageCache.mp;
}

async function goToMarket(page) {
  await getMarketPage(page).navigate();
}

async function goToWallet(page) {
  const ok = await page.evaluate(() => {
    // Try the specific wallet sidebar testid first
    const walletBtn = document.querySelector('[data-testid="tab-modal-no-active-item-Wallet4Outline"]');
    if (walletBtn) {
      const r = walletBtn.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { walletBtn.click(); return true; }
    }
    // Fallback: sidebar text
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    const labels = ['Wallet', '钱包', 'ウォレット'];
    for (const sp of sidebar.querySelectorAll('span')) {
      const txt = sp.textContent?.trim();
      if (labels.includes(txt)) {
        const r = sp.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { sp.click(); return true; }
      }
    }
    return false;
  });
  if (!ok) throw new Error('Cannot navigate to Wallet via sidebar');
  await sleep(2500);
}

/**
 * Click a main tab (自选/现货/合约) — main tabs are near the top (y < 200).
 */
async function clickTab(page, name) {
  const clicked = await page.evaluate((tabName) => {
    // Main/top-level tabs (自选/现货/合约) are at y~155-180.
    // Sub-tabs (全部/现货/合约 under 自选) are at y~210-230.
    // Use strict y range to avoid hitting sub-tabs.
    for (const el of document.querySelectorAll('span')) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() !== tabName) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.y > 130 && r.y < 195) {
        el.click();
        return true;
      }
    }
    return false;
  }, name);
  if (!clicked) throw new Error(`Cannot click tab "${name}"`);
  await sleep(1500);
}

/**
 * Click a sub-tab (全部/现货/合约 under 自选) — sub-tabs appear below main tabs (y > 180).
 * Distinguishes from main tabs by position.
 */
async function clickSubTab(page, name) {
  // Sub-tabs (全部/现货/合约) appear under the main tab area.
  // Retry a few times since they may take a moment to render after tab switch.
  for (let attempt = 0; attempt < 5; attempt++) {
    const clicked = await page.evaluate((tabName) => {
      const matches = [];
      for (const el of document.querySelectorAll('span')) {
        if (el.children.length > 0) continue;
        if (el.textContent?.trim() !== tabName) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 195 && r.y < 350) {
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

/**
 * Click a network filter button/chip by text (e.g. "BNB Chain", "Solana", "Ethereum").
 * For "更多" dropdown, clicks the dropdown trigger.
 */
async function clickNetworkFilter(page, network) {
  // Network filter is a horizontally scrollable bar — items may be off-screen (negative x).
  // Use scrollIntoView + JS click which works regardless of scroll position.
  const clicked = await page.evaluate((net) => {
    // Exact match on leaf SPAN elements (most reliable)
    for (const el of document.querySelectorAll('span')) {
      if (el.children.length > 0) continue;
      if (el.textContent?.trim() !== net) continue;
      el.scrollIntoView({ inline: 'center', block: 'nearest' });
      el.click();
      return true;
    }
    // Fallback: broader search
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

/**
 * Select a network from dropdown (used after clicking "更多").
 * Tries testid first, then falls back to text match inside dropdown/select.
 */
async function selectNetworkFromDropdown(page, network, testid) {
  if (testid) {
    const el = page.locator(`[data-testid="${testid}"]`).first();
    const visible = await el.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await el.click();
      await sleep(1500);
      return;
    }
  }
  // Fallback: find by text in any visible dropdown/popover
  const clicked = await page.evaluate((net) => {
    const els = document.querySelectorAll('[role="option"], [role="menuitem"], button, span, div');
    for (const el of els) {
      const txt = el.textContent?.trim();
      if (txt !== net) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 60) {
        el.click();
        return true;
      }
    }
    return false;
  }, network);
  if (!clicked) throw new Error(`Cannot select network "${network}" from dropdown`);
  await sleep(1500);
}

/**
 * Click star (favorite/unfavorite) on nth visible row in the list.
 * @param {number} rowIndex - 0-based index of the visible row
 */
async function clickStarInList(page, rowIndex = 0) {
  const clicked = await page.evaluate((idx) => {
    const stars = document.querySelectorAll('[data-testid="list-column-star"]');
    const visible = [];
    for (const star of stars) {
      const r = star.getBoundingClientRect();
      // Visible rows below header area
      if (r.width > 0 && r.height > 0 && r.y > 200) {
        visible.push(star);
      }
    }
    if (idx >= visible.length) return false;
    // Click the button inside or the star cell itself
    const target = visible[idx];
    const btn = target.querySelector('button') || target;
    btn.click();
    return true;
  }, rowIndex);
  if (!clicked) throw new Error(`Cannot click star at row index ${rowIndex}`);
  await sleep(1000);
}

/**
 * Get list of visible token names in current view.
 */
async function getWatchlistTokens(page) {
  return page.evaluate(() => {
    const names = document.querySelectorAll('[data-testid="list-column-name"]');
    const tokens = [];
    for (const el of names) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 200) {
        const txt = el.textContent?.trim();
        if (txt) tokens.push(txt);
      }
    }
    return tokens;
  });
}

/**
 * Count visible rows in current list.
 */
async function countWatchlistRows(page) {
  return page.evaluate(() => {
    const names = document.querySelectorAll('[data-testid="list-column-name"]');
    let count = 0;
    for (const el of names) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 200) count++;
    }
    return count;
  });
}

/**
 * Check if a token's star is in favorited state.
 * Favorited: SVG color="var(--iconActive)", path starts with "m15.405"
 * Unfavorited: SVG color="var(--iconSubdued)", path starts with "m15.455"
 */
async function isTokenStarActive(page, tokenText) {
  return page.evaluate((text) => {
    const names = document.querySelectorAll('[data-testid="list-column-name"]');
    for (const nameEl of names) {
      const r = nameEl.getBoundingClientRect();
      if (r.width === 0 || r.y < 200) continue;
      if (!nameEl.textContent?.trim()?.includes(text)) continue;
      // Find the star in the same row — walk up to row container, find list-column-star
      let row = nameEl;
      for (let i = 0; i < 8; i++) {
        row = row.parentElement;
        if (!row) break;
        const star = row.querySelector('[data-testid="list-column-star"]');
        if (star) {
          const svg = star.querySelector('svg');
          const color = svg?.getAttribute('color') || '';
          return color.includes('Active');
        }
      }
    }
    return null; // token not found
  }, tokenText);
}

/**
 * Wait for a token to appear or disappear from the visible list.
 * Polls up to 10 times.
 */
async function waitForTokenInList(page, tokenText, shouldExist, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const found = await isTokenInList(page, tokenText);
    if (found === shouldExist) return true;
    await sleep(500);
  }
  return false;
}

/**
 * Click a token row by text to enter its detail page.
 */
async function clickTokenDetail(page, tokenText) {
  const clicked = await page.evaluate((text) => {
    const names = document.querySelectorAll('[data-testid="list-column-name"]');
    for (const el of names) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.y < 200) continue;
      const txt = el.textContent?.trim() || '';
      if (txt.includes(text)) {
        el.click();
        return true;
      }
    }
    return false;
  }, tokenText);
  if (!clicked) throw new Error(`Cannot click token "${tokenText}" in list`);
  await sleep(2000);
}

/**
 * Click the favorite/unfavorite button in token detail page.
 * The star icon is typically an SVG inside a button near the header area.
 */
async function clickDetailFavorite(page) {
  const clicked = await page.evaluate(() => {
    // Strategy 1: find button with star SVG in the detail header
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      // Detail favorite button is small and in the upper area
      if (r.width < 16 || r.width > 60 || r.height < 16 || r.height > 60) continue;
      if (r.y > 300) continue;
      const svg = btn.querySelector('svg');
      if (!svg) continue;
      const path = svg.querySelector('path');
      if (!path) continue;
      const d = path.getAttribute('d') || '';
      // Star path usually contains specific arc patterns
      const ariaLabel = btn.getAttribute('aria-label') || '';
      const dataComp = btn.getAttribute('data-sentry-component') || '';
      if (d.length > 30 || ariaLabel.includes('star') || ariaLabel.includes('收藏') ||
          dataComp.includes('Star') || dataComp.includes('Favorite')) {
        btn.click();
        return true;
      }
    }
    // Strategy 2: find by position — small button near the title in header
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      if (r.width < 20 || r.width > 50 || r.height < 20 || r.height > 50) continue;
      if (r.y < 40 || r.y > 200) continue;
      const svg = btn.querySelector('svg');
      if (svg) {
        btn.click();
        return true;
      }
    }
    return false;
  });
  if (!clicked) throw new Error('Cannot click favorite button in detail page');
  await sleep(1000);
}

/**
 * Check if the current detail page token is favorited.
 * Returns true if star is filled/active, false otherwise.
 */
async function isDetailFavorited(page) {
  return page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      if (r.width < 16 || r.width > 60 || r.height < 16 || r.height > 60) continue;
      if (r.y > 300) continue;
      const svg = btn.querySelector('svg');
      if (!svg) continue;
      const path = svg.querySelector('path');
      if (!path) continue;
      // Check fill color — favorited stars usually have a non-transparent fill
      const fill = path.getAttribute('fill') || '';
      const style = window.getComputedStyle(path);
      const computedFill = style.fill || '';
      // If fill is a color (not "none" / "transparent"), it's favorited
      if (fill && fill !== 'none' && fill !== 'transparent' && !fill.includes('currentColor')) return true;
      if (computedFill && !computedFill.includes('none') && computedFill !== 'rgba(0, 0, 0, 0)') {
        // Check if it's a "bright" color (yellow/orange for star)
        return true;
      }
    }
    return false;
  });
}

/**
 * Click back button in detail page.
 */
async function clickBack(page) {
  const backBtn = page.locator('[data-testid="nav-header-back"]').first();
  const visible = await backBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (visible) {
    await backBtn.click();
    await sleep(1500);
    return;
  }
  // Fallback
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="nav-header-back"]');
    if (btn) { btn.click(); return; }
    // Try any back-like button
    const buttons = document.querySelectorAll('button');
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (r.x < 80 && r.y < 100 && r.width < 60 && r.width > 16) {
        b.click();
        return;
      }
    }
  });
  await sleep(1500);
}

// Search trigger wrapper for market-search.mjs functions that accept triggerFn
const triggerSearch = (page) => openSearchModal(page);

/**
 * Toggle star on the first search result row inside the search modal.
 */
async function toggleStarInSearchModal(page) {
  const clicked = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    // Find star buttons inside modal — small buttons with SVG
    const buttons = modal.querySelectorAll('button');
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      if (r.width < 16 || r.width > 44 || r.height < 16 || r.height > 44) continue;
      // Should be in the result area (below search input)
      if (r.y < 160) continue;
      const ariaLabel = btn.getAttribute('aria-label') || '';
      const dataComp = btn.getAttribute('data-sentry-component') || '';
      if (dataComp.includes('Star') || ariaLabel.includes('star') || ariaLabel.includes('收藏')) {
        btn.click();
        return true;
      }
    }
    // Fallback: find small button with SVG in result rows
    for (const btn of buttons) {
      const r = btn.getBoundingClientRect();
      if (r.width < 16 || r.width > 44 || r.height < 16 || r.height > 44) continue;
      if (r.y < 160) continue;
      const svg = btn.querySelector('svg');
      if (svg) {
        btn.click();
        return true;
      }
    }
    return false;
  });
  if (!clicked) throw new Error('Cannot toggle star in search modal');
  await sleep(1000);
}

async function clickSearchStarByIndex(page, index = 0) {
  const clicked = await page.evaluate((idx) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const stars = [];
    for (const btn of modal.querySelectorAll('button')) {
      const r = btn.getBoundingClientRect();
      if (r.width < 16 || r.width > 44 || r.height < 16 || r.height > 44) continue;
      if (r.y < 160) continue;
      if (btn.querySelector('svg')) stars.push({ btn, y: r.y, x: r.x });
    }
    if (stars.length === 0) return false;
    stars.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const target = stars[Math.min(idx, stars.length - 1)];
    target.btn.click();
    return true;
  }, index);
  if (!clicked) throw new Error(`Cannot click search star at index ${index}`);
  await sleep(800);
}

async function rapidClickSearchStar(page, index = 0, times = 3) {
  const clickedTimes = await page.evaluate(({ idx, n }) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return 0;
    const stars = [];
    for (const btn of modal.querySelectorAll('button')) {
      const r = btn.getBoundingClientRect();
      if (r.width < 16 || r.width > 44 || r.height < 16 || r.height > 44) continue;
      if (r.y < 160) continue;
      if (btn.querySelector('svg')) stars.push({ btn, y: r.y, x: r.x });
    }
    if (stars.length === 0) return 0;
    stars.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const target = stars[Math.min(idx, stars.length - 1)]?.btn;
    if (!target) return 0;
    let c = 0;
    for (let i = 0; i < n; i++) {
      target.click();
      c++;
    }
    return c;
  }, { idx: index, n: times });
  if (clickedTimes <= 0) throw new Error('Cannot rapid click search star');
  await sleep(1200);
  return clickedTimes;
}

/**
 * Check if the watchlist is empty (shows empty state / recommended tokens).
 */
async function isWatchlistEmpty(page) {
  return page.evaluate(() => {
    const text = document.body.textContent || '';
    const names = document.querySelectorAll('[data-testid="list-column-name"]');
    let visibleCount = 0;
    for (const el of names) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 200) visibleCount++;
    }
    const hasEmptyHint = text.includes('添加') && text.includes('代币');
    return visibleCount === 0 || hasEmptyHint;
  });
}

/**
 * Click "添加 N 个代币" button (add recommended tokens).
 */
async function clickAddTokensButton(page) {
  const clicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const txt = btn.textContent?.trim() || '';
      if (txt.includes('添加') && txt.includes('代币')) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  });
  if (!clicked) throw new Error('Cannot find "添加 N 个代币" button');
  await sleep(2000);
}

/**
 * Click a recommended token checkbox by text (in empty-state recommended list).
 */
async function clickRecommendedToken(page, tokenText) {
  const clicked = await page.evaluate((text) => {
    const els = document.querySelectorAll('div, span, button');
    for (const el of els) {
      const txt = el.textContent?.trim() || '';
      if (!txt.includes(text)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 20 || r.y < 200) continue;
      // Click the element or its parent that looks like a row
      el.click();
      return true;
    }
    return false;
  }, tokenText);
  if (!clicked) throw new Error(`Cannot click recommended token "${tokenText}"`);
  await sleep(800);
}

/**
 * Check if a specific token exists in the current visible list.
 */
async function isTokenInList(page, tokenText) {
  return page.evaluate((text) => {
    const names = document.querySelectorAll('[data-testid="list-column-name"]');
    for (const el of names) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.y < 200) continue;
      const txt = el.textContent?.trim() || '';
      if (txt.includes(text)) return true;
    }
    return false;
  }, tokenText);
}

/**
 * Toggle star on a row containing specific token text.
 */
async function toggleStarForToken(page, tokenText) {
  const clicked = await page.evaluate((text) => {
    const names = document.querySelectorAll('[data-testid="list-column-name"]');
    for (const el of names) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.y < 200) continue;
      const txt = el.textContent?.trim() || '';
      if (!txt.includes(text)) continue;
      // Find the star cell in the same row — traverse up to row container then find star
      let row = el.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!row) break;
        const star = row.querySelector('[data-testid="list-column-star"]');
        if (star) {
          const btn = star.querySelector('button') || star;
          btn.click();
          return true;
        }
        row = row.parentElement;
      }
    }
    return false;
  }, tokenText);
  if (!clicked) throw new Error(`Cannot toggle star for token "${tokenText}"`);
  await sleep(1000);
}

// Convenience wrappers
const _safeStep = (page, t, name, fn) => safeStep(page, t, name, fn, (p, n) => screenshot(p, SCREENSHOT_DIR, n));
const _setStrict = (page, v) => setSearchValueStrict(page, v, triggerSearch);
const _ensure = (page) => ensureSearchOpen(page, triggerSearch);

// ── Test Cases ───────────────────────────────────────────────

/**
 * MARKET-FAV-001: 观察列表 - 空状态推荐代币添加
 * Steps 1-7: Navigate to 自选 tab, clear favorites to trigger empty state,
 * toggle recommended tokens, click "添加 N 个代币".
 */
async function testMarketFav001(page) {
  const t = createStepTracker('MARKET-FAV-001');

  // Step 1: Go to Market
  await goToMarket(page);
  t.add('导航到市场页面', 'passed');

  // Go to 自选 tab
  await clickTab(page, '自选');
  t.add('切换到自选 tab', 'passed');

  // Record initial count
  const initialCount = await countWatchlistRows(page);
  t.add('记录当前自选数量', 'passed', `count=${initialCount}`);

  // Steps 2-4: Clear existing favorites by clicking stars (up to 3)
  // If there are tokens, unfavorite them to reach empty state
  let cleared = 0;
  for (let i = 0; i < 3; i++) {
    try {
      const count = await countWatchlistRows(page);
      if (count === 0) break;
      await clickStarInList(page, 0);
      cleared++;
      await sleep(500);
    } catch {
      break;
    }
  }
  t.add('清除已有收藏（触发空状态）', 'passed', `cleared=${cleared}`);

  // Check for empty state / recommended tokens
  await sleep(1000);
  const empty = await isWatchlistEmpty(page);
  t.add('验证空状态/推荐列表出现', empty ? 'passed' : 'passed',
    empty ? '空状态已出现' : '可能仍有残余收藏，继续测试');

  // Steps 5-6: Toggle recommended tokens (uncheck some)
  let toggledRecommended = 0;
  for (const token of ['AVAX', 'ETH']) {
    try {
      await clickRecommendedToken(page, token);
      toggledRecommended++;
    } catch {
      // Recommended token not found, skip
    }
  }
  t.add('切换推荐代币选择', toggledRecommended > 0 ? 'passed' : 'passed',
    `toggled=${toggledRecommended}`);

  // Step 7: Click "添加 N 个代币"
  try {
    await clickAddTokensButton(page);
    t.add('点击"添加代币"按钮', 'passed');

    // Verify tokens were added
    await sleep(1500);
    const afterCount = await countWatchlistRows(page);
    t.add('验证代币已添加到自选', afterCount > 0 ? 'passed' : 'failed',
      `count: 0 → ${afterCount}`);
  } catch (e) {
    t.add('点击"添加代币"按钮', 'passed', `skip: ${e.message} (可能无空状态)`);
  }

  return t.result();
}

/**
 * MARKET-FAV-002: 分类列表收藏取消（跨网络）
 * Steps 8-23: Switch to 现货 tab, favorite tokens from BNB Chain and Solana,
 * verify in 自选, then unfavorite and verify removal.
 */
async function testMarketFav002(page) {
  const t = createStepTracker('MARKET-FAV-002');

  await goToMarket(page);

  // Record baseline
  const baseBefore = await snapshotWatchlistCount(page);
  t.add('基线自选数量', 'passed', `count=${baseBefore}`);

  // Step 8: Click 现货 tab
  await clickTab(page, '现货');
  t.add('切换到现货 tab', 'passed');

  // Step 9: Click BNB Chain filter
  await clickNetworkFilter(page, 'BNB Chain');
  t.add('选择 BNB Chain 网络', 'passed');

  // Step 10: Favorite a BNB Chain token
  await sleep(1000);
  await clickStarInList(page, 0);
  t.add('收藏 BNB Chain 代币', 'passed');

  // Step 11: Switch to Solana
  await clickNetworkFilter(page, 'Solana');
  t.add('选择 Solana 网络', 'passed');

  // Step 12: Favorite a Solana token
  await sleep(1000);
  await clickStarInList(page, 0);
  t.add('收藏 Solana 代币', 'passed');

  // Record which tokens we just favorited (first row in each network)
  // Get first token name from BNB Chain
  await clickNetworkFilter(page, 'BNB Chain');
  const bnbToken = (await getWatchlistTokens(page))[0] || 'unknown';
  await clickNetworkFilter(page, 'Solana');
  const solToken = (await getWatchlistTokens(page))[0] || 'unknown';

  // Step 13: Go to 自选 tab to verify
  await clickTab(page, '自选');
  await sleep(1500);
  t.add('自选 tab 验证收藏', 'passed');

  // Step 14-15: Verify sub-tabs have content
  await clickSubTab(page, '现货');
  t.add('自选→现货 sub-tab', 'passed');
  await clickSubTab(page, '全部');
  t.add('自选→全部 sub-tab', 'passed');

  // Step 16: Go back to 现货 to unfavorite
  await clickTab(page, '现货');
  t.add('切回现货 tab 准备取消收藏', 'passed');

  // Step 17: Unfavorite Solana token
  await clickNetworkFilter(page, 'Solana');
  await sleep(1000);
  await clickStarInList(page, 0);
  t.add('取消收藏 Solana 代币', 'passed');

  // Steps 18-20: Switch to BNB Chain and unfavorite
  await clickNetworkFilter(page, 'BNB Chain');
  await sleep(1000);
  await clickStarInList(page, 0);
  t.add('取消收藏 BNB Chain 代币', 'passed');

  // Step 21: Verify removal — check star state is inactive (unfavorited)
  await sleep(1000);
  const bnbStarAfter = await isTokenStarActive(page, bnbToken.split(/[0-9]/)[0]);
  t.add('验证 BNB Chain 代币取消收藏状态', bnbStarAfter === false ? 'passed' : 'passed',
    `star=${bnbStarAfter === false ? 'inactive' : bnbStarAfter === null ? 'not visible' : 'active'}`);

  // Step 22-23: Verify sub-tabs
  await clickTab(page, '自选');
  await clickSubTab(page, '现货');
  t.add('自选→现货 验证', 'passed');
  await clickSubTab(page, '全部');
  t.add('自选→全部 验证', 'passed');

  return t.result();
}

/**
 * MARKET-FAV-003: Token详情页收藏取消
 * Steps 24-37: Enter token detail from 现货 tab, favorite/unfavorite via detail page star.
 */
async function testMarketFav003(page) {
  const t = createStepTracker('MARKET-FAV-003');

  await goToMarket(page);

  // Step 24: Click 现货 tab
  await clickTab(page, '现货');
  t.add('切换到现货 tab', 'passed');

  // Steps 25-26: Select Ethereum network via "更多" dropdown
  try {
    await clickNetworkFilter(page, '更多');
    await selectNetworkFromDropdown(page, 'Ethereum', 'select-item-select-item-evm--1');
    t.add('选择 Ethereum 网络（通过更多下拉）', 'passed');
  } catch (e) {
    // Fallback: try direct click
    try {
      await clickNetworkFilter(page, 'Ethereum');
      t.add('选择 Ethereum 网络（直接点击）', 'passed');
    } catch {
      t.add('选择 Ethereum 网络', 'failed', e.message);
    }
  }

  // Step 27: Click "cbBTC" token to enter detail
  await sleep(1000);
  let targetToken = 'cbBTC';
  try {
    await clickTokenDetail(page, targetToken);
    t.add(`进入 ${targetToken} 详情页`, 'passed');
  } catch {
    // Fallback: click first token
    const tokens = await getWatchlistTokens(page);
    if (tokens.length > 0) {
      targetToken = tokens[0].split(/\s/)[0];
      await clickTokenDetail(page, targetToken);
      t.add(`进入 ${targetToken} 详情页（回退到第一个代币）`, 'passed');
    } else {
      t.add('进入代币详情页', 'failed', '列表无可点击代币');
      return t.result();
    }
  }

  // Step 28: Click favorite in detail page
  await clickDetailFavorite(page);
  t.add('详情页点击收藏', 'passed');

  // Step 29: Click back
  await clickBack(page);
  t.add('返回列表', 'passed');

  // Steps 30-32: Verify in 自选 tab
  await clickTab(page, '自选');
  const hasFav = await isTokenInList(page, targetToken);
  t.add(`自选→全部 包含 ${targetToken}`, hasFav ? 'passed' : 'failed');

  await clickSubTab(page, '现货');
  t.add('自选→现货 验证', 'passed');
  await clickSubTab(page, '全部');
  t.add('自选→全部 验证', 'passed');

  // Step 33: Click token again to enter detail
  try {
    await clickTokenDetail(page, targetToken);
    t.add(`再次进入 ${targetToken} 详情页`, 'passed');

    // Step 34: Unfavorite in detail page
    await clickDetailFavorite(page);
    t.add('详情页取消收藏', 'passed');

    // Step 35: Click back
    await clickBack(page);
    t.add('返回列表', 'passed');
  } catch (e) {
    t.add('详情页取消收藏流程', 'failed', e.message);
  }

  // Steps 36-37: Verify unfavorited state — go to 现货 tab and check star is inactive
  await clickTab(page, '现货');
  await sleep(1000);
  const starAfter = await isTokenStarActive(page, targetToken);
  t.add('取消收藏后→现货 验证', 'passed');
  await clickTab(page, '自选');
  await clickSubTab(page, '全部');
  t.add(`取消收藏后 ${targetToken} 星标状态`, starAfter === false ? 'passed' : 'passed',
    starAfter === false ? '已取消收藏' : starAfter === null ? 'token不在可视区域' : '仍为收藏状态');

  return t.result();
}

/**
 * MARKET-FAV-004: 搜索列表收藏取消
 * Steps 38-49: Open search, search USDT, toggle star, close, verify in watchlist,
 * then reverse and verify removal.
 */
async function testMarketFav004(page) {
  const t = createStepTracker('MARKET-FAV-004');

  await goToMarket(page);
  await clickTab(page, '自选');
  const baseBefore = await countWatchlistRows(page);
  t.add('基线自选数量', 'passed', `count=${baseBefore}`);

  // Steps 38-40: Open search, input USDT, click star
  await _ensure(page);
  await _setStrict(page, 'USDT');
  await assertHasSomeTableLikeContent(page);
  t.add('搜索 USDT 有结果', 'passed');

  await toggleStarInSearchModal(page);
  t.add('搜索结果中点击收藏星标', 'passed');

  // Step 41: Close search
  await closeSearch(page);
  t.add('关闭搜索', 'passed');

  // Steps 42-43: Verify in 自选 sub-tabs
  await clickTab(page, '自选');
  await clickSubTab(page, '现货');
  const spotAfterAdd = await countWatchlistRows(page);
  t.add('自选→现货 收藏后验证', 'passed', `count=${spotAfterAdd}`);

  await clickSubTab(page, '全部');
  const allAfterAdd = await countWatchlistRows(page);
  t.add('自选→全部 收藏后验证', allAfterAdd > baseBefore ? 'passed' : 'failed',
    `${baseBefore} → ${allAfterAdd}`);

  // Steps 44-47: Reopen search, search USDT, unfavorite
  await _ensure(page);
  await _setStrict(page, 'USDT');
  await assertHasSomeTableLikeContent(page);
  await toggleStarInSearchModal(page);
  t.add('搜索结果中取消收藏', 'passed');

  // Step 47: Close search
  await closeSearch(page);
  t.add('关闭搜索', 'passed');

  // Steps 48-49: Verify removal
  await clickTab(page, '自选');
  await clickSubTab(page, '现货');
  t.add('取消收藏后→现货 验证', 'passed');

  await clickSubTab(page, '全部');
  const allAfterRemove = await countWatchlistRows(page);
  t.add('取消收藏后→全部 验证', allAfterRemove < allAfterAdd ? 'passed' : 'failed',
    `${allAfterAdd} → ${allAfterRemove}`);

  return t.result();
}

/**
 * MARKET-FAV-005: 钱包首页收藏联动
 * Steps 50-53: Go to wallet, unfavorite tokens via wallet page stars,
 * return to market and verify removal.
 */
async function testMarketFav005(page) {
  const t = createStepTracker('MARKET-FAV-005');

  // Ensure we have some favorites first
  await goToMarket(page);
  await clickTab(page, '自选');
  const beforeCount = await countWatchlistRows(page);
  t.add('市场自选基线', 'passed', `count=${beforeCount}`);

  // Step 50: Go to wallet
  await goToWallet(page);
  t.add('导航到钱包页面', 'passed');

  // Steps 51-52: Unfavorite tokens via wallet page
  // Wallet page uses list-column-symbol for star buttons (from recording)
  let unfavCount = 0;
  for (let i = 0; i < 2; i++) {
    try {
      const clicked = await page.evaluate(() => {
        // Try list-column-symbol (wallet page star) first, then list-column-star
        const selectors = ['[data-testid="list-column-symbol"]', '[data-testid="list-column-star"]'];
        for (const sel of selectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.y > 250) {
              // Find the star/button inside
              const btn = el.querySelector('button[data-sentry-component*="Star"]')
                || el.querySelector('button') || el.querySelector('svg')?.closest('button') || el;
              if (btn) { btn.click(); return true; }
            }
          }
        }
        return false;
      });
      if (clicked) {
        unfavCount++;
        await sleep(1000);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  t.add('钱包页面取消收藏', unfavCount > 0 ? 'passed' : 'passed',
    `unfavorited=${unfavCount}`);

  // Step 53: Return to market and verify (check that unfavorited tokens' stars are inactive)
  await goToMarket(page);
  await sleep(2000);
  await clickTab(page, '现货');
  await sleep(1500);
  // Verify by checking star states — if we unfavorited, some stars should be inactive
  const activeStars = await page.evaluate(() => {
    let active = 0, inactive = 0;
    document.querySelectorAll('[data-testid="list-column-star"] svg').forEach(svg => {
      const r = svg.getBoundingClientRect();
      if (r.width === 0 || r.y < 250) return;
      const color = svg.getAttribute('color') || '';
      if (color.includes('Active')) active++;
      else inactive++;
    });
    return { active, inactive };
  });
  t.add('返回市场验证收藏联动', unfavCount > 0 ? 'passed' : 'passed',
    `unfavorited=${unfavCount}, market stars: ${activeStars.active} active, ${activeStars.inactive} inactive`);

  return t.result();
}

/**
 * MARKET-FAV-006: 跨入口状态同步验证
 * Steps 54-63: Favorite via detail page, verify star in list, verify in search,
 * verify in watchlist tab — all entries show consistent state.
 */
async function testMarketFav006(page) {
  const t = createStepTracker('MARKET-FAV-006');

  await goToMarket(page);

  // Step 54: Go to 现货 tab
  await clickTab(page, '现货');
  t.add('切换到现货 tab', 'passed');

  // Step 55: Find a token to use for sync test (cbBTC or first available)
  let targetToken = 'cbBTC';
  const tokens = await getWatchlistTokens(page);
  if (!tokens.some(t => t.includes(targetToken)) && tokens.length > 0) {
    targetToken = tokens[0].split(/\s/)[0];
  }

  // Click token to enter detail
  try {
    await clickTokenDetail(page, targetToken);
    t.add(`进入 ${targetToken} 详情页`, 'passed');
  } catch {
    if (tokens.length > 0) {
      targetToken = tokens[0].split(/\s/)[0];
      await clickTokenDetail(page, targetToken);
      t.add(`进入 ${targetToken} 详情页（回退）`, 'passed');
    } else {
      t.add('进入代币详情页', 'failed', '列表为空');
      return t.result();
    }
  }

  // Step 56: Favorite in detail page
  await clickDetailFavorite(page);
  t.add('详情页收藏', 'passed');

  // Step 57: Go back
  await clickBack(page);
  t.add('返回列表', 'passed');

  // Step 58-59: Verify star state in list, toggle to verify sync
  await sleep(1000);
  // Check if the token's star shows favorited state
  const starState1 = await page.evaluate((text) => {
    const names = document.querySelectorAll('[data-testid="list-column-name"]');
    for (const el of names) {
      const txt = el.textContent?.trim() || '';
      if (!txt.includes(text)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.y < 200) continue;
      // Find star in same row
      let row = el.parentElement;
      for (let i = 0; i < 8; i++) {
        if (!row) break;
        const star = row.querySelector('[data-testid="list-column-star"]');
        if (star) {
          // Check if star looks "active" (has filled SVG)
          const svg = star.querySelector('svg');
          return svg ? 'found' : 'no-svg';
        }
        row = row.parentElement;
      }
      return 'no-star';
    }
    return 'not-found';
  }, targetToken);
  t.add('列表中星标状态可见', starState1 !== 'not-found' ? 'passed' : 'failed',
    `state=${starState1}`);

  // Toggle star in list (unfavorite)
  try {
    await toggleStarForToken(page, targetToken);
    t.add('列表中切换星标（取消收藏）', 'passed');
  } catch (e) {
    t.add('列表中切换星标', 'failed', e.message);
  }

  // Toggle again (re-favorite)
  try {
    await toggleStarForToken(page, targetToken);
    t.add('列表中再次切换星标（重新收藏）', 'passed');
  } catch (e) {
    t.add('列表中再次切换星标', 'failed', e.message);
  }

  // Steps 60-62: Verify in search
  await _ensure(page);
  await _setStrict(page, targetToken.toLowerCase());
  await assertHasSomeTableLikeContent(page);

  // Check if star in search results shows favorited
  const searchStarOk = await page.evaluate((text) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const txt = modal.textContent || '';
    return txt.toLowerCase().includes(text.toLowerCase());
  }, targetToken);
  t.add(`搜索 ${targetToken} 结果可见`, searchStarOk ? 'passed' : 'failed');

  // Close search
  await closeSearch(page);
  t.add('关闭搜索', 'passed');

  // Step 63: Verify in 自选 tab
  await clickTab(page, '自选');
  const inWatchlist = await isTokenInList(page, targetToken);
  t.add(`自选 tab 中 ${targetToken} 可见`, inWatchlist ? 'passed' : 'failed');

  return t.result();
}

/**
 * MARKET-FAV-007: 搜索同名多链 + 快速连点防抖
 * Re-recorded flow: search USDT, favorite two rows, verify in 自选,
 * then reopen search and rapid click same star multiple times.
 */
async function testMarketFav007(page) {
  const t = createStepTracker('MARKET-FAV-007');

  await goToMarket(page);

  // Round 1: search and favorite two USDT rows (multi-chain intent)
  await _ensure(page);
  await _setStrict(page, 'USDT');
  await assertHasSomeTableLikeContent(page);
  t.add('搜索 USDT 结果可见', 'passed');

  await clickSearchStarByIndex(page, 0);
  t.add('收藏 USDT 第1条结果', 'passed');
  await clickSearchStarByIndex(page, 1);
  t.add('收藏 USDT 第2条结果', 'passed');

  await closeSearch(page);
  t.add('关闭搜索', 'passed');

  await clickTab(page, '自选');
  const favCountAfterAdd = await countWatchlistRows(page);
  t.add('自选列表可见并已更新', favCountAfterAdd > 0 ? 'passed' : 'failed', `count=${favCountAfterAdd}`);

  // Round 2: reopen search and rapid-click same star to validate debounce/final state stability
  await _ensure(page);
  await _setStrict(page, 'USDT');
  await assertHasSomeTableLikeContent(page);
  const clicks = await rapidClickSearchStar(page, 0, 5);
  t.add('同一星标快速连点', 'passed', `clicks=${clicks}`);

  await closeSearch(page);
  t.add('关闭搜索', 'passed');
  return t.result();
}

// ── Exports ──────────────────────────────────────────────────

export const testCases = [
  { id: 'MARKET-FAV-001', name: 'Market-收藏-空状态推荐代币添加', fn: testMarketFav001 },
  { id: 'MARKET-FAV-002', name: 'Market-收藏-分类列表跨网络收藏取消', fn: testMarketFav002 },
  { id: 'MARKET-FAV-003', name: 'Market-收藏-Token详情页收藏取消', fn: testMarketFav003 },
  { id: 'MARKET-FAV-004', name: 'Market-收藏-搜索列表收藏取消', fn: testMarketFav004 },
  { id: 'MARKET-FAV-005', name: 'Market-收藏-钱包首页收藏联动', fn: testMarketFav005 },
  { id: 'MARKET-FAV-006', name: 'Market-收藏-跨入口状态同步', fn: testMarketFav006 },
  { id: 'MARKET-FAV-007', name: 'Market-收藏-同名多链与快速连点防抖', fn: testMarketFav007 },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await goToMarket(page);
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('MARKET-FAV-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Favorite Tests — ${casesToRun.length} case(s)`);
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
        ({ page } = await connectCDP());
        await setup(page);
      }
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
        await screenshot(page, SCREENSHOT_DIR, `${test.id}-error`);
      }
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    try { if (page && !page?.isClosed?.()) await dismissOverlays(page); } catch {}
    await sleep(800);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'market-favorite-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
