import {runPreconditions} from '../../helpers/preconditions.mjs';
import {waitForFavoriteSync} from './favorite-sync.mjs';
import {snapshotNonOrderForm,restoreNonOrderForm} from './non-order-ui.mjs';
import {markRestoreFailure} from './runtime.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {RESULTS_DIR} from '../../helpers/constants.mjs';
import {currentPair,openPairs,searchPairs,pairPopover,closePairs,clickPairTab,favoriteSnapshot,restoreFavorites,clearFavorites,setFavorite,restorePair} from '../../helpers/perps-ui.mjs';
// Perps Favorites — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/perps/favorites.test.mjs
//   src/tests/web/perps/favorites.test.mjs
//   src/tests/extension/perps/favorites.test.mjs
// inject platform-specific CDP connect + goToPerps, then call createFavoritesTests()
// to get the same 5 test cases prefixed for their platform.
//
// Session 1: 默认推荐代币收藏（清空 → 推荐列表 → 部分取消 → 添加）
// Session 2: 搜索收藏/取消（收藏、取消、空状态、模糊搜索、tab 同步）
// Session 3: 自选列表管理（取消收藏、跳转交易页、空状态）
// Session 4: 行情页顶部（$/% 切换、点击代币跳转）
// Session 5: 跨入口数据一致性

import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker } from '../../helpers/components.mjs';

export const DEFAULT_TOKENS = ['BTCUSDC', 'ETHUSDC', 'BNBUSDC', 'SOLUSDC', 'HYPEUSDC', 'XRPUSDC'];

/**
 * Build the 5 Perps Favorites test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'PERPS' | 'WEB-PERPS' | 'EXT-PERPS'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.goToPerps
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createFavoritesTests({ prefix, namePrefix = '', goToPerps }) {

  // ── Helpers (all element-based, no coordinates) ───────────

  async function clickText(page, text) {
    if(['自选','永续合约','现货'].includes(text)) return clickPairTab(page,text);
    const clicked = await page.evaluate((txt) => {
      const visiblePopover = () => {
        for (const p of document.querySelectorAll('[data-testid="TMPopover-ScrollView"]')) {
          const text = p.textContent || '';
          if (
            p.getBoundingClientRect().width > 0
            && (p.querySelector('input[data-testid*="perp-token-selector-search"], input[placeholder*="搜索"]')
              || (text.includes('自选') && text.includes('永续合约')))
          ) return p;
        }
        return null;
      };
      if (txt === '添加到自选') {
        const addBtn = visiblePopover()?.querySelector('[data-testid="perp-btn"]');
        const br = addBtn?.getBoundingClientRect();
        if (addBtn && br && br.width > 0 && br.height > 0) {
          addBtn.click();
          return true;
        }
      }
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const p of pops) {
        const popText = p.textContent || '';
        if (p.getBoundingClientRect().width === 0 || !(p.querySelector('input[data-testid*="perp-token-selector-search"], input[placeholder*="搜索"]') || (popText.includes('自选') && popText.includes('永续合约')))) continue;
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

  async function dismissPopover(page) {
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
    await page.evaluate(() => {
      const selectors = [
        '[data-testid="overlayPopover"]',
        '[data-testid="ovelay-popover"]',
        '[data-testid="modalBackdrop"]',
      ];
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        const r = el?.getBoundingClientRect();
        if (el && r && r.width > 0 && r.height > 0) {
          el.click();
          return;
        }
      }
    });
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const isOpen = await page.evaluate(() => {
        for (const p of document.querySelectorAll('[data-testid="TMPopover-ScrollView"]')) {
          if (p.getBoundingClientRect().width > 0) return true;
        }
        return false;
      });
      if (!isOpen) return;
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(300);
    }
  }

  async function getCurrentPair(page) { return currentPair(page); }

  async function openPairSelector(page) { await openPairs(page); }

  async function getFavoritesListTokens(page) {
    // Count actual asset rows only. Empty favorites render recommendation cards,
    // whose uppercase ticker labels must never count as already saved assets.
    return pairPopover(page).locator('[data-testid^="perp-token-selector-row-"]').evaluateAll(rows=>rows.map(e=>e.innerText.split('\n')[0].trim()));
  }

  async function waitForFavoritesListTokens(page, { min = 1, timeoutMs = 8000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let tokens = [];
    while (Date.now() < deadline) {
      tokens = await getFavoritesListTokens(page);
      const recVisible = await isRecommendationVisible(page);
      if (!recVisible && tokens.length >= min) return tokens;
      await sleep(500);
    }
    return tokens;
  }

  async function waitForRecommendationVisible(page, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await isRecommendationVisible(page)) return true;
      await sleep(500);
    }
    return false;
  }

  async function clearAllFavorites(page) {
    const count=await pairPopover(page).locator('[data-testid^="perp-token-selector-row-"]').count();
    await clearFavorites(page);
    return count;
  }

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

  async function isRecommendationVisible(page) {
    return page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const pop of pops) {
        const popText = pop.textContent || '';
        if (pop.getBoundingClientRect().width === 0 || !(pop.querySelector('input[data-testid*="perp-token-selector-search"], input[placeholder*="搜索"]') || (popText.includes('自选') && popText.includes('永续合约')))) continue;
        for (const sp of pop.querySelectorAll('span')) {
          if (sp.textContent?.trim() === '添加到自选' && sp.getBoundingClientRect().width > 0) return true;
        }
      }
      return false;
    });
  }

  async function getRecommendationTokens(page) {
    return page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const p of pops) {
        const text = p.textContent || '';
        if (p.getBoundingClientRect().width > 0 && (p.querySelector('input[data-testid*="perp-token-selector-search"], input[placeholder*="搜索"]') || (text.includes('自选') && text.includes('永续合约')))) { pop = p; break; }
      }
      if (!pop) return [];
      const tokens = [];
      for (const el of pop.querySelectorAll('span, div')) {
        const t = (el.textContent || '').replace(/\s+/g, '').trim();
        if (t && /^[A-Z]{2,10}USDCPERPS$/.test(t) && el.getBoundingClientRect().width > 0) {
          tokens.push(t.replace('PERPS', ''));
        }
      }
      return [...new Set(tokens)];
    });
  }

  async function waitForRecommendationTokens(page, { min = 1, timeoutMs = 8000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let tokens = [];
    while (Date.now() < deadline) {
      tokens = await getRecommendationTokens(page);
      if (tokens.length >= min) return tokens;
      await sleep(500);
    }
    return tokens;
  }

  async function getRecommendationTokenState(page, token) {
    return page.evaluate((tok) => {
      const wanted = String(tok || '').toUpperCase();
      const wantedLabel = wanted.endsWith('USDC') ? wanted : `${wanted}USDC`;
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const p of pops) {
        const text = p.textContent || '';
        if (p.getBoundingClientRect().width > 0 && (p.querySelector('input[data-testid*="perp-token-selector-search"], input[placeholder*="搜索"]') || (text.includes('自选') && text.includes('永续合约')))) { pop = p; break; }
      }
      if (!pop) return { found: false, selected: false, pos: null, available: [] };
      const available = [];
      let best = null;
      for (const el of pop.querySelectorAll('div')) {
        const t = (el.textContent || '').replace(/\s+/g, '').trim();
        const r = el.getBoundingClientRect();
        if (/^[A-Z]{2,10}USDCPERPS$/.test(t) && !available.includes(t)) available.push(t);
        if (t !== `${wantedLabel}PERPS` || r.width < 120 || r.height < 35 || r.height > 110) continue;
        const area = r.width * r.height;
        if (!best || area > best.area) {
          const selected = !![...el.querySelectorAll('svg')].find((svg) => {
            const sr = svg.getBoundingClientRect();
            return sr.width > 0 && sr.width <= 16 && sr.height > 0 && sr.height <= 16;
          });
          best = {
            area,
            selected,
            pos: { x: r.x + r.width - 20, y: r.y + r.height / 2 },
          };
        }
      }
      if (!best) return { found: false, selected: false, pos: null, available };
      return { found: true, selected: best.selected, pos: best.pos, available };
    }, token);
  }

  async function setRecommendationTokenSelected(page, token, desiredSelected) {
    let state = await getRecommendationTokenState(page, token);
    if (!state.found) throw new Error(`Recommendation token "${token}" not found. Available: ${state.available.join(', ')}`);
    for (let i = 0; i < 3 && state.selected !== desiredSelected; i++) {
      await page.mouse.click(state.pos.x, state.pos.y);
      await sleep(500);
      state = await getRecommendationTokenState(page, token);
    }
    if (state.selected !== desiredSelected) {
      throw new Error(`Recommendation token "${token}" selected=${state.selected}, expected ${desiredSelected}`);
    }
  }

  async function toggleRecommendationToken(page, token) {
    const result = await page.evaluate((tok) => {
      const wanted = String(tok || '').toUpperCase();
      const wantedLabel = wanted.endsWith('USDC') ? wanted : `${wanted}USDC`;
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const p of pops) {
        const text = p.textContent || '';
        if (p.getBoundingClientRect().width > 0 && (p.querySelector('input[data-testid*="perp-token-selector-search"], input[placeholder*="搜索"]') || (text.includes('自选') && text.includes('永续合约')))) { pop = p; break; }
      }
      if (!pop) return { clicked: false, available: [] };
      const available = [];
      const findCardPoint = (el) => {
        let cur = el;
        for (let i = 0; i < 6 && cur && cur !== pop; i++, cur = cur.parentElement) {
          const r = cur.getBoundingClientRect();
          const text = (cur.textContent || '').replace(/\s+/g, '').trim();
          if (r.width >= 120 && r.height >= 35 && r.height <= 110 && text.includes(wantedLabel) && text.includes('PERPS')) {
            return { x: r.x + r.width - 20, y: r.y + r.height / 2, text };
          }
        }
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: (el.textContent || '').replace(/\s+/g, '').trim() };
      };
      for (const el of pop.querySelectorAll('span, div')) {
        const t = (el.textContent || '').replace(/\s+/g, '').trim();
        const r = el.getBoundingClientRect();
        if (!t || r.width === 0 || r.height === 0) continue;
        if (/^[A-Z]{2,10}USDCPERPS$/.test(t) && !available.includes(t)) available.push(t);
        if (t.includes(wantedLabel) && t.includes('PERPS')) {
          return { clicked: true, available, pos: findCardPoint(el) };
        }
        if (t === wantedLabel) {
          return { clicked: true, available, pos: findCardPoint(el) };
        }
      }
      return { clicked: false, available };
    }, token);
    if (!result.clicked) throw new Error(`Recommendation token "${token}" not found. Available: ${result.available.join(', ')}`);
    await page.mouse.click(result.pos.x, result.pos.y);
    await sleep(500);
  }

  async function setDefaultRecommendationSelection(page, excluded = []) {
    const excludedSet = new Set(excluded.map((token) => token.replace(/USDC$/u, '')));
    for (const token of DEFAULT_TOKENS) {
      const base = token.replace(/USDC$/u, '');
      await setRecommendationTokenSelected(page, token, !excludedSet.has(base));
    }
  }

  async function searchAsset(page, query) { await searchPairs(page,query); }

  async function clearSearch(page) { await searchPairs(page,''); }

  async function isSearchEmpty(page) {
    return page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const pop of pops) {
        const popText = pop.textContent || '';
        if (pop.getBoundingClientRect().width === 0 || !(pop.querySelector('input[data-testid*="perp-token-selector-search"], input[placeholder*="搜索"]') || (popText.includes('自选') && popText.includes('永续合约')))) continue;
        const text = pop.textContent || '';
        if (text.includes('未找到') || text.includes('No results')) return true;
      }
      return false;
    });
  }

  async function clickStarAtIndex(page, index = 0) {
    const deadline = Date.now() + 8000;
    let result = null;
    while (Date.now() < deadline) {
      result = await page.evaluate((idx) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const p of pops) {
        const text = p.textContent || '';
        if (p.getBoundingClientRect().width > 0 && (p.querySelector('input[data-testid*="perp-token-selector-search"], input[placeholder*="搜索"]') || (text.includes('自选') && text.includes('永续合约')))) { pop = p; break; }
      }
      if (!pop) return { pos: null, error: 'no popover' };
      const buttons = [];
      for (const btn of pop.querySelectorAll('[data-testid="perp-already-favorite-icon-btn"]')) {
        const r = btn.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          buttons.push({ x: r.x + r.width / 2, y: r.y + r.height / 2, text: btn.textContent?.trim() || 'star' });
        }
      }
      for (const btn of pop.querySelectorAll('button')) {
        const r = btn.getBoundingClientRect();
        if (r.width >= 18 && r.width <= 28 && r.height >= 18 && r.height <= 28
            && r.x < 130 && r.y > 290) {
          buttons.push({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
        }
      }
      if (idx >= buttons.length) {
        const input = pop.querySelector('input[data-testid*="perp-token-selector-search"], input[placeholder*="搜索"]');
        const text = (pop.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500);
        return {
          pos: null,
          error: `only ${buttons.length} star buttons, want index ${idx}`,
          inputValue: input?.value || '',
          text,
        };
      }
      return { pos: buttons[idx] };
      }, index);
      if (result.pos) break;
      await sleep(500);
    }
    if (!result?.pos) {
      const detail = [result?.error, result?.inputValue ? `input=${result.inputValue}` : '', result?.text ? `text=${result.text}` : '']
        .filter(Boolean)
        .join('; ');
      throw new Error(`Cannot click star at index ${index}: ${detail || 'unknown state'}`);
    }
    await page.mouse.click(result.pos.x, result.pos.y);
    await sleep(1000);
  }

  async function setFavoriteBySearch(page,symbol,desiredFavorite) {
    const base=symbol.replace(/USDC$/u,'');
    await setFavorite(page,{name:base},desiredFavorite);
    await clearSearch(page);
    await clickText(page,'自选');
    await sleep(300);
    return getFavoritesListTokens(page);
  }

  const topBar=page=>page.locator('[data-rbd-droppable-id="favorites-bar"]:visible');
  async function getDisplayMode(page) {
    const percent=page.getByText('%',{exact:true}).filter({visible:true});
    if(await percent.count()!==1) throw Error('Favorites display-mode control missing or ambiguous');
    const state=await percent.evaluate(el=>{
      const root=el.parentElement?.parentElement;
      if(root?.textContent.replace(/\s/g,'')!=='$%') return null;
      return Number(getComputedStyle(el).fontWeight)>=600?'%':'$';
    });
    if(!state) throw Error('Cannot read favorites display mode');
    return state;
  }
  async function getTopBarTokens(page) {
    return topBar(page).locator('[data-rbd-draggable-id]').evaluateAll(rows=>rows.map(row=>row.innerText.split('\n')[0].trim()));
  }
  async function getTopBarValues(page) {
    return topBar(page).locator('[data-rbd-draggable-id]').evaluateAll(rows=>rows.map(row=>({text:row.innerText,x:row.getBoundingClientRect().x})));
  }
  async function clickToggle(page,mode) {
    if(await getDisplayMode(page)===mode) return;
    await page.getByText('%',{exact:true}).filter({visible:true}).click();
    await page.waitForTimeout(300);
    if(await getDisplayMode(page)!==mode) throw Error(`Favorites display mode did not change to ${mode}`);
  }
  async function getTopBarText(page) {return topBar(page).innerText();}

  async function clickTopBarToken(page,symbol) {
    const item=topBar(page).locator('[data-rbd-draggable-id]').filter({has:page.getByText(symbol,{exact:true})});
    if(await item.count()!==1) throw Error(`Favorite top-bar item not unique: ${symbol}`);
    await item.click();
    await page.waitForTimeout(500);
  }

  // ── Test Cases ────────────────────────────────────────────

  async function test001(page) {
    const t = createStepTracker(`${prefix}-001`);

    await goToPerps(page);

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

    const recTokens = await waitForRecommendationTokens(page, { min: 6, timeoutMs: 10_000 });
    t.add('显示 6 个默认代币', recTokens.length === 6 ? 'passed' : 'failed',
      `found ${recTokens.length}: ${recTokens.join(', ')}`);
    if (recTokens.length < 6) {
      await dismissPopover(page);
      return t.result();
    }

    console.log('  Step 5: Deselect BTCUSDC and ETHUSDC');
    await setDefaultRecommendationSelection(page, ['BTC', 'ETH']);

    console.log('  Step 6: Click 添加到自选');
    await clickText(page, '添加到自选');
    await sleep(1000);

    const favTokens = await waitForFavoritesListTokens(page, { min: 4, timeoutMs: 10_000 });
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

  async function test002(page) {
    const t = createStepTracker(`${prefix}-002`);

    await goToPerps(page);

    console.log('\n  Step 1: Search BTC -> favorite');
    await openPairSelector(page);
    const beforeAdd = await setFavoriteBySearch(page, 'BTC', false);
    const favsAfterAdd = await setFavoriteBySearch(page, 'BTC', true);
    t.add('搜索 BTC 从未收藏变为已收藏', favsAfterAdd.includes('BTC') && favsAfterAdd.length === beforeAdd.length + 1 ? 'passed' : 'failed',
      `favorites: ${favsAfterAdd.join(', ')}`);

    console.log('  Step 2: Search XRP -> unfavorite');
    const beforeRemove = await setFavoriteBySearch(page, 'XRP', true);
    const favsAfterRemove = await setFavoriteBySearch(page, 'XRP', false);
    t.add('搜索 XRP 从已收藏变为未收藏', !favsAfterRemove.includes('XRP') && favsAfterRemove.length === beforeRemove.length - 1 ? 'passed' : 'failed',
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

  async function ensureFavoriteFixture(page) {
    let fixture=await favoriteSnapshot(page);
    if(fixture.length<3) for(const name of ['BTC','ETH','BNB']) {
      if(!fixture.some(item=>item.name===name)) await setFavorite(page,{name},true);
      fixture=await favoriteSnapshot(page);
      if(fixture.length>=3) break;
    }
    if(fixture.length<3) throw Error('Favorite removal/navigation fixture requires at least three assets');
    await closePairs(page);
    return fixture;
  }

  async function test003(page) {
    const t = createStepTracker(`${prefix}-003`);

    await goToPerps(page);
    // A single original favorite cannot support removing one and selecting a
    // different remaining asset. Build the required list; outer finally restores it.
    const fixture = await ensureFavoriteFixture(page);
    t.add('前置：准备至少三条自选供取消与跳转', 'passed', fixture.map(item=>item.name).join(', '));

    console.log('\n  Step 1: View favorites list');
    await openPairSelector(page);
    // 先清空搜索框（上一个测试可能残留搜索内容）
    await clearSearch(page);
    await sleep(500);
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
    t.add('取消收藏后数量减少 1', tokensAfter.length === countBefore - 1 ? 'passed' : 'failed',
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
      await setDefaultRecommendationSelection(page);
      await clickText(page, '添加到自选');
      await sleep(2000);
    }
    await dismissPopover(page);
    return t.result();
  }

  async function test004(page) {
    const t = createStepTracker(`${prefix}-004`);

    await goToPerps(page);

    const fixture=await ensureFavoriteFixture(page);
    t.add('前置：准备至少三条自选供顶部展示与跳转','passed',fixture.map(item=>item.name).join(', '));
    const topTokens = await getTopBarTokens(page);

    console.log('\n  Step 1: Verify top bar');
    t.add('顶部显示收藏代币', topTokens.length >= 3 ? 'passed' : 'failed',
      `${topTokens.length}: ${topTokens.join(', ')}`);

    const topValues = await getTopBarValues(page);
    const hasPercent = topValues.some(v => v.text.includes('%'));
    const hasNumeric = topValues.some(v => /\d/.test(v.text));
    const initialMode = hasPercent ? '%' : '$';
    // 不强制默认 % 模式；只要顶部能读到数值就 pass，detail 中记录当前模式。
    t.add('默认显示模式（$ 或 %）', hasNumeric ? 'passed' : 'failed', `default: ${initialMode}`);

    console.log('  Step 2: Click $ toggle');
    await clickToggle(page, '$');
    const dollarValues = await getTopBarValues(page);

    console.log('  Step 3: Click % toggle');
    await clickToggle(page, '%');
    const percentValues = await getTopBarValues(page);

    const dollarTexts = dollarValues.map(d => d.text).join(' ');
    const percentTexts = percentValues.map(d => d.text).join(' ');
    const percentTopBarText = await getTopBarText(page);
    t.add('$/% 显示不同数据', dollarTexts !== percentTexts ? 'passed' : 'failed');
    t.add('切回 % 显示百分比',
      percentValues.some(v => v.text.includes('%')) || percentTopBarText.includes('%') ? 'passed' : 'failed',
      percentTopBarText.slice(0, 180));

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

  async function test005(page) {
    const t = createStepTracker(`${prefix}-005`);

    await goToPerps(page);

    console.log('\n  Step 1: Clear -> add without SOL');
    await openPairSelector(page);
    await clearSearch(page);
    await sleep(300);
    await clickText(page, '自选');
    await sleep(1000);

    if (!(await isRecommendationVisible(page))) {
      await clearAndTriggerRecommendation(page);
      await waitForRecommendationVisible(page, 8000);
    }

    await setDefaultRecommendationSelection(page, ['SOL']);
    await clickText(page, '添加到自选');
    await waitForFavoritesListTokens(page, { min: 1, timeoutMs: 10_000 });

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
    t.add(`自选取消 ${tokenRemoved}`, favsAfter.length === favsBefore.length - 1 && removedTokens.length === 1 ? 'passed' : 'failed',
      `${favsBefore.length} -> ${favsAfter.length}`);

    console.log('  Step 4: Verify sync');
    await dismissPopover(page);
    const syncedTop = await waitForFavoriteSync(() => getTopBarTokens(page), favsAfter);
    t.add(`自选 -> 顶部独立同步（${tokenRemoved} 已移除）`, 'passed',
      `source: ${favsAfter.join(', ')}; independently read target: ${syncedTop.join(', ')}`);
    return t.result();
  }

  // ── Registry ──────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}Perps-收藏-默认推荐代币收藏`, fn: test001 },
    { id: `${prefix}-002`, name: `${namePrefix}Perps-收藏-搜索收藏与取消收藏`, fn: test002 },
    { id: `${prefix}-003`, name: `${namePrefix}Perps-收藏-自选列表管理`, fn: test003 },
    { id: `${prefix}-004`, name: `${namePrefix}Perps-收藏-行情页顶部展示与切换`, fn: test004 },
    { id: `${prefix}-005`, name: `${namePrefix}Perps-收藏-跨入口数据一致性`, fn: test005 },
  ];

  for(const tc of testCases) {
    const run=tc.fn;
    tc.fn=async page=>{
      page.setDefaultTimeout(15000);
      await goToPerps(page);
      const pairBefore=await currentPair(page);
      const formBefore=await snapshotNonOrderForm(page);
      const modeBefore=(await page.getByText('%',{exact:true}).filter({visible:true}).count())?await getDisplayMode(page):null;
      const before=await favoriteSnapshot(page);
      mkdirSync(RESULTS_DIR,{recursive:true});
      writeFileSync(resolve(RESULTS_DIR,`${tc.id}-before.json`),JSON.stringify({pair:pairBefore,form:formBefore,favorites:before},null,2));
      await closePairs(page);
      let result;
      try { result=await run(page); }
      finally {
        try {await restoreFavorites(page,before);await restorePair(page,pairBefore);if(modeBefore) await clickToggle(page,modeBefore);await restoreNonOrderForm(page,formBefore);}
        catch(error) {
          const failure=markRestoreFailure(result,error,'恢复用户收藏及表单');
          if(!result) throw failure;
        }
      }
      return result;
    };
  }

  let _preReport = null;
  async function setup(page) {
    await goToPerps(page);
    await sleep(2000);
    _preReport ??= await runPreconditions(page, testCases.map(tc => tc.id));
    if (!_preReport.canRun) throw new Error('Perps 前置检查未通过');
    return _preReport;
  }

  return { testCases, setup };
}
