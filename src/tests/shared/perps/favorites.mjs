import { decoratePerpsCases } from './execution-evidence.mjs';
import { assertFavoriteValues } from './favorite-quote-assertions.mjs';
import { snapshotSelectorPreferences, restoreSelectorPreferences } from './selector-preferences.mjs';
import { pollForm } from './non-order-ui.mjs';
import { waitInstrumentBoundary } from './instrument-readiness.mjs';
import {runPreconditions} from '../../helpers/preconditions.mjs';
import {waitForFavoriteSync} from './favorite-sync.mjs';
import {snapshotNonOrderForm,restoreNonOrderForm} from './non-order-ui.mjs';
import {markRestoreFailure} from './runtime.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {RESULTS_DIR} from '../../helpers/constants.mjs';
import {locator,currentPair,openPairs,searchPairs,pairPopover,closePairs,clickPairTab,favoriteSnapshot,restoreFavorites,clearFavorites,setFavorite,restorePair} from '../../helpers/perps-ui.mjs';
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
    const expected = text === '添加到自选' ? (await Promise.all(DEFAULT_TOKENS.map(async token => ({token,state:await getRecommendationTokenState(page,token)}))))
      .filter(item=>item.state.found && item.state.selected).map(item=>item.token.replace(/USDC$/u,'')) : null;
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
    if(expected) await waitForFavoriteSync(() => getFavoritesListTokens(page), expected);
  }

  async function dismissPopover(page) { await closePairs(page); }

  async function getCurrentPair(page) { return currentPair(page); }

  async function openPairSelector(page) { await openPairs(page); }

  async function getFavoritesListTokens(page) {
    // Count actual asset rows only. Empty favorites render recommendation cards,
    // whose uppercase ticker labels must never count as already saved assets.
    return pairPopover(page).locator('[data-testid^="perp-token-selector-row-"]').evaluateAll(rows=>rows.map(e=>e.innerText.split('\n')[0].trim()));
  }

  async function waitForFavoritesListTokens(page, { min = 1, timeoutMs = 8000 } = {}) {
    const state = await pollForm(async () => ({tokens:await getFavoritesListTokens(page),recommended:await isRecommendationVisible(page)}),
      state=>!state.recommended && state.tokens.length>=min, `At least ${min} saved favorites, not recommendation cards`, timeoutMs);
    return state.tokens;
  }
  async function waitForRecommendationVisible(page, timeoutMs = 8000) {
    return pollForm(() => isRecommendationVisible(page), visible=>visible, 'Empty favorites recommendation visible',timeoutMs);
  }

  async function clearAllFavorites(page) {
    const count=await pairPopover(page).locator('[data-testid^="perp-token-selector-row-"]').count();
    await clearFavorites(page);
    return count;
  }

  async function clearAndTriggerRecommendation(page) {
    const cleared = await clearAllFavorites(page);
    await dismissPopover(page);

    await openPairSelector(page);

    await clickText(page, '自选');

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
    return pollForm(() => getRecommendationTokens(page), tokens=>tokens.length>=min, `At least ${min} recommendation cards`, timeoutMs);
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
    const state = await pollForm(() => getRecommendationTokenState(page,token), state=>state.found, `Recommendation card ${token}`);
    if(state.selected!==desiredSelected) await page.mouse.click(state.pos.x,state.pos.y);
    await pollForm(() => getRecommendationTokenState(page,token), state=>state.found && state.selected===desiredSelected,
      `Recommendation ${token} selected=${desiredSelected}`);
  }

  async function toggleRecommendationToken(page, token) {
    const state=await pollForm(() => getRecommendationTokenState(page,token), state=>state.found, `Recommendation card ${token}`);
    await setRecommendationTokenSelected(page,token,!state.selected);
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
    const rows=pairPopover(page).locator('[data-testid^="perp-token-selector-row-"]');
    const before=await rows.evaluateAll(es=>es.map(e=>({id:e.dataset.testid,name:e.innerText.split('\n')[0].trim()})));
    const item=before[index];
    if(!item) throw Error(`Favorite index ${index} unavailable in ${JSON.stringify(before)}`);
    const row=rows.and(page.getByTestId(item.id)).filter({has:page.getByText(item.name,{exact:true})});
    if(await row.count()!==1) throw Error(`Favorite target identity ambiguous: ${JSON.stringify(item)}`);
    await row.locator('[data-testid="perp-already-favorite-icon-btn"]').click();
    const key=item=>`${item.id}:${item.name}`;
    await waitForFavoriteSync(() => rows.evaluateAll(es=>es.map(e=>`${e.dataset.testid}:${e.innerText.split('\n')[0].trim()}`)),
      before.filter((_,i)=>i!==index).map(key));
    await waitForFavoriteSync(() => getTopBarTokens(page),before.filter((_,i)=>i!==index).map(item=>item.name));
  }

  async function setFavoriteBySearch(page,symbol,desiredFavorite) {
    const base=symbol.replace(/USDC$/u,'');
    await setFavorite(page,{name:base},desiredFavorite);
    await clearSearch(page);
    await clickText(page,'自选');

    const names=(await favoriteSnapshot(page)).map(item=>item.name);
    await waitForFavoriteSync(() => getTopBarTokens(page),names);
    return names;
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
  async function waitTopBarValues(page,mode) {
    return pollForm(() => getTopBarValues(page), values => {
      try {assertFavoriteValues(values,mode);return true;} catch {return false;}
    }, `Every favorite value rendered in ${mode} mode`);
  }
  async function clickToggle(page,mode) {
    if(await getDisplayMode(page)===mode) return;
    await page.getByText('%',{exact:true}).filter({visible:true}).click();
    await pollForm(() => getDisplayMode(page), value => value === mode, `Favorite mode ${mode}`);
    if(await getDisplayMode(page)!==mode) throw Error(`Favorites display mode did not change to ${mode}`);
  }
  async function getTopBarText(page) {return topBar(page).innerText();}

  async function clickTopBarToken(page,symbol) {
    const item=topBar(page).locator('[data-rbd-draggable-id]').filter({has:page.getByText(symbol,{exact:true})});
    if(await item.count()!==1) throw Error(`Favorite top-bar item not unique: ${symbol}`);
    await item.click();
    const pair=await pollForm(() => currentPair(page), value=>value===symbol || value===`${symbol}USDC`, `Favorite market ${symbol}`);
    await waitInstrumentBoundary(page,pair,locator(page,'perps.form.root'));
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


    const favTokens = await waitForFavoritesListTokens(page, { min: 4, timeoutMs: 10_000 });
    t.add('自选列表显示 4 个代币', favTokens.length === 4 ? 'passed' : 'failed',
      `found: ${favTokens.join(', ')}`);
    t.add('BTC/ETH 不在自选中',
      (!favTokens.includes('BTC') && !favTokens.includes('ETH')) ? 'passed' : 'failed');

    const topTokens = await waitForFavoriteSync(() => getTopBarTokens(page),favTokens);
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

    const isEmpty = await pollForm(() => isSearchEmpty(page), value=>value, 'Unknown token search must show empty state');
    t.add('搜索不存在代币显示空状态', isEmpty ? 'passed' : 'failed');

    console.log('  Step 4: Fuzzy search "SU"');
    await clickText(page, '永续合约');

    await searchAsset(page, 'SU');

    const fuzzyTokens = await pollForm(() => getFavoritesListTokens(page), rows=>rows.length>1 && rows.every(t=>t.toUpperCase().includes('SU')), 'Fuzzy SU results');
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

    await clickText(page, '自选');


    const initialTokens = await getFavoritesListTokens(page);
    t.add('自选列表显示代币', initialTokens.length > 0 ? 'passed' : 'failed',
      `${initialTokens.length}: ${initialTokens.join(', ')}`);

    console.log('  Step 2: Unfavorite one token');
    const countBefore = initialTokens.length;
    await clickStarAtIndex(page, 0);

    const tokensAfter = await getFavoritesListTokens(page);
    t.add('取消收藏后数量减少 1', tokensAfter.length === countBefore - 1 ? 'passed' : 'failed',
      `${countBefore} -> ${tokensAfter.length}`);

    console.log('  Step 3: Click token -> navigate');
    await dismissPopover(page);

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

    await clearAndTriggerRecommendation(page);


    const recVisible = await isRecommendationVisible(page);
    t.add('清空后显示推荐列表', recVisible ? 'passed' : 'failed');

    if (recVisible) {
      await setDefaultRecommendationSelection(page);
      await clickText(page, '添加到自选');

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
    const initialMode = await getDisplayMode(page);
    assertFavoriteValues(topValues, initialMode);
    t.add('当前保存的显示模式及每项数值格式', 'passed', `mode=${initialMode}; values=${JSON.stringify(topValues)}`);

    console.log('  Step 2: Click $ toggle');
    await clickToggle(page, '$');
    const dollarValues = await waitTopBarValues(page, '$');

    console.log('  Step 3: Click % toggle');
    await clickToggle(page, '%');
    const percentValues = await waitTopBarValues(page, '%');

    assertFavoriteValues(dollarValues, '$');
    assertFavoriteValues(percentValues, '%');
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
      const pairAfter = await pollForm(() => getCurrentPair(page), value => value === `${target2}USDC` || value === target2, `Top-bar market ${target2}`);
      await waitInstrumentBoundary(page, pairAfter, locator(page,'perps.form.root'));
      t.add('顶部点击代币跳转', pairAfter === `${target2}USDC` || pairAfter === target2 ? 'passed' : 'failed',
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

    await clickText(page, '自选');


    if (!(await isRecommendationVisible(page))) {
      await clearAndTriggerRecommendation(page);
      await waitForRecommendationVisible(page, 8000);
    }

    await setDefaultRecommendationSelection(page, ['SOL']);
    await clickText(page, '添加到自选');
    await waitForFavoritesListTokens(page, { min: 1, timeoutMs: 10_000 });

    console.log('  Step 2: Verify 永续合约 tab');
    await clickText(page, '永续合约');


    const expectedTop=DEFAULT_TOKENS.filter(t=>t!=='SOLUSDC').map(t=>t.replace(/USDC$/u,''));
    const topTokens = await waitForFavoriteSync(() => getTopBarTokens(page),expectedTop);
    t.add('推荐收藏 -> 顶部无 SOL', !topTokens.includes('SOL') ? 'passed' : 'failed',
      `top: ${topTokens.join(', ')}`);

    console.log('  Step 3: Unfavorite from 自选');
    await clickText(page, '自选');


    const favsBefore = await getFavoritesListTokens(page);
    await clickStarAtIndex(page, 0);


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
      const selectorWasOpen=await pairPopover(page).count()>0;
      const queryBefore=selectorWasOpen?await pairPopover(page).locator('input').inputValue():'';
      const selectorBefore=await snapshotSelectorPreferences(page);
      let modeBefore=(await page.getByText('%',{exact:true}).filter({visible:true}).count())?await getDisplayMode(page):null;
      let before, result;
      try {
        before=await favoriteSnapshot(page);
        mkdirSync(RESULTS_DIR,{recursive:true});
        writeFileSync(resolve(RESULTS_DIR,`${tc.id}-before.json`),JSON.stringify({pair:pairBefore,form:formBefore,favorites:before},null,2));
        await closePairs(page);
        // An empty bar hides the saved mode. Expose it before changing it, then
        // restore that mode before removing the temporary favorite in finally.
        if(tc.id.endsWith('-004') && !modeBefore) {
          await setFavorite(page,{name:'BTC'},true);
          await closePairs(page);
          await page.getByText('%',{exact:true}).filter({visible:true}).waitFor({state:'visible'});
          modeBefore=await getDisplayMode(page);
        }
        result=await run(page);
      }
      finally {
        try {
          let modeError;
          if (modeBefore) {
            try {
              if (!await page.getByText('%', { exact: true }).filter({ visible: true }).count()) {
                await setFavorite(page, { name: 'BTC' }, true);
                await closePairs(page);
              }
              await clickToggle(page, modeBefore);
            } catch (error) {
              modeError = error;
            }
          }
          if(before) await restoreFavorites(page,before);
          await restorePair(page,pairBefore);
          await restoreNonOrderForm(page,formBefore);
          await restoreSelectorPreferences(page,selectorBefore);
          await searchPairs(page,queryBefore);
          if(!selectorWasOpen) await closePairs(page);
          if (modeError) throw modeError;
        }
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
    await locator(page,'perps.form.root').waitFor({state:'visible',timeout:15000});
    _preReport ??= await runPreconditions(page, testCases.map(tc => tc.id));
    if (!_preReport.canRun) throw new Error('Perps 前置检查未通过');
    return _preReport;
  }

  return { testCases: decoratePerpsCases(testCases,{prefix}), setup };
}
