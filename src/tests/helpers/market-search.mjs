// Shared Market Search helpers — reusable across Desktop & Web platforms
// Extracted from desktop/market/search.test.mjs
//
// Platform-specific concerns (CDP connection, navigation, search trigger)
// are injected via parameters; all search-modal logic is shared.

import { sleep } from './constants.mjs';
import {
  isModalVisible,
  openSearchModal as _openSearchModal,
  getSearchInput,
} from './components.mjs';

// ── Step Tracker ─────────────────────────────────────────────

export { createStepTracker, safeStep } from './components.mjs';

// ── Search Modal Primitives ──────────────────────────────────

export async function isSearchModalOpen(page) {
  return isModalVisible(page);
}

export function getModalSearchInput(page) {
  return page.locator('[data-testid="APP-Modal-Screen"] input[data-testid="nav-header-search"]').first();
}

/**
 * Open the search modal if not already open.
 * @param {import('playwright-core').Page} page
 * @param {(page: import('playwright-core').Page) => Promise<void>} [triggerFn]
 *   Platform-specific function that clicks the search trigger element.
 *   When omitted, delegates to components.mjs openSearchModal (registry-based).
 */
export async function openSearchModal(page, triggerFn) {
  if (!triggerFn) {
    return _openSearchModal(page);
  }
  await page.bringToFront().catch(() => {});
  if (await isSearchModalOpen(page)) return;
  await triggerFn(page);
  await sleep(800);
  if (!(await isSearchModalOpen(page))) {
    await triggerFn(page);
    await sleep(1000);
  }
}

// ── Input Helpers ────────────────────────────────────────────

export async function setSearchValueStrict(page, value, triggerFn) {
  await openSearchModal(page, triggerFn);

  const modalInput = getModalSearchInput(page);
  await modalInput.click();
  await sleep(200);

  // Clear existing content via select() + Backspace
  await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    const input = modal?.querySelector('input');
    if (input) { input.focus(); input.select(); }
  });
  await page.keyboard.press('Backspace');
  await sleep(300);

  if (value) {
    try {
      await modalInput.pressSequentially(value, { delay: 40 });
    } catch {
      await modalInput.type(value, { delay: 40 });
    }
  }
  await sleep(1500);
}

export async function ensureSearchOpen(page, triggerFn) {
  await openSearchModal(page, triggerFn);
  const modalInput = getModalSearchInput(page);
  await modalInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
}

export async function setSearchValue(page, value, triggerFn) {
  await ensureSearchOpen(page, triggerFn);
  await setSearchValueStrict(page, value, triggerFn);
}

// Delegate to registry-based implementations in components.mjs
export { clearSearch, closeSearch } from './components.mjs';

// ── Assertion Helpers ────────────────────────────────────────

export async function assertHasSomeTableLikeContent(page) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const ok = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const root = modal || document.body;
      const text = root.textContent || '';
      const hasEmpty = text.includes('未找到') || text.includes('No results') || text.includes('暂无')
        || text.includes('not found') || text.includes('无结果') || text.includes('没有找到');
      const hasAnyRowLike = (() => {
        if (/0x[a-fA-F0-9]{4,6}\.\.\.[a-fA-F0-9]{3,4}/.test(text)) return true;
        const moneyMarks = (text.match(/\$/g) || []).length;
        if (moneyMarks >= 2) return true;
        if (text.includes('全部') && text.includes('市场') && text.length > 20) return true;
        return false;
      })();
      return hasEmpty || hasAnyRowLike;
    });
    if (ok) return;
    await sleep(500);
  }
  throw new Error('No visible results/empty state detected');
}

// ── Scroll & Interaction Helpers ─────────────────────────────

export async function clickShowMoreIfPresent(page) {
  const btn = page.locator('[data-testid="APP-Modal-Screen"] >> text="显示更多"').first();
  const visible = await btn.isVisible({ timeout: 800 }).catch(() => false);
  if (!visible) return false;
  await btn.click();
  await sleep(1200);
  return true;
}

export async function scrollToBottomAndAssert(page, opts = {}, triggerFn) {
  const maxRounds = opts.maxRounds ?? 30;
  const roundWaitMs = opts.roundWaitMs ?? 250;

  if (triggerFn) await ensureSearchOpen(page, triggerFn);

  for (let round = 0; round < maxRounds; round++) {
    const info = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const candidates = [];
      const root = modal || document.body;
      const all = root.querySelectorAll('*');
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width < 300 || r.height < 200) continue;
        const style = window.getComputedStyle(el);
        if (!['auto', 'scroll'].includes(style.overflowY)) continue;
        if (el.scrollHeight <= el.clientHeight + 20) continue;
        candidates.push(el);
      }
      const target = candidates[0] || null;
      if (!target) {
        const de = document.documentElement;
        return {
          type: 'document',
          scrollTop: de.scrollTop,
          clientHeight: de.clientHeight,
          scrollHeight: de.scrollHeight,
        };
      }
      return {
        type: 'element',
        scrollTop: target.scrollTop,
        clientHeight: target.clientHeight,
        scrollHeight: target.scrollHeight,
      };
    });

    const atBottom = (info.scrollTop + info.clientHeight) >= (info.scrollHeight - 6);
    if (atBottom) return true;

    await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const root = modal || document.body;
      const all = root.querySelectorAll('*');
      let target = null;
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width < 300 || r.height < 200) continue;
        const style = window.getComputedStyle(el);
        if (!['auto', 'scroll'].includes(style.overflowY)) continue;
        if (el.scrollHeight <= el.clientHeight + 20) continue;
        target = el;
        break;
      }
      if (!target) {
        window.scrollBy(0, Math.max(200, window.innerHeight * 0.7));
        return;
      }
      target.scrollTop = target.scrollTop + Math.max(200, target.clientHeight * 0.8);
    });

    await sleep(roundWaitMs);
  }
  throw new Error('Failed to reach bottom within max scroll rounds');
}

/**
 * Check if the "最近搜索" (Recent Searches) section exists in the search modal.
 * Returns the list of history keywords found.
 */
export async function getSearchHistory(page) {
  // Retry a few times — modal content loads async
  for (let i = 0; i < 6; i++) {
    const result = await _getSearchHistoryOnce(page);
    if (result.hasHistory) return result;
    await sleep(500);
  }
  return _getSearchHistoryOnce(page);
}

async function _getSearchHistoryOnce(page) {
  return page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return { hasHistory: false, keywords: [] };
    const text = modal.textContent || '';
    const hasSection = text.includes('最近搜索') || text.includes('Recent');
    if (!hasSection) return { hasHistory: false, keywords: [] };

    // Find the "最近搜索" span, then collect keyword tags between it and "热门"
    let recentY = 0;
    let trendingY = 9999;
    modal.querySelectorAll('span, div').forEach(el => {
      const t = el.textContent?.trim();
      const r = el.getBoundingClientRect();
      if (t === '最近搜索' && r.width > 0 && el.children.length === 0) recentY = r.bottom;
      if (t === '热门' && r.width > 0 && el.children.length === 0 && r.y > recentY) trendingY = Math.min(trendingY, r.y);
    });

    const keywords = [];
    if (recentY > 0) {
      modal.querySelectorAll('span, div').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.y > recentY && r.y < trendingY && r.height > 10 && r.height < 36 && r.width > 20 && r.width < 200 && el.children.length <= 1) {
          const t = el.textContent?.trim();
          if (t && t.length > 0 && t.length < 25 && t !== '最近搜索' && t !== '热门') {
            if (!keywords.includes(t)) keywords.push(t);
          }
        }
      });
    }

    return { hasHistory: true, keywords };
  });
}

/**
 * Click a result row in the search modal to add it to search history.
 * Searches for the given keyword first, then clicks the first result.
 */
export async function clickSearchResult(page, triggerFn, keyword) {
  await setSearchValueStrict(page, keyword, triggerFn);
  await assertHasSomeTableLikeContent(page);

  // Click the first result row that contains the keyword and a price
  const clicked = await page.evaluate((kw) => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;
    const rows = modal.querySelectorAll('div');
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (r.width < 300 || r.height < 30 || r.height > 80 || r.y < 200) continue;
      const txt = row.textContent?.trim() || '';
      if (txt.includes(kw) && txt.includes('$')) {
        row.click();
        return true;
      }
    }
    return false;
  }, keyword);

  if (clicked) {
    await sleep(2000);
    // Close any modal/page that opened from clicking the result
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
  }
  return clicked;
}

/**
 * Click the "clear all history" button next to "最近搜索" header.
 * The button is a small icon button (SVG trash/delete) on the right side of the header row.
 */
export async function clickClearHistory(page) {
  const clicked = await page.evaluate(() => {
    const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
    if (!modal) return false;

    // Find the "最近搜索" text element
    let recentEl = null;
    modal.querySelectorAll('span').forEach(el => {
      if (el.textContent?.trim() === '最近搜索' && el.getBoundingClientRect().width > 0) {
        recentEl = el;
      }
    });
    if (!recentEl) return false;

    // Walk up to the row container, then find the button sibling
    let container = recentEl;
    for (let i = 0; i < 5; i++) {
      container = container.parentElement;
      if (!container) break;
      const btn = container.querySelector('button');
      if (btn && btn !== recentEl) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.width < 50) {
          btn.click();
          return true;
        }
      }
    }
    return false;
  });
  if (clicked) await sleep(1000);
  return clicked;
}

// Legacy aliases for backward compatibility
export async function clickFirstSuggestionIfPresent(page) {
  const item = page.locator('[data-testid="APP-Modal-Screen"] >> text="Bitcoin"').first();
  const visible = await item.isVisible({ timeout: 1200 }).catch(() => false);
  if (!visible) return false;
  await item.click();
  await sleep(1000);
  return true;
}

export const clickClearHistoryIfPresent = clickClearHistory;

export async function toggleFavoriteOnFirstRow(page) {
  const modalOpen = await isSearchModalOpen(page);

  if (modalOpen) {
    const clicked = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      const buttons = modal.querySelectorAll('button');
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width < 16 || r.width > 40 || r.height < 16 || r.height > 40) continue;
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const dataComp = btn.getAttribute('data-sentry-component') || '';
        if (dataComp.includes('Star') || ariaLabel.includes('star') || ariaLabel.includes('收藏')) {
          btn.click();
          return true;
        }
      }
      const modalRect = modal.getBoundingClientRect();
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        if (r.width < 16 || r.width > 40 || r.height < 16 || r.height > 40) continue;
        if (r.y > modalRect.y + 120 && r.y < modalRect.y + 200) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      await sleep(1000);
      return;
    }
  }

  if (modalOpen) await closeSearch(page);
  const starBtn = page.locator('[data-testid="list-column-star"] button:visible').first();
  const canClick = await starBtn.isVisible({ timeout: 1500 }).catch(() => false);
  if (canClick) {
    await starBtn.click();
    await sleep(1000);
    return;
  }
  throw new Error('Cannot find favorite toggle on first row');
}

export async function snapshotWatchlistCount(page) {
  // Switch to "自选" (Watchlist/Favorites) tab first, then count visible rows
  await page.evaluate(() => {
    // Find 自选 tab — could be a button, span, or div
    const candidates = document.querySelectorAll('button, span, [role="tab"]');
    for (const el of candidates) {
      const txt = el.textContent?.trim();
      const r = el.getBoundingClientRect();
      if (txt === '自选' && r.width > 0 && r.height > 0 && r.y > 50 && r.y < 250) {
        el.click();
        return;
      }
    }
  });
  await sleep(1500);

  // Count rows using stable testid
  return page.evaluate(() => {
    const nameCells = document.querySelectorAll('[data-testid="list-column-name"]');
    let count = 0;
    nameCells.forEach(el => {
      const r = el.getBoundingClientRect();
      // Only count visible rows (not header)
      if (r.width > 0 && r.height > 30 && r.y > 200) count++;
    });
    return count;
  });
}
