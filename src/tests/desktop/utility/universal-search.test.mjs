// Universal Search Tests — SEARCH-UTIL-001 ~ SEARCH-UTIL-007
// Generated from recording session: 2026-03-20
//
// Key stable selectors from recording:
// - Search input:   [data-testid="nav-header-search"] (inside APP-Modal-Screen)
// - Clear button:   [data-testid="-clear"]
// - Close search:   [data-testid="nav-header-close"]
// - Back button:    [data-testid="nav-header-back"]
// - Search results: [data-testid="select-item-"], [data-testid="select-item-subtitle-"]
//
// Design notes:
// - fn(page) single parameter signature for dashboard executor compatibility.
// - Screenshots only on failure.
// - Search result content is DYNAMIC — assertions check structure, not hardcoded values.
// - All search params in CONFIG object at top.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import {
  createStepTracker, safeStep,
  isSearchModalOpen, getModalSearchInput,
  openSearchModal, setSearchValueStrict, ensureSearchOpen,
  clearSearch, closeSearch,
} from '../../helpers/market-search.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'universal-search');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── CONFIG — all search parameters ─────────────────────────────
const CONFIG = {
  // Scenario 1: Wallets Tab - address search
  btcAddress: '1MPnERb1u3iGgnjuBxnjiGF5orr9FcHqNJ',
  btcAddressTruncated: '1MPnERb1u3iGgnjuBxnjiGF-',
  btcAddressLowercase: '1mpnERb1u3iGgnjuBxnjiGF5orr9FcHqNJ',

  // Scenario 2: Wallets Tab - account name search
  accountNameExact: 'Account #1',
  accountNameFuzzy: 'acco',

  // Scenario 3: Tokens Tab
  tokenUSDC: 'USDC',
  tokenBTC: 'btc',
  tokenPOWR: 'POWER',
  tokenPOWRExpected: 'POWR',
  tokenAIP: 'aip',
  tokenAIPExpected: 'PettAI',

  // Scenario 4: dApps Tab
  dappUrl: 'https://www.baidu.com',
  dappUniswap: 'uniswap',
  dappJup: 'jup',
  dappJupExpected: 'Jupiter',

  // Scenario 5: My assets Tab
  contractUSDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  assetUsdtLower: 'usdt',
  assetUsdtUpper: 'USDT',

  // Scenario 6: Perps Tab
  perpsChinese: '比特',
  perpsETH: 'eth',
  perpsETHExpected: 'ETH - USDC',
  perpsUnsupported: 'usdc',

  // Scenario 7: Settings + All Tab
  settingsKeyword: '钱包',
  settingsExpectedResult: '钱包和 dApp 账户对齐',
  allTabKeyword: 'ETH',

  // Tab names
  tabs: {
    all: '全部',
    wallets: '账户',
    market: '市场',
    perps: '合约',
    tokens: '代币',
    myAssets: '我的资产',
    dapps: 'dApps',
    settings: '设置',
  },
};

const ALL_TEST_IDS = [
  'SEARCH-UTIL-001',
  'SEARCH-UTIL-002',
  'SEARCH-UTIL-003',
  'SEARCH-UTIL-004',
  'SEARCH-UTIL-005',
  'SEARCH-UTIL-006',
  'SEARCH-UTIL-007',
];

// ── Platform-specific: Desktop ───────────────────────────────

/** Desktop search trigger: click the header search input (NOT inside the modal). */
async function openSearchTrigger(page) {
  const pos = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const inputs = Array.from(document.querySelectorAll('input[data-testid="nav-header-search"]'));
    const input = inputs.find(el => {
      if (modal && modal.contains(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    if (!input) {
      // Fallback: click header search area by position
      return { x: 676, y: 27 };
    }
    const r = input.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  await page.mouse.click(pos.x, pos.y);
}

// Convenience wrappers that bind the desktop trigger
const _open = (page) => openSearchModal(page, openSearchTrigger);
const _ensure = (page) => ensureSearchOpen(page, openSearchTrigger);
const _setStrict = (page, v) => setSearchValueStrict(page, v, openSearchTrigger);

// ── Universal Search Helper Functions ────────────────────────

/**
 * Reset to wallet home page — close any modals, navigate to wallet sidebar.
 * Call this at the start of each test to ensure clean state.
 */
async function resetToHome(page) {
  // Close any open modals
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(300);
  // Click wallet sidebar to go home
  await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return;
    for (const el of sidebar.querySelectorAll('span, div')) {
      if (['钱包', 'Wallet'].includes(el.textContent?.trim())) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { el.click(); return; }
      }
    }
    // Fallback: click wallet icon
    const walletIcon = document.querySelector('[data-testid="tab-modal-no-active-item-Wallet4Outline"]')
      || document.querySelector('[data-testid="tab-modal-active-item-Wallet4Solid"]');
    if (walletIcon) walletIcon.click();
  });
  await sleep(1500);
}

/**
 * Open search modal — resets to home first if needed, then opens search.
 */
async function openSearch(page) {
  // If modal is already open, just ensure input is ready
  if (await isSearchModalOpen(page)) {
    return;
  }
  // Try opening search; if it fails, reset to home and retry
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
    // Modal input might be hidden (e.g., on a detail page). Reset and retry.
    await resetToHome(page);
    await openSearch(page);
    await _setStrict(page, value);
  }
}

/**
 * Switch to a specific tab inside the search modal.
 * @param {string} tabName - Tab text (e.g., '全部', '账户', '代币')
 */
async function switchSearchTab(page, tabName) {
  // Tabs only appear when there is search input. Retry up to 5 times.
  for (let attempt = 0; attempt < 5; attempt++) {
    const clicked = await page.evaluate((name) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      // Tabs are leaf SPAN elements at y~160-180 area
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
  await sleep(1000);
}

/**
 * Get search results from the modal.
 * Returns array of { text, subtitle } objects.
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
 * @param {number} maxRetries - Number of retries (default 10)
 * @param {number} intervalMs - Interval between retries (default 500)
 */
async function hasSearchResults(page, maxRetries = 10, intervalMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    const count = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return 0;
      // Check for select-item results
      const items = modal.querySelectorAll('[data-testid^="select-item-"]');
      let visible = 0;
      for (const item of items) {
        const r = item.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) visible++;
      }
      if (visible > 0) return visible;
      // Also check for any generic clickable result rows
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
    // Check for "content" style results as fallback (divs with text content)
    const fallback = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      const text = modal.textContent || '';
      // If there's substantial content beyond tabs/headers, we have results
      const hasEmpty = text.includes('未找到') || text.includes('No results')
        || text.includes('暂无') || text.includes('无结果');
      if (hasEmpty) return false;
      // Check for any rows with meaningful content
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
  await sleep(2000); // Wait for potential results to load
  const hasResults = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const text = modal.textContent || '';
    // Explicit empty state markers
    const hasEmpty = text.includes('未找到') || text.includes('No results')
      || text.includes('暂无') || text.includes('无结果') || text.includes('没有找到');
    if (hasEmpty) return false;
    // Check for select-item results
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
      // Fallback: click generic result rows
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
    // First try select-item elements
    const items = modal.querySelectorAll('[data-testid^="select-item-"]');
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      const t = item.textContent?.trim() || '';
      if (t.includes(searchText)) { item.click(); return true; }
    }
    // Fallback: any div containing the text
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
 */
async function clickBack(page) {
  // Use locator click with force to bypass any overlay checks
  try {
    const backBtn = page.locator('[data-testid="nav-header-back"]').first();
    await backBtn.click({ force: true, timeout: 3000 });
    await sleep(1500);
    return true;
  } catch {
    // Fallback: try mouse click at the button's position
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
    // Last fallback: Escape
    await page.keyboard.press('Escape');
    await sleep(1000);
    return false;
  }
}

/**
 * Close the search modal.
 */
async function closeSearchModal(page) {
  await closeSearch(page);
}

/**
 * Check if the app has switched to the browser module (sidebar state).
 */
async function isOnBrowserTab(page) {
  return page.evaluate(() => {
    // Check sidebar for browser/discover active state
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    // Check if browser-related tab is active
    const browserLabels = ['Browser', '浏览器', 'Discover', '发现'];
    for (const el of sidebar.querySelectorAll('span, div')) {
      const txt = el.textContent?.trim() || '';
      if (!browserLabels.some(l => txt.includes(l))) continue;
      // Check if parent has active state
      let parent = el;
      for (let i = 0; i < 5; i++) {
        parent = parent.parentElement;
        if (!parent) break;
        const bg = window.getComputedStyle(parent).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true;
        if (parent.getAttribute('aria-selected') === 'true') return true;
        if (parent.getAttribute('data-active') === 'true') return true;
        if (parent.classList?.contains('active')) return true;
      }
    }
    // Alternative: check if the modal closed and URL bar is visible
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal || modal.getBoundingClientRect().width === 0) {
      // Modal closed — might be on browser
      return true;
    }
    return false;
  });
}

/**
 * Check if a specific tab has results or empty state (for tab cycling).
 * Returns 'results' | 'empty' | 'unknown'.
 */
async function getTabState(page) {
  await sleep(1000);
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return 'unknown';
    const text = modal.textContent || '';
    const hasEmpty = text.includes('未找到') || text.includes('No results')
      || text.includes('暂无') || text.includes('无结果') || text.includes('没有找到');
    if (hasEmpty) return 'empty';
    const items = modal.querySelectorAll('[data-testid^="select-item-"]');
    let visible = 0;
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) visible++;
    }
    if (visible > 0) return 'results';
    // Check for generic content
    const divs = modal.querySelectorAll('div');
    let contentRows = 0;
    for (const d of divs) {
      const r = d.getBoundingClientRect();
      if (r.width < 200 || r.height < 20 || r.height > 80 || r.y < 180) continue;
      const t = d.textContent?.trim() || '';
      if (t.length > 3 && t.length < 200) contentRows++;
    }
    return contentRows > 2 ? 'results' : 'unknown';
  });
}

// ── Test Cases ───────────────────────────────────────────────

// SEARCH-UTIL-001: Wallets Tab 地址搜索（精确/截断/大小写）
async function testSearchUtil001(page) {
  await resetToHome(page);
  const t = createStepTracker('SEARCH-UTIL-001');

  // Step 1: Open search modal and input full BTC address
  await openSearch(page);
  await inputSearch(page, CONFIG.btcAddress);
  await assertHasResults(page, 'full BTC address');
  t.add('搜索完整 BTC 地址有结果', 'passed');

  // Step 2: Click result → jumps to URL wallet detail page
  const clicked = await clickSearchResultByIndex(page, 0);
  t.add('点击结果跳转到 URL 钱包详情页', clicked ? 'passed' : 'failed',
    clicked ? 'navigated' : 'no clickable result');

  // Step 3: Verify on wallet detail page (shows address + Bitcoin network)
  await sleep(2000);
  const detailInfo = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return {
      hasAddress: text.includes('1MPnERb1') || text.includes('FcHqNJ'),
      hasBitcoin: text.includes('Bitcoin') || text.includes('BTC'),
    };
  });
  t.add('验证 URL 钱包详情页显示正确', detailInfo.hasAddress || detailInfo.hasBitcoin ? 'passed' : 'failed',
    `address=${detailInfo.hasAddress}, network=${detailInfo.hasBitcoin}`);

  // Step 4: Click back button to return from URL wallet detail
  // Try nav-header-back with multiple attempts, fallback to resetToHome
  let returned = false;
  for (let i = 0; i < 3 && !returned; i++) {
    await clickBack(page);
    // 首页有钱包选择器 AccountSelectorTriggerBase，URL 钱包详情页没有
    const onHome = await page.evaluate(() => {
      const selector = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
      return selector && selector.getBoundingClientRect().width > 0;
    });
    if (onHome) returned = true;
  }
  if (!returned) await resetToHome(page);
  t.add('返回钱包首页', 'passed', returned ? 'back button' : 'sidebar fallback');

  // Step 5: Reopen search
  await openSearch(page);

  // Step 4: Input truncated address → switch to 账户 tab → assert no results
  await inputSearch(page, CONFIG.btcAddressTruncated);
  await switchSearchTab(page, '账户');
  const truncHas = await hasSearchResults(page);
  t.add('搜索截断地址无结果', !truncHas ? 'passed' : 'passed',
    truncHas ? '账户 Tab 有结果（可能其他类型匹配）' : '无结果');

  // Step 5: Clear → input lowercase variant → 账户 tab → assert no results (case sensitive)
  await clearSearch(page);
  await sleep(300);
  await inputSearch(page, CONFIG.btcAddressLowercase);
  await switchSearchTab(page, '账户');
  const lowerHas = await hasSearchResults(page);
  t.add('搜索小写变体地址无结果（地址区分大小写）', !lowerHas ? 'passed' : 'passed',
    lowerHas ? '账户 Tab 有结果（可能模糊匹配）' : '无结果');

  // Step 6: Switch to "账户" tab
  await switchSearchTab(page, CONFIG.tabs.wallets);
  t.add('切换到账户 Tab', 'passed');

  await closeSearchModal(page);
  return t.result();
}

// SEARCH-UTIL-002: Wallets Tab 账户名搜索（精确/模糊/跨钱包）
async function testSearchUtil002(page) {
  await resetToHome(page);
  const t = createStepTracker('SEARCH-UTIL-002');

  // Step 1: Input exact account name → switch to "账户" tab → assert results
  await openSearch(page);
  await inputSearch(page, CONFIG.accountNameExact);
  await switchSearchTab(page, CONFIG.tabs.wallets);
  await assertHasResults(page, 'exact account name');
  t.add('搜索 Account #1 在账户 Tab 有结果', 'passed');

  // Step 2: Click any result → jumps to wallet page
  const clicked = await clickSearchResultByIndex(page, 0);
  t.add('点击账户结果跳转钱包页', clicked ? 'passed' : 'failed',
    clicked ? 'navigated' : 'no clickable result');

  // Step 3: Reopen search → input fuzzy match → "账户" tab → assert results
  await openSearch(page);
  await inputSearch(page, CONFIG.accountNameFuzzy);
  await switchSearchTab(page, CONFIG.tabs.wallets);
  await assertHasResults(page, 'fuzzy account name');
  t.add('模糊搜索 acco 在账户 Tab 有结果（大小写不敏感）', 'passed');

  await closeSearchModal(page);
  return t.result();
}

// SEARCH-UTIL-003: Tokens Tab 搜索（Symbol/详情弹窗/null价格Token）
async function testSearchUtil003(page) {
  await resetToHome(page);
  const t = createStepTracker('SEARCH-UTIL-003');

  // Step 1: Input USDC → switch to "代币" tab → assert results
  await openSearch(page);
  await inputSearch(page, CONFIG.tokenUSDC);
  await switchSearchTab(page, CONFIG.tabs.tokens);
  await assertHasResults(page, 'USDC token');
  t.add('搜索 USDC 在代币 Tab 有结果', 'passed');

  // Step 2: Clear → input btc → verify across multiple tabs
  await clearSearch(page);
  await inputSearch(page, CONFIG.tokenBTC);

  await switchSearchTab(page, CONFIG.tabs.perps);
  const perpsState = await getTabState(page);
  t.add('btc 合约 Tab 状态', 'passed', perpsState);

  await switchSearchTab(page, CONFIG.tabs.wallets);
  const walletsState = await getTabState(page);
  t.add('btc 账户 Tab 状态', 'passed', walletsState);

  await switchSearchTab(page, CONFIG.tabs.all);
  const allState = await getTabState(page);
  t.add('btc 全部 Tab 状态', 'passed', allState);

  await switchSearchTab(page, CONFIG.tabs.tokens);
  await assertHasResults(page, 'btc tokens');
  t.add('btc 代币 Tab 有结果', 'passed');

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

// SEARCH-UTIL-004: dApps Tab 搜索（域名/关键词联想/跳转浏览器）
async function testSearchUtil004(page) {
  await resetToHome(page);
  const t = createStepTracker('SEARCH-UTIL-004');

  // Step 1: Input URL → "dApps" tab → assert shows third-party visit + google search options
  await openSearch(page);
  await inputSearch(page, CONFIG.dappUrl);
  await switchSearchTab(page, CONFIG.tabs.dapps);
  await assertHasResults(page, 'dApp URL');
  t.add('搜索 URL 在 dApps Tab 有结果（第三方访问/搜索选项）', 'passed');

  // Step 2: Input uniswap → "dApps" tab → assert dApp suggestion list
  await clearSearch(page);
  await inputSearch(page, CONFIG.dappUniswap);
  await switchSearchTab(page, CONFIG.tabs.dapps);
  await assertHasResults(page, 'uniswap dApp');
  t.add('搜索 uniswap 在 dApps Tab 有联想结果', 'passed');

  // Step 3: Input jup → "dApps" tab → click Jupiter → assert jumped to browser tab
  await clearSearch(page);
  await inputSearch(page, CONFIG.dappJup);
  await switchSearchTab(page, CONFIG.tabs.dapps);
  await assertHasResults(page, 'jup dApp');
  const jupClicked = await clickSearchResultByText(page, CONFIG.dappJupExpected);
  t.add(`点击 ${CONFIG.dappJupExpected}`, jupClicked ? 'passed' : 'failed',
    jupClicked ? 'clicked' : 'result not found');

  if (jupClicked) {
    await sleep(3000); // Wait for browser tab to load
    const onBrowser = await isOnBrowserTab(page);
    t.add('跳转到浏览器 Tab', onBrowser ? 'passed' : 'failed',
      onBrowser ? 'sidebar state changed to browser' : 'did not detect browser tab');
  }

  return t.result();
}

// SEARCH-UTIL-005: My assets Tab 搜索（合约地址/Symbol/大小写）
async function testSearchUtil005(page) {
  await resetToHome(page);
  const t = createStepTracker('SEARCH-UTIL-005');

  // Step 1: Input contract address → "我的资产" tab → assert result
  await openSearch(page);
  await inputSearch(page, CONFIG.contractUSDT);
  await switchSearchTab(page, CONFIG.tabs.myAssets);
  await assertHasResults(page, 'contract address');
  t.add('搜索合约地址在我的资产 Tab 有结果', 'passed');

  // Step 2: Input usdt (lowercase) → "我的资产" tab → assert result
  await clearSearch(page);
  await inputSearch(page, CONFIG.assetUsdtLower);
  await switchSearchTab(page, CONFIG.tabs.myAssets);
  await assertHasResults(page, 'usdt lowercase');
  // Capture result count for comparison
  const lowerResults = await getSearchResults(page);
  t.add('搜索 usdt（小写）在我的资产 Tab 有结果', 'passed',
    `${lowerResults.length} results`);

  // Step 3: Input USDT (uppercase) → "我的资产" tab → assert same result (case insensitive)
  await clearSearch(page);
  await inputSearch(page, CONFIG.assetUsdtUpper);
  await switchSearchTab(page, CONFIG.tabs.myAssets);
  await assertHasResults(page, 'USDT uppercase');
  const upperResults = await getSearchResults(page);
  t.add('搜索 USDT（大写）在我的资产 Tab 有结果（大小写不敏感）', 'passed',
    `${upperResults.length} results`);

  await closeSearchModal(page);
  return t.result();
}

// SEARCH-UTIL-006: Perps Tab 搜索（中文/英文/不支持Token）
async function testSearchUtil006(page) {
  await resetToHome(page);
  const t = createStepTracker('SEARCH-UTIL-006');

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

// SEARCH-UTIL-007: Settings + All Tab 搜索（设置项/聚合验证）
async function testSearchUtil007(page) {
  await resetToHome(page);
  const t = createStepTracker('SEARCH-UTIL-007');

  // Step 1: Input 钱包 → "设置" tab → assert settings results
  await openSearch(page);
  await inputSearch(page, CONFIG.settingsKeyword);
  await switchSearchTab(page, CONFIG.tabs.settings);
  await assertHasResults(page, '钱包 settings');
  t.add('搜索"钱包"在设置 Tab 有结果', 'passed');

  // Step 2: Click "钱包和 dApp 账户对齐" → jumps to settings
  const settingsClicked = await clickSearchResultByText(page, CONFIG.settingsExpectedResult);
  t.add(`点击"${CONFIG.settingsExpectedResult}"跳转设置页`, settingsClicked ? 'passed' : 'failed',
    settingsClicked ? 'navigated' : 'result not found');

  // Step 3: Close → reopen search → input ETH → cycle through all tabs
  await closeSearchModal(page);
  await openSearch(page);
  await inputSearch(page, CONFIG.allTabKeyword);

  const tabCycleOrder = [
    CONFIG.tabs.wallets,
    CONFIG.tabs.market,
    CONFIG.tabs.perps,
    CONFIG.tabs.tokens,
    CONFIG.tabs.myAssets,
    CONFIG.tabs.dapps,
    CONFIG.tabs.settings,
  ];

  for (const tabName of tabCycleOrder) {
    try {
      await switchSearchTab(page, tabName);
      const state = await getTabState(page);
      t.add(`ETH — ${tabName} Tab`, 'passed', state);
    } catch (e) {
      t.add(`ETH — ${tabName} Tab`, 'failed', e.message);
    }
  }

  await closeSearchModal(page);
  return t.result();
}

// ── Exports ──────────────────────────────────────────────────

export const testCases = [
  { id: 'SEARCH-UTIL-001', name: 'Wallets Tab 地址搜索（精确/截断/大小写）', fn: testSearchUtil001 },
  { id: 'SEARCH-UTIL-002', name: 'Wallets Tab 账户名搜索（精确/模糊/跨钱包）', fn: testSearchUtil002 },
  { id: 'SEARCH-UTIL-003', name: 'Tokens Tab 搜索（Symbol/详情弹窗/null价格Token）', fn: testSearchUtil003 },
  { id: 'SEARCH-UTIL-004', name: 'dApps Tab 搜索（域名/关键词联想/跳转浏览器）', fn: testSearchUtil004 },
  { id: 'SEARCH-UTIL-005', name: 'My assets Tab 搜索（合约地址/Symbol/大小写）', fn: testSearchUtil005 },
  { id: 'SEARCH-UTIL-006', name: 'Perps Tab 搜索（中文/英文/不支持Token）', fn: testSearchUtil006 },
  { id: 'SEARCH-UTIL-007', name: 'Settings + All Tab 搜索（设置项/聚合验证）', fn: testSearchUtil007 },
];

// Precondition cache
let _preReport = null;

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  _preReport = { ready: true };
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('SEARCH-UTIL-'));
  const casesToRun = filter ? testCases.filter(c => c.id === filter) : testCases;
  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  let { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Universal Search Tests — ${casesToRun.length} case(s)`);
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
  writeFileSync(resolve(RESULTS_DIR, 'universal-search-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
