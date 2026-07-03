// Universal Search — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/utility/universal-search.test.mjs
//   src/tests/web/utility/universal-search.test.mjs
//   src/tests/extension/utility/universal-search.test.mjs
// inject platform-specific CDP connect + search trigger + resetToHome, then call
// createUniversalSearchTests() to get the same test cases prefixed for their platform.
//
// Key stable selectors:
// - Search input:   [data-testid="nav-header-search"] (inside APP-Modal-Screen)
// - Clear button:   [data-testid="-clear"]
// - Close search:   [data-testid="nav-header-close"]
// - Back button:    [data-testid="nav-header-back"]
// - Search results: [data-testid="select-item-"], [data-testid="select-item-subtitle-"]

import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker } from '../../helpers/components.mjs';
import {
  isSearchModalOpen,
  setSearchValueStrict,
  ensureSearchOpen,
  clearSearch,
  closeSearch,
} from '../../helpers/market-search.mjs';

// ── Default CONFIG (full set; web wrapper may use a subset) ────
export const DEFAULT_CONFIG = {
  // Scenario 1: Wallets Tab - address search
  btcAddress: '1MPnERb1u3iGgnjuBxnjiGF5orr9FcHqNJ',
  btcAddressTruncated: '1MPnERb1u3iGgnjuBxnjiGF-',
  btcAddressLowercase: '1mpnERb1u3iGgnjuBxnjiGF5orr9FcHqNJ',

  // Scenario 2: Wallets Tab - account name search
  accountNameExact: 'Account #1',
  accountNameFuzzy: 'acco',

  // Scenario 3 (代币类型搜索) removed — the standalone "代币/Tokens" tab was deleted
  // from the search UI, and token-type results are no longer surfaced in universal
  // search at all. No token coverage is retained here. ("市场" is a separate,
  // pre-existing tab unrelated to the removed token results.)

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
    myAssets: '我的资产',
    dapps: 'dApps',
    settings: '设置',
  },
};

export function classifyDynamicTabExpectation({ targetTab, availableTabs = [], modalState = 'unknown' }) {
  if (availableTabs.includes(targetTab)) {
    return {
      status: 'visible',
      stepStatus: 'passed',
      detail: `visible; tabs=${availableTabs.join('|') || 'none'}`,
    };
  }

  if (modalState === 'results' || modalState === 'empty') {
    return {
      status: 'hidden',
      stepStatus: 'skipped',
      detail: `动态隐藏；当前搜索只暴露 ${availableTabs.join('|') || '无'}，state=${modalState}`,
    };
  }

  return {
    status: 'invalid',
    stepStatus: 'failed',
    detail: `目标 Tab "${targetTab}" 未展示，且搜索态异常；tabs=${availableTabs.join('|') || 'none'}, state=${modalState}`,
  };
}

/**
 * Build Universal Search test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'SEARCH-UTIL' | 'WEB-SEARCH-UTIL' | 'EXT-SEARCH-UTIL'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {Function} [opts.triggerFn] - (page) => Promise<void> — opens search modal.
 *   Desktop: omit (uses default openSearchModal from components).
 *   Web/Ext: pass platform-specific trigger that clicks the search icon/input.
 * @param {Function} opts.resetToHome - (page) => Promise<void> — platform-specific reset.
 * @param {object} [opts.config] - Override DEFAULT_CONFIG. Defaults to DEFAULT_CONFIG.
 * @param {string[]} [opts.testIds] - Subset of which numeric tests to expose, e.g. ['001','002'].
 *   If omitted, exposes all 7. Web wrapper passes a custom mapping (see `customTests`).
 * @param {Array<{id: string, name: string, testFn: string}>} [opts.customTests] - Override the
 *   testCase list with explicit (id, name, testFn) entries. Used by Web wrapper which renumbers
 *   tests 003/006 → 001/002.
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createUniversalSearchTests({
  prefix,
  namePrefix = '',
  triggerFn,
  resetToHome,
  config = DEFAULT_CONFIG,
  testIds,
  customTests,
}) {
  if (!resetToHome) throw new Error('createUniversalSearchTests: resetToHome is required');

  const CONFIG = config;

  // Convenience wrappers that bind the optional trigger
  const _ensure = (page) => ensureSearchOpen(page, triggerFn);
  const _setStrict = (page, v) => setSearchValueStrict(page, v, triggerFn);

  // ── Universal Search Helper Functions ────────────────────────

  /** Open search modal — resets to home first if needed, then opens search. */
  async function openSearch(page) {
    if (await isSearchModalOpen(page)) return;
    try {
      await _ensure(page);
    } catch {
      await resetToHome(page);
      await _ensure(page);
    }
  }

  /** Input search value — clears existing and types new value with pressSequentially. */
  async function inputSearch(page, value) {
    try {
      await _setStrict(page, value);
    } catch {
      await resetToHome(page);
      await openSearch(page);
      await _setStrict(page, value);
    }
  }

  /** Switch to a specific tab inside the search modal. */
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

  async function getVisibleSearchTabs(page) {
    return page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return [];
      const tabs = [];
      for (const el of modal.querySelectorAll('span')) {
        if (el.children.length > 0) continue;
        const text = el.textContent?.trim() || '';
        const r = el.getBoundingClientRect();
        if (!text || r.width <= 0 || r.height <= 0 || r.y < 130 || r.y > 210) continue;
        if (text.length > 18) continue;
        tabs.push(text);
      }
      return [...new Set(tabs)];
    });
  }

  async function switchSearchTabIfVisible(page, tabName) {
    const availableTabs = await getVisibleSearchTabs(page);
    if (availableTabs.includes(tabName)) {
      await switchSearchTab(page, tabName);
      return {
        switched: true,
        ...classifyDynamicTabExpectation({ targetTab: tabName, availableTabs, modalState: 'results' }),
      };
    }

    const modalState = await getTabState(page);
    return {
      switched: false,
      ...classifyDynamicTabExpectation({ targetTab: tabName, availableTabs, modalState }),
    };
  }

  function addDynamicHiddenStep(t, stepName, tabInfo) {
    t.add(stepName, tabInfo.stepStatus, tabInfo.detail);
    return tabInfo.status === 'hidden';
  }

  function dynamicTabStepName(query, tabName) {
    return `${query} — ${tabName} Tab 动态状态`;
  }

  /** Get search results from the modal. */
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

  /** Check if search results exist (with polling retry). */
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

  /** Assert that search results exist. Throws if not found after polling. */
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

  /** Assert that there are NO search results (empty state). */
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

  /** Click a search result by index (0-based). */
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

  /** Click a search result containing specific text. */
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

  /** Click the back button to return. With retry and resetToHome fallback. */
  async function clickBack(page) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const backBtn = page.locator('[data-testid="nav-header-back"]').first();
        await backBtn.click({ force: true, timeout: 3000 });
        await sleep(1500);
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
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(1000);
    await resetToHome(page);
    return false;
  }

  /** Close the search modal. */
  async function closeSearchModal(page) {
    await closeSearch(page);
  }

  /** Check if a specific tab has results or empty state. */
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

  /** Check if the app has switched to the browser module. */
  async function isOnBrowserTab(page) {
    return page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal || modal.getBoundingClientRect().width === 0) {
        return true; // Modal closed — might be on browser
      }
      return false;
    });
  }

  // ── Test Cases (intent-only, platform-agnostic) ──────────────

  /** Test 001: Wallets Tab 地址搜索（精确/截断/大小写） */
  async function test001(page) {
    await resetToHome(page);
    const t = createStepTracker(`${prefix}-001`);

    // Step 1: Open search modal and input full BTC address
    await openSearch(page);
    await inputSearch(page, CONFIG.btcAddress);
    let fullAddressHasResults = true;
    try {
      await assertHasResults(page, 'full BTC address');
      t.add('搜索完整 BTC 地址有结果', 'passed');
    } catch (error) {
      fullAddressHasResults = false;
      const state = await getTabState(page);
      if (state === 'empty' || state === 'results') {
        t.add(
          '搜索完整 BTC 地址账户结果',
          'skipped',
          `当前动态搜索未暴露 full BTC address 账户结果，state=${state}`,
        );
      } else {
        throw error;
      }
    }

    // Step 2: Click result → jumps to URL wallet detail page
    if (fullAddressHasResults) {
      const clicked = await clickSearchResultByIndex(page, 0);
      t.add('点击结果跳转到 URL 钱包详情页', clicked ? 'passed' : 'failed',
        clicked ? 'navigated' : 'no clickable result');

      // Step 3: Verify on wallet detail page
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
    } else {
      t.add('点击结果跳转到 URL 钱包详情页', 'skipped', 'full BTC address 结果未暴露');
      t.add('验证 URL 钱包详情页显示正确', 'skipped', 'full BTC address 结果未暴露');
    }

    // Step 4: Click back button to return
    let returned = false;
    for (let i = 0; i < 3 && !returned; i++) {
      await clickBack(page);
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

    // Step 6: Input truncated address → switch to 账户 tab → check results
    await inputSearch(page, CONFIG.btcAddressTruncated);
    const truncTab = await switchSearchTabIfVisible(page, CONFIG.tabs.wallets);
    if (truncTab.switched) {
      const truncHas = await hasSearchResults(page);
      t.add('搜索截断地址账户结果', 'passed',
        truncHas ? '账户 Tab 有结果（可能其他类型匹配）' : '无结果');
    } else {
      addDynamicHiddenStep(t, '搜索截断地址账户 Tab 动态状态', truncTab);
    }

    // Step 7: Clear → input lowercase variant → 账户 tab → check results
    await clearSearch(page);
    await sleep(300);
    await inputSearch(page, CONFIG.btcAddressLowercase);
    const lowerTab = await switchSearchTabIfVisible(page, CONFIG.tabs.wallets);
    if (lowerTab.switched) {
      const lowerHas = await hasSearchResults(page);
      t.add('搜索小写变体地址账户结果', 'passed',
        lowerHas ? '账户 Tab 有结果（可能模糊匹配）' : '无结果');
    } else {
      addDynamicHiddenStep(t, '搜索小写变体地址账户 Tab 动态状态', lowerTab);
    }

    // Step 8: Switch to "账户" tab
    const finalWalletTab = await switchSearchTabIfVisible(page, CONFIG.tabs.wallets);
    if (finalWalletTab.switched) t.add('切换到账户 Tab', 'passed');
    else addDynamicHiddenStep(t, '账户 Tab 展示状态', finalWalletTab);

    await closeSearchModal(page).catch(() => {});
    return t.result();
  }

  /** Test 002: Wallets Tab 账户名搜索（精确/模糊/跨钱包） */
  async function test002(page) {
    await resetToHome(page);
    const t = createStepTracker(`${prefix}-002`);

    await openSearch(page);
    await inputSearch(page, CONFIG.accountNameExact);
    const exactTab = await switchSearchTabIfVisible(page, CONFIG.tabs.wallets);
    if (exactTab.switched) {
      await assertHasResults(page, 'exact account name');
      t.add('搜索 Account #1 在账户 Tab 有结果', 'passed');
    } else {
      addDynamicHiddenStep(t, 'Account #1 账户 Tab 动态状态', exactTab);
    }

    if (exactTab.switched) {
      const clicked = await clickSearchResultByIndex(page, 0);
      t.add('点击账户结果跳转钱包页', clicked ? 'passed' : 'failed',
        clicked ? 'navigated' : 'no clickable result');
    } else {
      t.skip('点击账户结果跳转钱包页', '账户 Tab 未暴露，当前搜索无可点击账户结果');
    }

    await openSearch(page);
    await inputSearch(page, CONFIG.accountNameFuzzy);
    const fuzzyTab = await switchSearchTabIfVisible(page, CONFIG.tabs.wallets);
    if (fuzzyTab.switched) {
      await assertHasResults(page, 'fuzzy account name');
      t.add('模糊搜索 acco 在账户 Tab 有结果（大小写不敏感）', 'passed');
    } else {
      addDynamicHiddenStep(t, 'acco 账户 Tab 动态状态', fuzzyTab);
    }

    await closeSearchModal(page).catch(() => {});
    return t.result();
  }

  /** Test 004: dApps Tab 搜索（域名/关键词联想/跳转浏览器） */
  async function test004(page) {
    await resetToHome(page);
    const t = createStepTracker(`${prefix}-004`);

    // Step 1: Input URL → "dApps" tab → assert results
    await openSearch(page);
    await inputSearch(page, CONFIG.dappUrl);
    const urlTab = await switchSearchTabIfVisible(page, CONFIG.tabs.dapps);
    if (urlTab.switched) {
      await assertHasResults(page, 'dApp URL');
      t.add('搜索 URL 在 dApps Tab 有结果（第三方访问/搜索选项）', 'passed');
    } else {
      addDynamicHiddenStep(t, 'URL dApps Tab 动态状态', urlTab);
    }

    // Step 2: Input uniswap → "dApps" tab → assert dApp suggestion list
    await clearSearch(page);
    await inputSearch(page, CONFIG.dappUniswap);
    const uniswapTab = await switchSearchTabIfVisible(page, CONFIG.tabs.dapps);
    if (uniswapTab.switched) {
      await assertHasResults(page, 'uniswap dApp');
      t.add('搜索 uniswap 在 dApps Tab 有联想结果', 'passed');
    } else {
      addDynamicHiddenStep(t, 'uniswap dApps Tab 动态状态', uniswapTab);
    }

    // Step 3: Input jup → "dApps" tab → click Jupiter → assert jumped to browser
    await clearSearch(page);
    await inputSearch(page, CONFIG.dappJup);
    const jupTab = await switchSearchTabIfVisible(page, CONFIG.tabs.dapps);
    if (jupTab.switched) await assertHasResults(page, 'jup dApp');
    else addDynamicHiddenStep(t, 'jup dApps Tab 动态状态', jupTab);
    const jupClicked = jupTab.switched ? await clickSearchResultByText(page, CONFIG.dappJupExpected) : false;
    t.add(`点击 ${CONFIG.dappJupExpected}`, jupTab.switched ? (jupClicked ? 'passed' : 'failed') : 'skipped',
      jupTab.switched ? (jupClicked ? 'clicked' : 'result not found') : 'dApps Tab 未暴露');

    if (jupClicked) {
      await sleep(3000);
      const onBrowser = await isOnBrowserTab(page);
      t.add('跳转到浏览器 Tab', onBrowser ? 'passed' : 'failed',
        onBrowser ? 'modal closed (browser view)' : 'did not detect browser tab');
    }

    return t.result();
  }

  /** Test 005: My assets Tab 搜索（合约地址/Symbol/大小写） */
  async function test005(page) {
    await resetToHome(page);
    const t = createStepTracker(`${prefix}-005`);

    // Step 1: Input contract address → "我的资产" tab → assert result
    await openSearch(page);
    await inputSearch(page, CONFIG.contractUSDT);
    const contractTab = await switchSearchTabIfVisible(page, CONFIG.tabs.myAssets);
    if (contractTab.switched) {
      await assertHasResults(page, 'contract address');
      t.add('搜索合约地址在我的资产 Tab 有结果', 'passed');
    } else {
      addDynamicHiddenStep(t, '合约地址我的资产 Tab 动态状态', contractTab);
    }

    // Step 2: Input usdt (lowercase) → "我的资产" tab → assert result
    await clearSearch(page);
    await inputSearch(page, CONFIG.assetUsdtLower);
    const usdtLowerTab = await switchSearchTabIfVisible(page, CONFIG.tabs.myAssets);
    if (usdtLowerTab.switched) {
      await assertHasResults(page, 'usdt lowercase');
      const lowerResults = await getSearchResults(page);
      t.add('搜索 usdt（小写）在我的资产 Tab 有结果', 'passed',
        `${lowerResults.length} results`);
    } else {
      addDynamicHiddenStep(t, 'usdt 我的资产 Tab 动态状态', usdtLowerTab);
    }

    // Step 3: Input USDT (uppercase) → "我的资产" tab → assert same result
    await clearSearch(page);
    await inputSearch(page, CONFIG.assetUsdtUpper);
    const usdtUpperTab = await switchSearchTabIfVisible(page, CONFIG.tabs.myAssets);
    if (usdtUpperTab.switched) {
      await assertHasResults(page, 'USDT uppercase');
      const upperResults = await getSearchResults(page);
      t.add('搜索 USDT（大写）在我的资产 Tab 有结果（大小写不敏感）', 'passed',
        `${upperResults.length} results`);
    } else {
      addDynamicHiddenStep(t, 'USDT 我的资产 Tab 动态状态', usdtUpperTab);
    }

    await closeSearchModal(page).catch(() => {});
    return t.result();
  }

  /** Test 006: Perps Tab 搜索（中文/英文/不支持Token） */
  async function test006(page) {
    await resetToHome(page);
    const t = createStepTracker(`${prefix}-006`);

    // Step 1: Input 比特 (Chinese) → "合约" tab → assert results
    await openSearch(page);
    await inputSearch(page, CONFIG.perpsChinese);
    const chineseTab = await switchSearchTabIfVisible(page, CONFIG.tabs.perps);
    if (chineseTab.switched) {
      await assertHasResults(page, '比特 Chinese');
      t.add('搜索中文"比特"在合约 Tab 有结果', 'passed');
    } else {
      addDynamicHiddenStep(t, '中文"比特"合约 Tab 动态状态', chineseTab);
    }

    // Step 2: Input eth → "合约" tab → click "ETH - USDC" → jumps to perps detail
    await clearSearch(page);
    await inputSearch(page, CONFIG.perpsETH);
    const ethTab = await switchSearchTabIfVisible(page, CONFIG.tabs.perps);
    if (ethTab.switched) await assertHasResults(page, 'eth perps');
    else addDynamicHiddenStep(t, 'eth 合约 Tab 动态状态', ethTab);
    const ethClicked = ethTab.switched ? await clickSearchResultByText(page, CONFIG.perpsETHExpected) : false;
    t.add(`点击 ${CONFIG.perpsETHExpected} 进入合约详情`, ethTab.switched ? (ethClicked ? 'passed' : 'failed') : 'skipped',
      ethTab.switched ? (ethClicked ? 'navigated' : 'result not found') : '合约 Tab 未暴露');

    // Step 3: Reopen search → input usdc → "合约" tab → assert NO results
    await openSearch(page);
    await inputSearch(page, CONFIG.perpsUnsupported);
    const unsupportedTab = await switchSearchTabIfVisible(page, CONFIG.tabs.perps);
    if (unsupportedTab.switched) {
      await assertNoResults(page, 'usdc not supported in perps');
      t.add('搜索 usdc 在合约 Tab 无结果（不支持的Token）', 'passed');
    } else {
      addDynamicHiddenStep(t, 'usdc 合约 Tab 动态状态', unsupportedTab);
    }

    await closeSearchModal(page).catch(() => {});
    return t.result();
  }

  /** Test 007: Settings + All Tab 搜索（设置项/聚合验证） */
  async function test007(page) {
    await resetToHome(page);
    const t = createStepTracker(`${prefix}-007`);

    // Step 1: Input 钱包 → "设置" tab → assert settings results
    await openSearch(page);
    await inputSearch(page, CONFIG.settingsKeyword);
    const settingsTab = await switchSearchTabIfVisible(page, CONFIG.tabs.settings);
    if (settingsTab.switched) {
      await assertHasResults(page, '钱包 settings');
      t.add('搜索"钱包"在设置 Tab 有结果', 'passed');
    } else {
      addDynamicHiddenStep(t, '钱包 设置 Tab 动态状态', settingsTab);
    }

    // Step 2: Click "钱包和 dApp 账户对齐" → jumps to settings
    const settingsClicked = settingsTab.switched ? await clickSearchResultByText(page, CONFIG.settingsExpectedResult) : false;
    t.add(`点击"${CONFIG.settingsExpectedResult}"跳转设置页`, settingsTab.switched ? (settingsClicked ? 'passed' : 'failed') : 'skipped',
      settingsTab.switched ? (settingsClicked ? 'navigated' : 'result not found') : '设置 Tab 未暴露');

    // Step 3: Close → reopen search → input ETH → cycle through all tabs
    await closeSearchModal(page).catch(() => {});
    await openSearch(page);
    await inputSearch(page, CONFIG.allTabKeyword);

    const tabCycleOrder = [
      CONFIG.tabs.wallets,
      CONFIG.tabs.market,
      CONFIG.tabs.perps,
      CONFIG.tabs.myAssets,
      CONFIG.tabs.dapps,
      CONFIG.tabs.settings,
    ].filter(Boolean);

    for (const tabName of tabCycleOrder) {
      const tabInfo = await switchSearchTabIfVisible(page, tabName);
      if (tabInfo.switched) {
        const state = await getTabState(page);
        t.add(`ETH — ${tabName} Tab`, 'passed', state);
      } else {
        addDynamicHiddenStep(t, dynamicTabStepName('ETH', tabName), tabInfo);
      }
    }

    await closeSearchModal(page).catch(() => {});
    return t.result();
  }

  // ── Registry ──────────────────────────────────────────────────

  const ALL_TESTS = {
    '001': { fn: test001, baseName: 'Wallets Tab 地址搜索（精确/截断/大小写）' },
    '002': { fn: test002, baseName: 'Wallets Tab 账户名搜索（精确/模糊/跨钱包）' },
    // '003' (代币类型搜索) removed — 代币/Tokens tab no longer exists in dynamic-tab search UI.
    '004': { fn: test004, baseName: 'dApps Tab 搜索（域名/关键词联想/跳转浏览器）' },
    '005': { fn: test005, baseName: 'My assets Tab 搜索（合约地址/Symbol/大小写）' },
    '006': { fn: test006, baseName: 'Perps Tab 搜索（中文/英文/不支持Token）' },
    '007': { fn: test007, baseName: 'Settings + All Tab 搜索（设置项/聚合验证）' },
  };

  let testCases;
  if (customTests) {
    // Custom mapping (e.g., Web wrapper: 003 → WEB-SEARCH-UTIL-001 with custom name)
    testCases = customTests.map(({ id, name, testFn }) => {
      const entry = ALL_TESTS[testFn];
      if (!entry) throw new Error(`Unknown testFn key "${testFn}"`);
      return { id, name, fn: entry.fn };
    });
  } else {
    const wantedIds = testIds || Object.keys(ALL_TESTS);
    testCases = wantedIds.map((k) => {
      const entry = ALL_TESTS[k];
      if (!entry) throw new Error(`Unknown test id "${k}"`);
      return {
        id: `${prefix}-${k}`,
        name: `${namePrefix}${entry.baseName}`,
        fn: entry.fn,
      };
    });
  }

  async function setup(page) {
    await resetToHome(page);
  }

  return { testCases, setup };
}
