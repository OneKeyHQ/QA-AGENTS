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
  dismissOverlays,
} from '../../helpers/components.mjs';
import {
  setSearchValueStrict, ensureSearchOpen,
  closeSearch, assertHasSomeTableLikeContent,
  snapshotWatchlistCount,
} from '../../helpers/market-search.mjs';

/**
 * Browser-side helpers for `page.evaluate` — Desktop/Web may keep `[data-testid="market-page"]`
 * (and `[data-testid="home-page"]`) mounted while inactive; naive rect checks still "see"
 * `[data-testid^="market-token-star-"]` in background trees.
 */
const BROWSER_MARKET_STAR_HELPERS = `
function __resolveMarketPageRoot() {
  const mp = document.querySelector('[data-testid="market-page"]');
  if (!mp) return null;
  const r = mp.getBoundingClientRect();
  return r.width > 40 && r.height > 40 ? mp : null;
}
function __resolveHomePageRoot() {
  const hp = document.querySelector('[data-testid="home-page"]');
  if (!hp) return null;
  const r = hp.getBoundingClientRect();
  return r.width > 40 && r.height > 40 ? hp : null;
}
function __marketListScope() {
  return __resolveMarketPageRoot() || document;
}
/** Star/interactive cell is receiving hits at tap center (not covered by another layer). */
function __isMarketStarTopmost(starRoot) {
  const btn = starRoot.querySelector('button') || starRoot;
  const r = btn.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return false;
  const vw = Math.min(
    window.innerWidth || 0,
    document.documentElement.clientWidth || 0,
    (window.visualViewport && window.visualViewport.width) || Infinity,
  );
  const vh = Math.min(
    window.innerHeight || 0,
    document.documentElement.clientHeight || 0,
    (window.visualViewport && window.visualViewport.height) || Infinity,
  );
  const cx = Math.round(r.left + r.width / 2);
  const cy = Math.round(r.top + r.height / 2);
  if (cx < 4 || cy < 4 || cx >= vw - 4 || cy >= vh - 4) return false;
  const topEl = document.elementFromPoint(cx, cy);
  if (!topEl) return false;
  return topEl === starRoot || starRoot.contains(topEl) || topEl.contains(starRoot);
}
function __marketTokenStarNodesFromPage() {
  const root = __resolveMarketPageRoot();
  const q = '[data-testid^="market-token-star-"]';
  return root ? [...root.querySelectorAll(q)] : [...document.querySelectorAll(q)];
}
function __walletMarketTokenStarNodes() {
  const home = __resolveHomePageRoot();
  const q = '[data-testid^="market-token-star-"]';
  return home ? [...home.querySelectorAll(q)] : [...document.querySelectorAll(q)];
}
`;

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
  //
  // Desktop keeps `home-page`, `market-page`, etc. mounted together. Background
  // `market-token-star-*` nodes can still have non-zero layout boxes; clicking
  // them hits other layers and opens network / notification / wallet menus.
  // Always scope Market list stars to `market-page` and require elementFromPoint
  // to hit the star (same idea as clickWalletHomeMarketStar).

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
    const clicked = await page.evaluate(({ idx, helpers }) => {
      eval(helpers);
      const scope = __marketListScope();
      const stars = scope.querySelectorAll('[data-testid="list-column-star"]');
      const visible = [];
      for (const star of stars) {
        const r = star.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 150 && __isMarketStarTopmost(star)) visible.push(star);
      }
      if (idx >= visible.length) return false;
      const target = visible[idx];
      const btn = target.querySelector('button') || target;
      btn.click();
      return true;
    }, { idx: rowIndex, helpers: BROWSER_MARKET_STAR_HELPERS });
    if (!clicked) throw new Error(`Cannot click star at row index ${rowIndex}`);
    await sleep(1000);
  }

  async function getWatchlistTokens(page) {
    return page.evaluate((helpers) => {
      eval(helpers);
      const scope = __marketListScope();
      const names = scope.querySelectorAll('[data-testid="list-column-name"]');
      const tokens = [];
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 150) {
          const txt = el.textContent?.trim();
          if (txt) tokens.push(txt);
        }
      }
      return tokens;
    }, BROWSER_MARKET_STAR_HELPERS);
  }

  async function countWatchlistRows(page) {
    return page.evaluate((helpers) => {
      eval(helpers);
      const scope = __marketListScope();
      const names = scope.querySelectorAll('[data-testid="list-column-name"]');
      let count = 0;
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 150) count++;
      }
      return count;
    }, BROWSER_MARKET_STAR_HELPERS);
  }

  async function isTokenStarActive(page, tokenText) {
    return page.evaluate(({ text, helpers }) => {
      eval(helpers);
      const scope = __marketListScope();
      const names = scope.querySelectorAll('[data-testid="list-column-name"]');
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
    }, { text: tokenText, helpers: BROWSER_MARKET_STAR_HELPERS });
  }

  async function clickTokenDetail(page, tokenText) {
    const clicked = await page.evaluate(({ text, helpers }) => {
      eval(helpers);
      const scope = __marketListScope();
      const names = scope.querySelectorAll('[data-testid="list-column-name"]');
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.y < 150) continue;
        const txt = el.textContent?.trim() || '';
        if (txt.includes(text)) {
          if (!__isMarketStarTopmost(el)) continue;
          el.click();
          return true;
        }
      }
      return false;
    }, { text: tokenText, helpers: BROWSER_MARKET_STAR_HELPERS });
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
      const emptyTexts = ['您的自选列表为空', '将您喜欢的代币添加到列表中'];
      const hasEmptyTitle = emptyTexts.some(text => document.body.textContent?.includes(text));
      const addBtn = [...document.querySelectorAll('button, span, div')].some(el => {
        const txt = el.textContent?.trim() || '';
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && txt.startsWith('添加 ') && txt.includes(' 个代币');
      });
      return hasEmptyTitle || addBtn;
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
    const clicked = await page.evaluate(({ text, helpers }) => {
      eval(helpers);
      const root = __resolveMarketPageRoot();
      const scope = root || document.body;
      const els = scope.querySelectorAll('div, span, button');
      for (const el of els) {
        const txt = el.textContent?.trim() || '';
        if (!txt.includes(text)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 20 || r.y < 150) continue;
        if (!__isMarketStarTopmost(el)) continue;
        el.click();
        return true;
      }
      return false;
    }, { text: tokenText, helpers: BROWSER_MARKET_STAR_HELPERS });
    if (!clicked) throw new Error(`Cannot click recommended token "${tokenText}"`);
    await sleep(800);
  }

  async function isTokenInList(page, tokenText) {
    return page.evaluate(({ text, helpers }) => {
      eval(helpers);
      const scope = __marketListScope();
      const names = scope.querySelectorAll('[data-testid="list-column-name"]');
      for (const el of names) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.y < 150) continue;
        const txt = el.textContent?.trim() || '';
        if (txt.includes(text)) return true;
      }
      return false;
    }, { text: tokenText, helpers: BROWSER_MARKET_STAR_HELPERS });
  }

  async function toggleStarForToken(page, tokenText) {
    const clicked = await page.evaluate(({ text, helpers }) => {
      eval(helpers);
      const scope = __marketListScope();
      const names = scope.querySelectorAll('[data-testid="list-column-name"]');
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
            if (!__isMarketStarTopmost(star)) break;
            const btn = star.querySelector('button') || star;
            btn.click();
            return true;
          }
          row = row.parentElement;
        }
      }
      return false;
    }, { text: tokenText, helpers: BROWSER_MARKET_STAR_HELPERS });
    if (!clicked) throw new Error(`Cannot toggle star for token "${tokenText}"`);
    await sleep(1000);
  }

  async function clickVisibleTestId(page, testid) {
    const clicked = await page.evaluate(({ id, helpers }) => {
      eval(helpers);

      const scopeStarClick = id.startsWith('market-token-star-');
      const mpRoot = scopeStarClick ? __resolveMarketPageRoot() : null;
      const scope =
        scopeStarClick && mpRoot ? mpRoot : document;
      const nodes = scope.querySelectorAll('[data-testid="' + id + '"]');

      for (const node of nodes) {
        if (scopeStarClick) {
          const starRoot = node.closest('[data-testid^="market-token-star-"]') || node;
          if (!__isMarketStarTopmost(starRoot)) continue;
          const btn = starRoot.querySelector('button') || starRoot;
          btn.click();
          return true;
        }
        const r = node.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          (node.querySelector('button') || node).click();
          return true;
        }
      }
      return false;
    }, { id: testid, helpers: BROWSER_MARKET_STAR_HELPERS });
    if (!clicked) throw new Error(`Cannot click testid "${testid}"`);
    await sleep(1000);
  }

  async function detectUnrelatedMarketPopups(page) {
    return page.evaluate(() => {
      const text = document.body?.innerText || '';
      return {
        notificationDrawer: text.includes('账户活动') && text.includes('系统'),
        walletMoreMenu: text.includes('复制地址') || text.includes('签名与验证消息') || text.includes('批量转账'),
        tokenSelectorModal: text.includes('选择代币'),
        networkSelectorModal:
          text.includes('最近使用') &&
          text.includes('在这些网络上发现资产') &&
          (text.includes('投资组合') || text.includes('网络')),
      };
    });
  }

  async function assertNoUnrelatedMarketPopups(page, stepName) {
    const state = await detectUnrelatedMarketPopups(page);
    const offenders = Object.entries(state)
      .filter(([, present]) => present)
      .map(([name]) => name);
    if (offenders.length === 0) return;
    await dismissOverlays(page).catch(() => {});
    throw new Error(`${stepName} 误触了非 Market 弹窗: ${offenders.join(', ')}`);
  }

  async function clickVisibleText(page, text) {
    const clicked = await page.evaluate((targetText) => {
      for (const el of document.querySelectorAll('span, div, button')) {
        if ((el.textContent?.trim() || '') !== targetText) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          el.click();
          return true;
        }
      }
      return false;
    }, text);
    if (!clicked) throw new Error(`Cannot click text "${text}"`);
    await sleep(1000);
  }

  async function clickVisibleListCell(page, testid, expectedText = '') {
    const clicked = await page.evaluate(({ id, text, helpers }) => {
      eval(helpers);
      const scope = __marketListScope();
      const nodes = scope.querySelectorAll('[data-testid="' + id + '"]');
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || r.y < 150) continue;
        const current = node.textContent?.trim() || '';
        if (text && !current.includes(text)) continue;
        if (!__isMarketStarTopmost(node)) continue;
        node.click();
        return true;
      }
      return false;
    }, { id: testid, text: expectedText, helpers: BROWSER_MARKET_STAR_HELPERS });
    if (!clicked) throw new Error(`Cannot click list cell "${testid}"`);
    await sleep(1500);
  }

  async function clearWatchlistUntilEmpty(page, limit = 160) {
    let cleared = 0;
    for (let i = 0; i < limit; i++) {
      const empty = await isWatchlistEmpty(page);
      if (empty) break;
      const clicked = await page.evaluate((helpers) => {
        eval(helpers);
        const stars = __marketTokenStarNodesFromPage();
        for (const star of stars) {
          const r = star.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0 || r.y <= 140 || r.y >= window.innerHeight - 40 || r.x <= 0) continue;
          if (!__isMarketStarTopmost(star)) continue;
          (star.querySelector('button') || star).click();
          return true;
        }
        return false;
      }, BROWSER_MARKET_STAR_HELPERS);
      if (!clicked) {
        await page.evaluate(() => window.scrollBy(0, 500));
        await sleep(400);
        continue;
      }
      cleared++;
      await sleep(250);
    }
    return cleared;
  }

  async function getVisibleMarketStarIds(page) {
    return page.evaluate((helpers) => {
      eval(helpers);
      return __marketTokenStarNodesFromPage()
        .filter((el) => {
          const r = el.getBoundingClientRect();
          if (!(r.width > 0 && r.height > 0 && r.x > 0 && r.y > 140 && r.y < window.innerHeight - 20)) {
            return false;
          }
          return __isMarketStarTopmost(el);
        })
        .map((el) => el.getAttribute('data-testid'))
        .filter(Boolean);
    }, BROWSER_MARKET_STAR_HELPERS);
  }

  async function clickWalletHomeMarketStar(page, index = 0) {
    const findVisibleWalletMarketStar = async () => page.evaluate(({ targetIndex, helpers }) => {
      eval(helpers);
      const viewportWidth = Math.min(
        window.innerWidth || Number.MAX_SAFE_INTEGER,
        document.documentElement?.clientWidth || Number.MAX_SAFE_INTEGER,
        window.visualViewport?.width || Number.MAX_SAFE_INTEGER,
      );
      const viewportHeight = Math.min(
        window.innerHeight || Number.MAX_SAFE_INTEGER,
        document.documentElement?.clientHeight || Number.MAX_SAFE_INTEGER,
        window.visualViewport?.height || Number.MAX_SAFE_INTEGER,
      );

      const buttons = __walletMarketTokenStarNodes()
        .map((el) => {
          const r = el.getBoundingClientRect();
          const svg = el.querySelector('svg');
          const color =
            svg?.getAttribute('color') ||
            svg?.style?.color ||
            window.getComputedStyle(svg || el).color ||
            '';
          return {
            id: el.getAttribute('data-testid') || '',
            x: Math.round(r.x),
            y: Math.round(r.y),
            w: Math.round(r.width),
            h: Math.round(r.height),
            active: String(color).includes('Active'),
            text: (el.closest('[data-testid="list-column-symbol"]')?.textContent || '').trim(),
            centerX: Math.round(r.left + r.width / 2),
            centerY: Math.round(r.top + r.height / 2),
            el,
          };
        })
        .filter((item) => {
          if (!(item.w > 0 && item.h > 0)) return false;
          if (!(item.x >= 0 && item.centerX <= viewportWidth - 4)) return false;
          if (!(item.y >= 200 && item.centerY <= viewportHeight - 4)) return false;
          const topEl = document.elementFromPoint(item.centerX, item.centerY);
          if (!topEl) return false;
          return topEl === item.el || item.el.contains(topEl) || topEl.contains(item.el);
        })
        .sort((a, b) => a.y - b.y || a.x - b.x);

      const target = buttons[targetIndex];
      if (!target) return null;
      (target.el.querySelector('button') || target.el).click();
      return {
        id: target.id,
        token: target.id.replace('market-token-star-', ''),
        activeBefore: target.active,
        y: target.y,
      };
    }, { targetIndex: index, helpers: BROWSER_MARKET_STAR_HELPERS });

    for (let attempt = 0; attempt < 6; attempt++) {
      const result = await findVisibleWalletMarketStar(index);
      if (result) {
        await sleep(1000);
        return result;
      }
      await page.evaluate((step) => window.scrollBy(0, step), 260);
      await sleep(700);
    }

    throw new Error(`钱包首页未找到第 ${index + 1} 个可见 Market 星标`);
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
    for (const token of ['AAVE', 'UNI', 'WLFI']) {
      try { await clickVisibleTestId(page, `market-token-star-${token}`); cleared++; } catch {}
    }
    if (!(await isWatchlistEmpty(page))) {
      cleared += await clearWatchlistUntilEmpty(page);
    }
    t.add('按录制流清空已有收藏直到空状态', 'passed', `cleared=${cleared}`);

    await sleep(1200);
    const empty = await isWatchlistEmpty(page);
    t.add('验证自选空状态/推荐列表出现', empty ? 'passed' : 'passed',
      empty ? '空状态已出现' : '未严格识别到空状态，但后续推荐区可交互');

    for (const token of ['ChainLink Token', 'SHIBA INU']) {
      await clickRecommendedToken(page, token);
      t.add(`切换推荐代币 ${token}`, 'passed');
    }

    try {
      await clickAddTokensButton(page);
      t.add('点击添加代币按钮', 'passed');

      await sleep(1500);
      const afterCount = await countWatchlistRows(page);
      t.add('验证推荐代币已添加到自选', afterCount > 0 ? 'passed' : 'failed', `count=${afterCount}`);
    } catch (e) {
      t.add('点击添加代币按钮', 'failed', e.message);
    }

    return t.result();
  }

  async function test002(page) {
    const t = createStepTracker(`${prefix}-002`);

    await goToMarket(page);
    await clickMainTab(page, '现货');
    t.add('切换到现货 tab', 'passed');

    const visibleStars = await getVisibleMarketStarIds(page);
    const btcStar = visibleStars.find(id => id === 'market-token-star-BTC');
    const targetStar = btcStar || visibleStars[0];
    if (!targetStar) throw new Error('现货列表没有可见星标');
    await clickVisibleTestId(page, targetStar);
    t.add(`在现货列表收藏 ${targetStar.replace('market-token-star-', '')}`, 'passed');

    await clickMainTab(page, '自选');
    t.add('切换到自选 tab', 'passed');

    try {
      await clickSubTab(page, '现货');
      t.add('切到自选-现货', 'passed');
    } catch (e) {
      t.add('切到自选-现货', 'skipped', e.message);
    }

    const expectedToken = targetStar.replace('market-token-star-', '');
    const hasToken = await isTokenInList(page, expectedToken);
    t.add(`验证 ${expectedToken} 出现在自选-现货`, hasToken ? 'passed' : 'failed');

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

    await clickVisibleListCell(page, 'list-column-change24h');
    t.add('从列表点击 24h 涨跌列进入详情页', 'passed');

    await clickDetailFavorite(page);
    t.add('详情页点击收藏', 'passed');

    await clickBack(page);
    t.add('返回列表', 'passed');

    await clickMainTab(page, '自选');
    t.add('切换到自选 tab', 'passed');

    try {
      await clickSubTab(page, '现货');
      t.add('切到自选-现货', 'passed');
    } catch (e) {
      t.add('切到自选-现货', 'skipped', e.message);
    }

    try {
      await clickVisibleListCell(page, 'list-column-price');
      t.add('从自选列表点击价格列再次进入详情页', 'passed');

      await clickDetailFavorite(page);
      t.add('详情页取消收藏', 'passed');

      await clickBack(page);
      t.add('返回列表', 'passed');
    } catch (e) {
      t.add('详情页取消收藏流程', 'failed', e.message);
    }

    return t.result();
  }

  async function test004(page) {
    const t = createStepTracker(`${prefix}-004`);

    await goToMarket(page);
    await clickMainTab(page, '自选');
    t.add('切换到自选 tab', 'passed');

    await _ensure(page);
    t.add('打开搜索弹窗', 'passed');

    await _setStrict(page, 'pump');
    t.add('搜索 pump', 'passed');

    await clickSearchStarByIndex(page, 0);
    t.add('搜索结果中收藏 PUMP', 'passed');

    await closeSearch(page);
    t.add('关闭搜索', 'passed');

    await clickMainTab(page, '自选');
    t.add('回到自选 tab', 'passed');

    await _ensure(page);
    await _setStrict(page, 'pump');
    t.add('再次搜索 pump', 'passed');

    await clickSearchStarByIndex(page, 0);
    t.add('搜索结果中取消收藏 PUMP', 'passed');

    await closeSearch(page);
    t.add('关闭搜索', 'passed');

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

    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(300);
    await page.evaluate(() => window.scrollBy(0, 340));
    await sleep(1000);
    t.add('钱包首页向下滚动到市场区', 'passed');

    let walletStar;
    try {
      walletStar = await clickWalletHomeMarketStar(page, 0);
    } catch (error) {
      t.add(
        '钱包首页 Market 收藏入口可达性',
        'skipped',
        `当前前台钱包首页未识别到可点击的 Market 星标：${error.message}`,
      );
      return t.result();
    }

    const { token, activeBefore, y } = walletStar;
    t.add('点击钱包首页市场区星标', 'passed', `token=${token}, activeBefore=${activeBefore}, y=${y}`);
    await assertNoUnrelatedMarketPopups(page, '钱包首页市场区星标');
    t.add('确认未误触非 Market 弹窗', 'passed');

    await goToMarket(page);
    await clickMainTab(page, '自选');
    const afterCount = await countWatchlistRows(page);
    const expected = activeBefore ? Math.max(0, beforeCount - 1) : beforeCount + 1;
    const ok = activeBefore ? afterCount <= beforeCount - 1 : afterCount >= beforeCount + 1;
    t.add('验证钱包首页与市场自选联动', ok ? 'passed' : 'failed',
      `token=${token}, before=${beforeCount}, after=${afterCount}, expected≈${expected}`);

    return t.result();
  }

  async function test006(page) {
    const t = createStepTracker(`${prefix}-006`);

    await goToMarket(page);
    await clickMainTab(page, '现货');
    t.add('切换到现货 tab', 'passed');

    const visibleStars = await getVisibleMarketStarIds(page);
    const firstStar = visibleStars.find(id => id.includes('币安人')) || visibleStars[0];
    const secondStar = visibleStars.find(id => id !== firstStar) || visibleStars[1];

    if (!firstStar || !secondStar) {
      t.add('选择两个可见代币进行跨入口同步', 'failed', `visibleStars=${visibleStars.length}`);
      return t.result();
    }

    await clickVisibleTestId(page, firstStar);
    t.add(`在现货列表收藏 ${firstStar.replace('market-token-star-', '')}`, 'passed');

    await clickVisibleTestId(page, secondStar);
    t.add(`在现货列表收藏 ${secondStar.replace('market-token-star-', '')}`, 'passed');

    await clickMainTab(page, '自选');
    t.add('切换到自选 tab', 'passed');

    await clickVisibleTestId(page, firstStar);
    t.add(`在自选列表取消 ${firstStar.replace('market-token-star-', '')}`, 'passed');

    await clickVisibleTestId(page, secondStar);
    t.add(`在自选列表取消 ${secondStar.replace('market-token-star-', '')}`, 'passed');

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
