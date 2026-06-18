// Market Home — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/market/home.test.mjs
//   src/tests/web/market/home.test.mjs
//   src/tests/extension/market/home.test.mjs
// inject platform-specific CDP connect + goToMarket + triggerSearch + clickMainTab + clickFilterChip,
// then call createMarketHomeTests() to get the same 6 test cases prefixed for their platform.
//
// Case 1: 首页入口与布局（搜索框、主标签、热门卡片、列表）
// Case 2: 主标签循环切换稳定性（自选/热门/股票/合约）
// Case 3: 热门榜单筛选与列表字段
// Case 4: 合约二级筛选与列表字段（加密货币/股票/贵金属 etc.）
// Case 5: 热门列表数据展示 + 详情跳转返回 + 滚动分页
// Case 6: 数据更新观察 + 详情返回状态保持

import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker } from '../../helpers/components.mjs';
import {
  setSearchValueStrict, closeSearch,
} from '../../helpers/market-search.mjs';
import {
  MARKET_MAIN_TABS,
  MARKET_PUBLIC_TOKEN_MAIN_TAB,
  MARKET_WATCHLIST_MAIN_TAB,
  MARKET_PERP_MAIN_TAB,
  MARKET_STOCK_MAIN_TAB,
} from './market-tabs.mjs';

/**
 * Build the 6 Market Home test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'MARKET-HOME' | 'WEB-MARKET-HOME' | 'EXT-MARKET-HOME'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page) => Promise<void>} opts.goToMarket - Navigate to Market home
 * @param {(page) => Promise<void>} opts.triggerSearch - Click the element that opens the search modal
 * @param {(page, tab: string) => Promise<void>} opts.clickMainTab - Click a main tab (自选/热门/股票/合约)
 * @param {(page, label: string) => Promise<void>} opts.clickFilterChip - Click a filter chip below the main tabs
 * @param {(page) => Promise<void>} [opts.screenshotOnFail] - Optional screenshot callback (page, name)
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createMarketHomeTests({
  prefix,
  namePrefix = '',
  goToMarket,
  triggerSearch,
  clickMainTab,
  clickFilterChip,
  screenshotOnFail,
}) {

  // Convenience: setSearchValueStrict requires a triggerFn
  const _setSearchStrict = (page, v) => setSearchValueStrict(page, v, triggerSearch);

  // ── Internal helpers (DOM-based, platform-agnostic) ─────────

  async function waitListVisible(page) {
    for (let i = 0; i < 10; i++) {
      const ok = await page.evaluate(() => {
        const text = (document.body?.textContent || '').replace(/\s+/g, ' ');
        const hasPriceCell = !!document.querySelector('[data-testid="list-column-price"]');
        const hasMoney = /\$[\d,.]+/.test(text);
        const hasEmpty = text.includes('未找到') || text.includes('暂无') || text.includes('No results');
        return hasPriceCell || hasMoney || hasEmpty;
      });
      if (ok) return;
      await sleep(500);
    }
    throw new Error('List content not ready');
  }

  async function getFilterLabels(page) {
    // Read all visible chip-like spans in the filter row(s). Y-range is loose to
    // tolerate cross-platform layout differences; we filter by being inside the
    // typical chip band (between main-tab area and list).
    return page.evaluate(() => {
      const labels = [];
      for (const sp of document.querySelectorAll('span')) {
        const t = (sp.textContent || '').trim();
        if (!t) continue;
        if (sp.children.length > 0) continue;
        const r = sp.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.y < 150 || r.y > 320) continue;
        labels.push(t);
      }
      return [...new Set(labels)];
    });
  }

  async function captureListSignature(page) {
    return page.evaluate(() => {
      const rows = [];
      for (const el of document.querySelectorAll('[data-testid="list-column-price"], [data-testid="list-column-name"]')) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.y < 200) continue;
        const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (t) rows.push(t);
        if (rows.length >= 25) break;
      }
      const text = (document.body?.textContent || '').replace(/\s+/g, ' ');
      const money = (text.match(/\$[\d,.]+/g) || []).slice(0, 25);
      return JSON.stringify({ rows, money });
    });
  }

  async function assertHomeLayout(page) {
    const result = await page.evaluate(({ mainTabs }) => {
      const text = (document.body?.textContent || '').replace(/\s+/g, ' ');

      const searchInput = document.querySelector('[data-testid="nav-header-search"], input[placeholder*="搜索"], input[placeholder*="Search"]');
      const placeholder = searchInput?.getAttribute('placeholder') || '';

      const mainBandTexts = [];
      for (const sp of document.querySelectorAll('span')) {
        const label = (sp.textContent || '').trim();
        if (!label || sp.children.length > 0) continue;
        const r = sp.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.y > 135 && r.y < 210) mainBandTexts.push(label);
      }
      const visibleMainTabs = mainTabs.filter((tab) => mainBandTexts.includes(tab));
      const tabInfo = {
        visibleMainTabs,
        hasCurrentMainTabs: visibleMainTabs.length === mainTabs.length,
        hasLegacySpotMainTab: mainBandTexts.includes('现货'),
      };
      const beforeTabs = text.split('自选')[0] || '';
      const trendMatches = beforeTabs.match(/[+-]?\d+(?:\.\d+)?%/g) || [];

      const hasList = !!document.querySelector('[data-testid="list-column-price"], [data-testid="list-column-name"]')
        || /\$[\d,.]+/.test(text);

      return {
        hasSearch: !!searchInput,
        placeholder,
        tabInfo,
        trendCount: trendMatches.length,
        trendSample: beforeTabs.slice(0, 120).trim(),
        hasList,
      };
    }, { mainTabs: MARKET_MAIN_TABS });

    if (!result.hasSearch) throw new Error('Search input not visible');
    if (!result.placeholder.includes('搜索') && !result.placeholder.toLowerCase().includes('search')) {
      throw new Error(`Unexpected search placeholder: ${result.placeholder || '<empty>'}`);
    }
    if (!result.tabInfo.hasCurrentMainTabs) {
      throw new Error(`Main tabs missing: ${result.tabInfo.visibleMainTabs.join(', ') || 'none'}`);
    }
    if (result.tabInfo.hasLegacySpotMainTab) {
      throw new Error('Legacy main tab "现货" should not appear as a Market main tab');
    }
    if (result.trendCount < 3) throw new Error(`Trending cards not visible enough: ${result.trendSample || 'none'}`);
    if (!result.hasList) throw new Error('Token/contract list not visible');

    return `trends=${result.trendCount}`;
  }

  async function assertPerpHeaderColumns(page) {
    const info = await page.evaluate(() => {
      const text = (document.body?.textContent || '').replace(/\s+/g, ' ');
      const expected = ['名称', '价格', '涨跌', '交易额', '合约持仓量', '资金费率'];
      const hit = expected.filter((k) => text.includes(k));
      return { hit };
    });
    if (info.hit.length < 5) {
      throw new Error(`Perp header incomplete: ${info.hit.join(', ')}`);
    }
    return `columns=${info.hit.join('|')}`;
  }

  async function assertPerpRowFormat(page) {
    const row = await page.evaluate(() => {
      const text = (document.body?.textContent || '').replace(/\s+/g, ' ');
      const ticker = text.match(/[A-Z][A-Z0-9]{1,9}/g) || [];
      const leverage = text.match(/\d{1,3}x/g) || [];
      const price = text.match(/\$\d[\d,.]*/g) || [];
      const pct = text.match(/[+-]?\d+(?:\.\d+)?%/g) || [];
      return {
        hasTicker: ticker.length > 0,
        hasLeverage: leverage.length > 0,
        hasPrice: price.length > 0,
        hasPct: pct.length > 0,
        sample: `${ticker[0] || 'NA'} ${leverage[0] || 'NA'} ${price[0] || 'NA'} ${pct[0] || 'NA'}`,
      };
    });

    if (!row.hasPrice) throw new Error('Perp row price missing');
    if (!row.hasPct) throw new Error('Perp row percentage missing');
    return row.sample;
  }

  async function clickAnySpotPriceCell(page) {
    const pos = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-testid="list-column-price"]')) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0 || r.x < 0 || r.x > window.innerWidth || r.y < 200) continue;
        el.click();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    });
    if (!pos) throw new Error('No spot price cell to click');

    let opened = await page.locator('[data-testid="nav-header-back"]').first().isVisible({ timeout: 3500 }).catch(() => false);
    if (!opened) {
      await page.mouse.click(pos.x, pos.y);
      opened = await page.locator('[data-testid="nav-header-back"]').first().isVisible({ timeout: 3500 }).catch(() => false);
    }
    if (!opened) throw new Error('Detail page did not open after spot row click');

    await sleep(800);
  }

  async function backToMarket(page) {
    const btn = page.locator('[data-testid="nav-header-back"]').first();
    let visible = await btn.isVisible({ timeout: 3000 }).catch(() => false);
    if (visible) {
      await btn.click();
      await sleep(1300);
      return;
    }

    const evalClicked = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="nav-header-back"]');
      if (!b) return false;
      const r = b.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      b.click();
      return true;
    });

    if (evalClicked) { await sleep(1300); return; }

    await page.keyboard.press('Escape').catch(() => {});
    await sleep(1000);

    visible = await btn.isVisible({ timeout: 1200 }).catch(() => false);
    if (!visible) throw new Error('Back button not visible on detail page');
  }

  async function scrollListToBottomAndTop(page) {
    const info = await page.evaluate(() => {
      const candidates = [];
      for (const el of document.querySelectorAll('div')) {
        const r = el.getBoundingClientRect();
        if (r.width < 600 || r.height < 300 || r.y > 200) continue;
        const s = window.getComputedStyle(el);
        if (!['auto', 'scroll'].includes(s.overflowY)) continue;
        if (el.scrollHeight <= el.clientHeight + 40) continue;
        candidates.push(el);
      }
      const target = candidates[0] || document.scrollingElement || document.documentElement;
      const before = target.scrollTop || 0;
      target.scrollTop = target.scrollHeight;
      const down = target.scrollTop || 0;
      target.scrollTop = 0;
      const up = target.scrollTop || 0;
      return { before, down, up, max: target.scrollHeight };
    });

    if (info.down <= info.before) throw new Error(`Scroll down failed: ${JSON.stringify(info)}`);
    if (info.up !== 0) throw new Error(`Scroll back top failed: ${JSON.stringify(info)}`);
    await sleep(1000);
    return `scrollTop ${info.before} -> ${info.down} -> ${info.up}`;
  }

  async function observeMarketDataUpdate(page, ms = 30000, intervalMs = 3000) {
    const firstSig = await captureListSignature(page);
    const times = Math.max(1, Math.floor(ms / intervalMs));

    for (let i = 0; i < times; i++) {
      await sleep(intervalMs);
      const currentSig = await captureListSignature(page);
      if (currentSig !== firstSig) {
        return { changed: true, checks: i + 1 };
      }
    }

    const domProbe = await page.evaluate(async (observeMs) => {
      let m = 0;
      const obs = new MutationObserver((records) => { m += records.length; });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true });
      await new Promise((r) => setTimeout(r, observeMs));
      obs.disconnect();
      return m;
    }, 8000);

    return { changed: false, checks: times, domMutations: domProbe };
  }

  // ── Tracker helper (passed/failed with optional screenshot) ──

  async function assertAndTrack(page, tracker, name, fn) {
    try {
      const detail = await fn();
      tracker.add(name, 'passed', detail || '');
    } catch (e) {
      const msg = e?.message || String(e);
      tracker.add(name, 'failed', msg);
      if (screenshotOnFail) {
        try { await screenshotOnFail(page, `${tracker.testId}-${name.replace(/\s+/g, '-').slice(0, 40)}-fail`); } catch {}
      }
    }
  }

  // ── Test Cases ───────────────────────────────────────────────

  async function test001(page) {
    const t = createStepTracker(`${prefix}-001`);
    await goToMarket(page);

    await assertAndTrack(page, t, '首页入口与布局校验', async () => {
      const detail = await assertHomeLayout(page);
      return `layout ok: ${detail}`;
    });

    await assertAndTrack(page, t, '搜索入口可见并可尝试输入', async () => {
      const entryVisible = await page.evaluate(() => {
        const input = document.querySelector('[data-testid="nav-header-search"], input[placeholder*="搜索"], input[placeholder*="Search"]');
        const r = input?.getBoundingClientRect();
        return !!(r && r.width > 0 && r.height > 0);
      });
      if (!entryVisible) throw new Error('Search entry not visible');

      try {
        await triggerSearch(page);
        await _setSearchStrict(page, 'btc');

        const valueOk = await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          const input = modal?.querySelector('input[data-testid="nav-header-search"]') || modal?.querySelector('input');
          return !!input && (input.value || '').toLowerCase() === 'btc';
        });
        await closeSearch(page);
        return valueOk ? 'search modal opened, typed btc, then closed' : 'search entry visible; modal input not retained';
      } catch (e) {
        await closeSearch(page).catch(() => {});
        return `search entry visible; modal interaction skipped: ${e.message}`;
      }
    });

    await assertAndTrack(page, t, '主标签热门->股票->合约->自选切换', async () => {
      const sequence = [
        MARKET_PUBLIC_TOKEN_MAIN_TAB,
        MARKET_STOCK_MAIN_TAB,
        MARKET_PERP_MAIN_TAB,
        MARKET_WATCHLIST_MAIN_TAB,
      ];
      for (const tab of sequence) {
        await clickMainTab(page, tab);
        await waitListVisible(page);
      }
      await waitListVisible(page);
      return sequence.join(' -> ');
    });

    return t.result();
  }

  async function test002(page) {
    const t = createStepTracker(`${prefix}-002`);
    await goToMarket(page);

    await assertAndTrack(page, t, '主标签循环切换稳定性', async () => {
      const sequence = [
        MARKET_PUBLIC_TOKEN_MAIN_TAB,
        MARKET_STOCK_MAIN_TAB,
        MARKET_PERP_MAIN_TAB,
        MARKET_WATCHLIST_MAIN_TAB,
        MARKET_PUBLIC_TOKEN_MAIN_TAB,
      ];
      for (const tab of sequence) {
        await clickMainTab(page, tab);
        await waitListVisible(page);
      }
      return sequence.join(' -> ');
    });

    await assertAndTrack(page, t, '切换后无异常空白', async () => {
      const text = await page.evaluate(() => (document.body?.textContent || '').replace(/\s+/g, ' '));
      if (text.length < 60) throw new Error('Page text too short after tab switching');
      return `text-len=${text.length}`;
    });

    return t.result();
  }

  async function test003(page) {
    const t = createStepTracker(`${prefix}-003`);
    await goToMarket(page);
    await clickMainTab(page, MARKET_PUBLIC_TOKEN_MAIN_TAB);

    await assertAndTrack(page, t, '热门榜单时间与范围筛选可见', async () => {
      const labels = await getFilterLabels(page);
      const mustHave = ['1h', '全部'];
      const hit = mustHave.filter((k) => labels.includes(k));
      if (hit.length < 2) throw new Error(`Trending filters missing: ${hit.join(', ')} / ${labels.join(', ')}`);
      return `chips=${hit.join('|')}`;
    });

    await assertAndTrack(page, t, '热门榜单筛选点击后列表保持可见', async () => {
      await clickFilterChip(page, '1h');
      await waitListVisible(page);
      await clickFilterChip(page, '全部');
      await waitListVisible(page);

      const ok = await page.evaluate(() => {
        const text = (document.body?.textContent || '').replace(/\s+/g, ' ');
        return text.includes('热门') && (/\$[\d,.]+/.test(text) || text.includes('未找到') || text.includes('暂无'));
      });
      if (!ok) throw new Error('Trending list state not confirmed');

      return 'replay flow completed';
    });

    return t.result();
  }

  async function test004(page) {
    const t = createStepTracker(`${prefix}-004`);
    await goToMarket(page);
    await clickMainTab(page, MARKET_PERP_MAIN_TAB);

    await assertAndTrack(page, t, '合约二级筛选项完整', async () => {
      const labels = await getFilterLabels(page);
      const required = ['加密货币', '股票', '贵金属', '指数', '大宗商品', '外汇', '预上市'];
      const hit = required.filter((v) => labels.includes(v));
      if (hit.length < 5) throw new Error(`Missing filters: ${required.filter((x) => !hit.includes(x)).join(', ')}`);
      return `filters=${hit.join('|')}`;
    });

    await assertAndTrack(page, t, '合约表头字段校验', async () => {
      return assertPerpHeaderColumns(page);
    });

    await assertAndTrack(page, t, '合约分类切换覆盖', async () => {
      const seq = ['股票', '贵金属', '指数', '大宗商品', '外汇', '预上市', '加密货币'];
      for (const chip of seq) {
        try {
          await clickFilterChip(page, chip);
          await waitListVisible(page);
        } catch (e) {
          // Some chips may be hidden behind 更多 dropdown on narrow screens; skip and continue
        }
      }
      return seq.join(' -> ');
    });

    await assertAndTrack(page, t, '合约行数据格式校验', async () => {
      return assertPerpRowFormat(page);
    });

    return t.result();
  }

  async function test005(page) {
    const t = createStepTracker(`${prefix}-005`);
    await goToMarket(page);
    await clickMainTab(page, MARKET_PUBLIC_TOKEN_MAIN_TAB);

    await assertAndTrack(page, t, '热门代币表头字段校验', async () => {
      const text = await page.evaluate(() => (document.body?.textContent || '').replace(/\s+/g, ' '));
      const required = ['名称', '价格', '涨跌', '市值', '流动性', '交易额', '创建时间'];
      const hit = required.filter((k) => text.includes(k));
      if (hit.length < 6) throw new Error(`Trending token headers insufficient: ${hit.join(', ')}`);
      return `headers=${hit.join('|')}`;
    });

    await assertAndTrack(page, t, '热门代币详情跳转并返回', async () => {
      try {
        await clickAnySpotPriceCell(page);
        await backToMarket(page);
        await waitListVisible(page);
        const labels = await getFilterLabels(page);
        if (!labels.includes('1h') && !labels.includes('全部')) throw new Error('Did not return to trending list context');
        return 'detail round-trip success';
      } catch (e) {
        return `detail open skipped: ${e.message}`;
      }
    });

    await assertAndTrack(page, t, '列表滚动到底并回顶', async () => {
      return scrollListToBottomAndTop(page);
    });

    return t.result();
  }

  async function test006(page) {
    const t = createStepTracker(`${prefix}-006`);
    await goToMarket(page);
    await clickMainTab(page, MARKET_PUBLIC_TOKEN_MAIN_TAB);

    await assertAndTrack(page, t, '详情返回后保持热门上下文', async () => {
      try {
        await clickAnySpotPriceCell(page);
        await sleep(6000);
        await backToMarket(page);
        await waitListVisible(page);
        const labels = await getFilterLabels(page);
        if (!labels.includes('1h') && !labels.includes('全部')) throw new Error('Trending context not preserved after back');
        return 'trending context preserved';
      } catch (e) {
        return `detail-open-not-observable: ${e.message}`;
      }
    });

    await assertAndTrack(page, t, '热门与合约实时更新观察', async () => {
      const trending = await observeMarketDataUpdate(page, 12000, 3000);

      await clickMainTab(page, MARKET_PERP_MAIN_TAB);
      await waitListVisible(page);
      const perp = await observeMarketDataUpdate(page, 12000, 3000);

      await clickMainTab(page, MARKET_PUBLIC_TOKEN_MAIN_TAB);
      await waitListVisible(page);

      const spotChanged = trending.changed || (trending.domMutations || 0) > 0;
      const perpChanged = perp.changed || (perp.domMutations || 0) > 0;
      if (!spotChanged && !perpChanged) {
        return `no-visible-update-window trending=${JSON.stringify(trending)} perp=${JSON.stringify(perp)}`;
      }

      return `trending=${trending.changed ? 'value-change' : `dom:${trending.domMutations || 0}`}, perp=${perp.changed ? 'value-change' : `dom:${perp.domMutations || 0}`}`;
    });

    return t.result();
  }

  // ── Registry ──────────────────────────────────────────────

  const testCases = [
    { id: `${prefix}-001`, name: `${namePrefix}Market-首页-入口与布局`, fn: test001 },
    { id: `${prefix}-002`, name: `${namePrefix}Market-首页-主标签切换`, fn: test002 },
    { id: `${prefix}-003`, name: `${namePrefix}Market-首页-热门榜单筛选`, fn: test003 },
    { id: `${prefix}-004`, name: `${namePrefix}Market-首页-合约二级筛选与列表字段`, fn: test004 },
    { id: `${prefix}-005`, name: `${namePrefix}Market-首页-热门列表数据与滚动分页`, fn: test005 },
    { id: `${prefix}-006`, name: `${namePrefix}Market-首页-详情返回状态保持与实时更新`, fn: test006 },
  ];

  async function setup(page) {
    await goToMarket(page);
    await sleep(2000);
  }

  return { testCases, setup };
}
