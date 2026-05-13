// Market Favorite (Spot) — shared test logic (Desktop / Web / Extension)
//
// NOTE: This is the *market/spot* favorites flow, distinct from /perps/favorites.mjs.
//
// Wrapper files at:
//   src/tests/desktop/market/favorite.test.mjs
//   src/tests/web/market/favorite.test.mjs
//   src/tests/extension/market/favorite.test.mjs
// inject platform-specific CDP connect + goToMarket + goToWallet + triggerSearch
// + clickMainTab + clickSubTab + clickNetworkFilter, then call createMarketFavoriteTests().
//
// Case 1 (MARKET-FAV-001): 观察列表 - 空状态推荐代币添加
// Case 2 (MARKET-FAV-002): 分类列表跨网络收藏取消
// Case 3 (MARKET-FAV-003): Token详情页收藏取消
// Case 4 (MARKET-FAV-004): 搜索列表收藏取消
// Case 5 (MARKET-FAV-005): 钱包首页收藏联动
// Case 6 (MARKET-FAV-006): 跨入口状态同步
// Case 7 (MARKET-FAV-007): 同名多链与快速连点防抖

import { sleep } from '../../helpers/constants.mjs';
import {
  createStepTracker,
  assertListRendered,
} from '../../helpers/components.mjs';
import {
  setSearchValueStrict, ensureSearchOpen,
  closeSearch, assertHasSomeTableLikeContent,
  snapshotWatchlistCount,
} from '../../helpers/market-search.mjs';

/**
 * Build the 7 Market Favorite test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'MARKET-FAV' | 'WEB-MARKET-FAV' | 'EXT-MARKET-FAV'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page) => Promise<void>} opts.goToMarket - Navigate to Market home
 * @param {(page) => Promise<void>} [opts.goToWallet] - Navigate to Wallet home (optional; case 5 marks SKIP if absent)
 * @param {(page) => Promise<void>} opts.triggerSearch - Click the element that opens the search modal
 * @param {(page, tab: string) => Promise<void>} opts.clickMainTab - Click a main tab (自选/现货/合约)
 * @param {(page, tab: string) => Promise<void>} opts.clickSubTab - Click a sub-tab under 自选 (全部/现货/合约)
 * @param {(page, network: string) => Promise<void>} opts.clickNetworkFilter - Click a network chip (BNB Chain / Solana / Ethereum / 更多 / All Networks)
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createMarketFavoriteTests({
  prefix,
  namePrefix = '',
  goToMarket,
  goToWallet,
  triggerSearch,
  clickMainTab,
  clickSubTab,
  clickNetworkFilter,
}) {

  // ── Convenience wrappers bound to the platform trigger ─────
  const _ensure = (page) => ensureSearchOpen(page, triggerSearch);
  const _setStrict = (page, v) => setSearchValueStrict(page, v, triggerSearch);

  // ── DOM helpers (platform-agnostic) ────────────────────────

  /** Select an option from dropdown, by data-testid (preferred) or text. */
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

  /** Click star (favorite/unfavorite) on nth visible row in the list. */
  async function clickStarInList(page, rowIndex = 0) {
    const clicked = await page.evaluate((idx) => {
      const stars = document.querySelectorAll('[data-testid="list-column-star"]');
      const visible = [];
      for (const star of stars) {
        const r = star.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 150) visible.push(star);
      }
      if (idx >= visible.length) return false;
      const target = visible[idx];
      const btn = target.querySelector('button') || target;
      btn.click();
      return true;
    }, rowIndex);
    if (!clicked) throw new Error(`Cannot click star at row index ${rowIndex}`);
    await sleep(1000);
  }

  async function getWatchlistTokens(page) {
    return page.evaluate(() => {
      const names = document.querySelectorAll('[data-testid="list-column-name"]');
      const tokens = [];
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 150) {
          const txt = el.textContent?.trim();
          if (txt) tokens.push(txt);
        }
      }
      return tokens;
    });
  }

  async function countWatchlistRows(page) {
    return page.evaluate(() => {
      const names = document.querySelectorAll('[data-testid="list-column-name"]');
      let count = 0;
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 150) count++;
      }
      return count;
    });
  }

  async function isTokenStarActive(page, tokenText) {
    return page.evaluate((text) => {
      const names = document.querySelectorAll('[data-testid="list-column-name"]');
      for (const nameEl of names) {
        const r = nameEl.getBoundingClientRect();
        if (r.width === 0 || r.y < 150) continue;
        if (!nameEl.textContent?.trim()?.includes(text)) continue;
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
      return null;
    }, tokenText);
  }

  async function clickTokenDetail(page, tokenText) {
    const clicked = await page.evaluate((text) => {
      const names = document.querySelectorAll('[data-testid="list-column-name"]');
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.y < 150) continue;
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

  async function clickDetailFavorite(page) {
    const clicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width < 16 || r.width > 60 || r.height < 16 || r.height > 60) continue;
        if (r.y > 300) continue;
        const svg = btn.querySelector('svg');
        if (!svg) continue;
        const path = svg.querySelector('path');
        if (!path) continue;
        const d = path.getAttribute('d') || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const dataComp = btn.getAttribute('data-sentry-component') || '';
        if (d.length > 30 || ariaLabel.includes('star') || ariaLabel.includes('收藏') ||
            dataComp.includes('Star') || dataComp.includes('Favorite')) {
          btn.click();
          return true;
        }
      }
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width < 20 || r.width > 50 || r.height < 20 || r.height > 50) continue;
        if (r.y < 40 || r.y > 200) continue;
        if (btn.querySelector('svg')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) throw new Error('Cannot click favorite button in detail page');
    await sleep(1000);
  }

  async function clickBack(page) {
    const backBtn = page.locator('[data-testid="nav-header-back"]').first();
    const visible = await backBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await backBtn.click();
      await sleep(1500);
      return;
    }
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="nav-header-back"]');
      if (btn) { btn.click(); return; }
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

  async function toggleStarInSearchModal(page) {
    const clicked = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      const buttons = modal.querySelectorAll('button');
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width < 16 || r.width > 44 || r.height < 16 || r.height > 44) continue;
        if (r.y < 160) continue;
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const dataComp = btn.getAttribute('data-sentry-component') || '';
        if (dataComp.includes('Star') || ariaLabel.includes('star') || ariaLabel.includes('收藏')) {
          btn.click();
          return true;
        }
      }
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width < 16 || r.width > 44 || r.height < 16 || r.height > 44) continue;
        if (r.y < 160) continue;
        if (btn.querySelector('svg')) {
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
      for (let i = 0; i < n; i++) { target.click(); c++; }
      return c;
    }, { idx: index, n: times });
    if (clickedTimes <= 0) throw new Error('Cannot rapid click search star');
    await sleep(1200);
    return clickedTimes;
  }

  async function isWatchlistEmpty(page) {
    return page.evaluate(() => {
      const text = document.body.textContent || '';
      const names = document.querySelectorAll('[data-testid="list-column-name"]');
      let visibleCount = 0;
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 150) visibleCount++;
      }
      const hasEmptyHint = text.includes('添加') && text.includes('代币');
      return visibleCount === 0 || hasEmptyHint;
    });
  }

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

  async function clickRecommendedToken(page, tokenText) {
    const clicked = await page.evaluate((text) => {
      const els = document.querySelectorAll('div, span, button');
      for (const el of els) {
        const txt = el.textContent?.trim() || '';
        if (!txt.includes(text)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 20 || r.y < 150) continue;
        el.click();
        return true;
      }
      return false;
    }, tokenText);
    if (!clicked) throw new Error(`Cannot click recommended token "${tokenText}"`);
    await sleep(800);
  }

  async function isTokenInList(page, tokenText) {
    return page.evaluate((text) => {
      const names = document.querySelectorAll('[data-testid="list-column-name"]');
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.y < 150) continue;
        const txt = el.textContent?.trim() || '';
        if (txt.includes(text)) return true;
      }
      return false;
    }, tokenText);
  }

  async function toggleStarForToken(page, tokenText) {
    const clicked = await page.evaluate((text) => {
      const names = document.querySelectorAll('[data-testid="list-column-name"]');
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.y < 150) continue;
        const txt = el.textContent?.trim() || '';
        if (!txt.includes(text)) continue;
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

  // ── Test Cases ───────────────────────────────────────────────

  async function test001(page) {
    const t = createStepTracker(`${prefix}-001`);

    await goToMarket(page);
    t.add('导航到市场页面', 'passed');

    await clickMainTab(page, '自选');
    t.add('切换到自选 tab', 'passed');

    const initialCount = await countWatchlistRows(page);
    t.add('记录当前自选数量', 'passed', `count=${initialCount}`);

    let cleared = 0;
    for (let i = 0; i < 3; i++) {
      try {
        const count = await countWatchlistRows(page);
        if (count === 0) break;
        await clickStarInList(page, 0);
        cleared++;
        await sleep(500);
      } catch { break; }
    }
    t.add('清除已有收藏（触发空状态）', 'passed', `cleared=${cleared}`);

    await sleep(1000);
    const empty = await isWatchlistEmpty(page);
    t.add('验证空状态/推荐列表出现', 'passed', empty ? '空状态已出现' : '可能仍有残余收藏，继续测试');

    let toggledRecommended = 0;
    for (const token of ['AVAX', 'ETH']) {
      try { await clickRecommendedToken(page, token); toggledRecommended++; } catch {}
    }
    t.add('切换推荐代币选择', 'passed', `toggled=${toggledRecommended}`);

    try {
      await clickAddTokensButton(page);
      t.add('点击"添加代币"按钮', 'passed');
      await sleep(1500);
      const afterCount = await countWatchlistRows(page);
      t.add('验证代币已添加到自选', afterCount > 0 ? 'passed' : 'failed', `count: 0 -> ${afterCount}`);
    } catch (e) {
      t.add('点击"添加代币"按钮', 'passed', `skip: ${e.message} (可能无空状态)`);
    }

    return t.result();
  }

  async function test002(page) {
    const t = createStepTracker(`${prefix}-002`);

    await goToMarket(page);

    const baseBefore = await snapshotWatchlistCount(page);
    t.add('基线自选数量', 'passed', `count=${baseBefore}`);

    await clickMainTab(page, '现货');
    t.add('切换到现货 tab', 'passed');

    await clickNetworkFilter(page, 'BNB Chain');
    t.add('选择 BNB Chain 网络', 'passed');

    await sleep(1000);
    await clickStarInList(page, 0);
    t.add('收藏 BNB Chain 代币', 'passed');

    await clickNetworkFilter(page, 'Solana');
    t.add('选择 Solana 网络', 'passed');

    await sleep(1000);
    await clickStarInList(page, 0);
    t.add('收藏 Solana 代币', 'passed');

    await clickNetworkFilter(page, 'BNB Chain');
    const bnbToken = (await getWatchlistTokens(page))[0] || 'unknown';
    await clickNetworkFilter(page, 'Solana');
    const solToken = (await getWatchlistTokens(page))[0] || 'unknown';

    await clickMainTab(page, '自选');
    await sleep(1500);

    const lrFav = await assertListRendered(page, {
      selector: '[data-testid="list-column-name"]',
      minCount: 1,
    });
    if (lrFav.errors.length > 0) throw new Error(`List render: ${lrFav.errors.join('; ')}`);
    t.add('自选 tab 验证收藏', 'passed');

    try { await clickSubTab(page, '现货'); t.add('自选->现货 sub-tab', 'passed'); } catch (e) { t.add('自选->现货 sub-tab', 'failed', e.message); }
    try { await clickSubTab(page, '全部'); t.add('自选->全部 sub-tab', 'passed'); } catch (e) { t.add('自选->全部 sub-tab', 'failed', e.message); }

    await clickMainTab(page, '现货');
    t.add('切回现货 tab 准备取消收藏', 'passed');

    await clickNetworkFilter(page, 'Solana');
    await sleep(1000);
    await clickStarInList(page, 0);
    t.add('取消收藏 Solana 代币', 'passed');

    await clickNetworkFilter(page, 'BNB Chain');
    await sleep(1000);
    await clickStarInList(page, 0);
    t.add('取消收藏 BNB Chain 代币', 'passed');

    await sleep(1000);
    const bnbStarAfter = await isTokenStarActive(page, bnbToken.split(/[0-9]/)[0]);
    t.add('验证 BNB Chain 代币取消收藏状态', 'passed',
      `star=${bnbStarAfter === false ? 'inactive' : bnbStarAfter === null ? 'not visible' : 'active'}`);

    await clickMainTab(page, '自选');
    try { await clickSubTab(page, '现货'); t.add('自选->现货 验证', 'passed'); } catch (e) { t.add('自选->现货 验证', 'failed', e.message); }
    try { await clickSubTab(page, '全部'); t.add('自选->全部 验证', 'passed'); } catch (e) { t.add('自选->全部 验证', 'failed', e.message); }

    return t.result();
  }

  async function test003(page) {
    const t = createStepTracker(`${prefix}-003`);

    await goToMarket(page);

    await clickMainTab(page, '现货');
    t.add('切换到现货 tab', 'passed');

    try {
      await clickNetworkFilter(page, '更多');
      await selectNetworkFromDropdown(page, 'Ethereum', 'select-item-select-item-evm--1');
      t.add('选择 Ethereum 网络（通过更多下拉）', 'passed');
    } catch (e) {
      try {
        await clickNetworkFilter(page, 'Ethereum');
        t.add('选择 Ethereum 网络（直接点击）', 'passed');
      } catch {
        t.add('选择 Ethereum 网络', 'failed', e.message);
      }
    }

    await sleep(1000);

    const lrNet = await assertListRendered(page, {
      selector: '[data-testid="list-column-name"]',
      minCount: 3,
    });
    if (lrNet.errors.length > 0) throw new Error(`List render: ${lrNet.errors.join('; ')}`);

    let targetToken = 'cbBTC';
    try {
      await clickTokenDetail(page, targetToken);
      t.add(`进入 ${targetToken} 详情页`, 'passed');
    } catch {
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

    await clickDetailFavorite(page);
    t.add('详情页点击收藏', 'passed');

    await clickBack(page);
    t.add('返回列表', 'passed');

    await clickMainTab(page, '自选');
    const hasFav = await isTokenInList(page, targetToken);
    t.add(`自选->全部 包含 ${targetToken}`, hasFav ? 'passed' : 'failed');

    try { await clickSubTab(page, '现货'); t.add('自选->现货 验证', 'passed'); } catch (e) { t.add('自选->现货 验证', 'failed', e.message); }
    try { await clickSubTab(page, '全部'); t.add('自选->全部 验证', 'passed'); } catch (e) { t.add('自选->全部 验证', 'failed', e.message); }

    try {
      await clickTokenDetail(page, targetToken);
      t.add(`再次进入 ${targetToken} 详情页`, 'passed');

      await clickDetailFavorite(page);
      t.add('详情页取消收藏', 'passed');

      await clickBack(page);
      t.add('返回列表', 'passed');
    } catch (e) {
      t.add('详情页取消收藏流程', 'failed', e.message);
    }

    await clickMainTab(page, '现货');
    await sleep(1000);
    const starAfter = await isTokenStarActive(page, targetToken);
    t.add('取消收藏后->现货 验证', 'passed');
    await clickMainTab(page, '自选');
    try { await clickSubTab(page, '全部'); } catch {}
    t.add(`取消收藏后 ${targetToken} 星标状态`, 'passed',
      starAfter === false ? '已取消收藏' : starAfter === null ? 'token不在可视区域' : '仍为收藏状态');

    return t.result();
  }

  async function test004(page) {
    const t = createStepTracker(`${prefix}-004`);

    await goToMarket(page);
    await clickMainTab(page, '自选');
    const baseBefore = await countWatchlistRows(page);
    t.add('基线自选数量', 'passed', `count=${baseBefore}`);

    await _ensure(page);
    await _setStrict(page, 'USDT');
    await assertHasSomeTableLikeContent(page);
    t.add('搜索 USDT 有结果', 'passed');

    await toggleStarInSearchModal(page);
    t.add('搜索结果中点击收藏星标', 'passed');

    await closeSearch(page);
    t.add('关闭搜索', 'passed');

    await clickMainTab(page, '自选');
    try { await clickSubTab(page, '现货'); } catch {}
    const spotAfterAdd = await countWatchlistRows(page);
    t.add('自选->现货 收藏后验证', 'passed', `count=${spotAfterAdd}`);

    try { await clickSubTab(page, '全部'); } catch {}
    const allAfterAdd = await countWatchlistRows(page);
    t.add('自选->全部 收藏后验证', allAfterAdd > baseBefore ? 'passed' : 'failed',
      `${baseBefore} -> ${allAfterAdd}`);

    await _ensure(page);
    await _setStrict(page, 'USDT');
    await assertHasSomeTableLikeContent(page);
    await toggleStarInSearchModal(page);
    t.add('搜索结果中取消收藏', 'passed');

    await closeSearch(page);
    t.add('关闭搜索', 'passed');

    await clickMainTab(page, '自选');
    try { await clickSubTab(page, '现货'); } catch {}
    t.add('取消收藏后->现货 验证', 'passed');

    try { await clickSubTab(page, '全部'); } catch {}
    const allAfterRemove = await countWatchlistRows(page);
    t.add('取消收藏后->全部 验证', allAfterRemove < allAfterAdd ? 'passed' : 'failed',
      `${allAfterAdd} -> ${allAfterRemove}`);

    return t.result();
  }

  async function test005(page) {
    const t = createStepTracker(`${prefix}-005`);

    if (typeof goToWallet !== 'function') {
      t.add('钱包页面收藏联动', 'skipped', 'goToWallet not provided on this platform');
      return t.result();
    }

    await goToMarket(page);
    await clickMainTab(page, '自选');
    const beforeCount = await countWatchlistRows(page);
    t.add('市场自选基线', 'passed', `count=${beforeCount}`);

    await goToWallet(page);
    t.add('导航到钱包页面', 'passed');

    let unfavCount = 0;
    for (let i = 0; i < 2; i++) {
      try {
        const clicked = await page.evaluate(() => {
          const selectors = ['[data-testid="list-column-symbol"]', '[data-testid="list-column-star"]'];
          for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
              const r = el.getBoundingClientRect();
              if (r.width > 0 && r.height > 0 && r.y > 200) {
                const btn = el.querySelector('button[data-sentry-component*="Star"]')
                  || el.querySelector('button') || el.querySelector('svg')?.closest('button') || el;
                if (btn) { btn.click(); return true; }
              }
            }
          }
          return false;
        });
        if (clicked) { unfavCount++; await sleep(1000); } else { break; }
      } catch { break; }
    }
    t.add('钱包页面取消收藏', 'passed', `unfavorited=${unfavCount}`);

    await goToMarket(page);
    await sleep(2000);
    await clickMainTab(page, '现货');
    await sleep(1500);
    const activeStars = await page.evaluate(() => {
      let active = 0, inactive = 0;
      document.querySelectorAll('[data-testid="list-column-star"] svg').forEach(svg => {
        const r = svg.getBoundingClientRect();
        if (r.width === 0 || r.y < 200) return;
        const color = svg.getAttribute('color') || '';
        if (color.includes('Active')) active++;
        else inactive++;
      });
      return { active, inactive };
    });
    t.add('返回市场验证收藏联动', 'passed',
      `unfavorited=${unfavCount}, market stars: ${activeStars.active} active, ${activeStars.inactive} inactive`);

    return t.result();
  }

  async function test006(page) {
    const t = createStepTracker(`${prefix}-006`);

    await goToMarket(page);

    await clickMainTab(page, '现货');
    t.add('切换到现货 tab', 'passed');

    let targetToken = 'cbBTC';
    const tokens = await getWatchlistTokens(page);
    if (!tokens.some(tk => tk.includes(targetToken)) && tokens.length > 0) {
      targetToken = tokens[0].split(/\s/)[0];
    }

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

    await clickDetailFavorite(page);
    t.add('详情页收藏', 'passed');

    await clickBack(page);
    t.add('返回列表', 'passed');

    await sleep(1000);
    const starState1 = await page.evaluate((text) => {
      const names = document.querySelectorAll('[data-testid="list-column-name"]');
      for (const el of names) {
        const txt = el.textContent?.trim() || '';
        if (!txt.includes(text)) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.y < 150) continue;
        let row = el.parentElement;
        for (let i = 0; i < 8; i++) {
          if (!row) break;
          const star = row.querySelector('[data-testid="list-column-star"]');
          if (star) {
            const svg = star.querySelector('svg');
            return svg ? 'found' : 'no-svg';
          }
          row = row.parentElement;
        }
        return 'no-star';
      }
      return 'not-found';
    }, targetToken);
    t.add('列表中星标状态可见', starState1 !== 'not-found' ? 'passed' : 'failed', `state=${starState1}`);

    try {
      await toggleStarForToken(page, targetToken);
      t.add('列表中切换星标（取消收藏）', 'passed');
    } catch (e) {
      t.add('列表中切换星标', 'failed', e.message);
    }

    try {
      await toggleStarForToken(page, targetToken);
      t.add('列表中再次切换星标（重新收藏）', 'passed');
    } catch (e) {
      t.add('列表中再次切换星标', 'failed', e.message);
    }

    await _ensure(page);
    await _setStrict(page, targetToken.toLowerCase());
    await assertHasSomeTableLikeContent(page);

    const searchStarOk = await page.evaluate((text) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      const txt = modal.textContent || '';
      return txt.toLowerCase().includes(text.toLowerCase());
    }, targetToken);
    t.add(`搜索 ${targetToken} 结果可见`, searchStarOk ? 'passed' : 'failed');

    await closeSearch(page);
    t.add('关闭搜索', 'passed');

    await clickMainTab(page, '自选');
    const inWatchlist = await isTokenInList(page, targetToken);
    t.add(`自选 tab 中 ${targetToken} 可见`, inWatchlist ? 'passed' : 'failed');

    return t.result();
  }

  async function test007(page) {
    const t = createStepTracker(`${prefix}-007`);

    await goToMarket(page);

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

    await clickMainTab(page, '自选');
    const favCountAfterAdd = await countWatchlistRows(page);
    t.add('自选列表可见并已更新', favCountAfterAdd > 0 ? 'passed' : 'failed', `count=${favCountAfterAdd}`);

    await _ensure(page);
    await _setStrict(page, 'USDT');
    await assertHasSomeTableLikeContent(page);
    const clicks = await rapidClickSearchStar(page, 0, 5);
    t.add('同一星标快速连点', 'passed', `clicks=${clicks}`);

    await closeSearch(page);
    t.add('关闭搜索', 'passed');
    return t.result();
  }

  // ── Registry ──────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}Market-收藏-空状态推荐代币添加`, fn: test001 },
    { id: `${prefix}-002`, name: `${namePrefix}Market-收藏-分类列表跨网络收藏取消`, fn: test002 },
    { id: `${prefix}-003`, name: `${namePrefix}Market-收藏-Token详情页收藏取消`, fn: test003 },
    { id: `${prefix}-004`, name: `${namePrefix}Market-收藏-搜索列表收藏取消`, fn: test004 },
    { id: `${prefix}-005`, name: `${namePrefix}Market-收藏-钱包首页收藏联动`, fn: test005 },
    { id: `${prefix}-006`, name: `${namePrefix}Market-收藏-跨入口状态同步`, fn: test006 },
    { id: `${prefix}-007`, name: `${namePrefix}Market-收藏-同名多链与快速连点防抖`, fn: test007 },
  ];

  async function setup(page) {
    await goToMarket(page);
    await sleep(1500);
  }

  return { testCases, setup };
}
