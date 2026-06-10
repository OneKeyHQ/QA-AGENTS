// Perps Token Search — shared test logic (Desktop / Web / Extension)
//
// Wrapper files at:
//   src/tests/desktop/perps/token-search.test.mjs
//   src/tests/web/perps/token-search.test.mjs
//   src/tests/extension/perps/token-search.test.mjs
// inject platform-specific CDP connect + goToPerps + tab layout, then call
// createPerpsTokenSearchTests() to get the same set of test cases.
//
// Tab layout 'flat'   (Desktop / Extension):
//   单级 tab: 自选 / 永续合约 / 加密货币 / 股票 / 贵金属 / 指数 / 大宗商品 / 外汇 / 预上线
//   测试用例：SEARCH-001 ~ SEARCH-003
//
// Tab layout 'two-level' (Web):
//   顶级 tab: 自选 / 永续合约 / 现货
//   子级 tab（仅永续合约下）: 全部 / 加密货币 / 股票 / 贵金属 / 指数 / 大宗商品 / 外汇 / 预上线
//   测试用例：SEARCH-001 ~ SEARCH-004

import { sleep } from '../../helpers/constants.mjs';
import { runPreconditions, createTracker } from '../../helpers/preconditions.mjs';
import { assertListRendered } from '../../helpers/components.mjs';

/**
 * Build the Perps Token Search test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'SEARCH' | 'WEB-PERPS-SEARCH' | 'EXT-PERPS-SEARCH'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.goToPerps
 * @param {(page: import('playwright-core').Page, dir: string, name: string) => Promise<void>} opts.screenshot
 * @param {string} opts.screenshotDir - Absolute directory for failure screenshots
 * @param {'flat'|'two-level'} [opts.tabLayout='flat'] - Tab layout for this platform
 * @param {Array<{ query: string, expected: string }>} [opts.extraTwoLevelChineseSearchCases] - Extra 永续合约/全部 search cases for two-level layout.
 * @returns {{ testCases: Array, setup: (page) => Promise<void>, ensurePopoverOpen: (page) => Promise<void>, dismissPopover: (page) => Promise<void>, getPreReport: () => any }}
 */
export function createPerpsTokenSearchTests({
  prefix,
  namePrefix = '',
  goToPerps,
  screenshot,
  screenshotDir,
  tabLayout = 'flat',
  extraTwoLevelChineseSearchCases = [],
}) {

  // ── Helpers (Web-flavored, work on both layouts) ─────────────

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
    await sleep(1500);
  }

  async function ensurePopoverOpen(page) {
    const open = await page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const p of pops) { if (p.getBoundingClientRect().width > 0) return true; }
      return false;
    });
    if (!open) {
      await openPairSelector(page);
    }
  }

  async function dismissPopover(page) {
    await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="ovelay-popover"]');
      if (overlay) overlay.click();
    });
    await sleep(1500);
  }

  async function searchAsset(page, query) {
    await page.evaluate((q) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let input = null;
      for (const pop of pops) {
        if (pop.getBoundingClientRect().width === 0) continue;
        const inp = pop.querySelector('input[data-testid="nav-header-search"]')
          || pop.querySelector('input[placeholder*="搜索"]');
        if (inp && inp.getBoundingClientRect().width > 0) { input = inp; break; }
      }
      if (!input) {
        for (const inp of document.querySelectorAll('input[data-testid="nav-header-search"], input[placeholder*="搜索"]')) {
          if (inp.getBoundingClientRect().width > 0) { input = inp; break; }
        }
      }
      if (!input) throw new Error('Search input not found');
      input.focus();
      const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (nativeSet) {
        nativeSet.call(input, q);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, query);
    await sleep(800);
  }

  async function clearSearch(page) {
    const clearPos = await page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-testid="-clear"]')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0) return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }
      return null;
    });
    if (clearPos) {
      await page.mouse.click(clearPos.x, clearPos.y);
      await sleep(300);
      return;
    }
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
    await sleep(300);
  }

  /** Flat tab click (Desktop / Extension) — first matching visible span in popover. */
  async function clickTab(page, tabName) {
    const clicked = await page.evaluate((txt) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const p of pops) {
        if (p.getBoundingClientRect().width === 0) continue;
        for (const sp of p.querySelectorAll('span')) {
          if (sp.textContent?.trim() === txt && sp.getBoundingClientRect().width > 0) {
            sp.click(); return true;
          }
        }
      }
      return false;
    }, tabName);
    if (!clicked) throw new Error(`Tab "${tabName}" not found`);
    await sleep(500);
  }

  /**
   * 点击顶级 tab（自选 / 永续合约 / 现货）。
   * 顶级 tab 通常在弹窗顶部第一行（相对 y < 100px）。
   */
  async function clickTopTab(page, tabName) {
    const clicked = await page.evaluate((txt) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const pop of pops) {
        const pr = pop.getBoundingClientRect();
        if (pr.width === 0) continue;
        for (const sp of pop.querySelectorAll('span')) {
          if (sp.textContent?.trim() !== txt) continue;
          const sr = sp.getBoundingClientRect();
          if (sr.width === 0) continue;
          if (sr.y - pr.y < 100) {
            sp.click(); return true;
          }
        }
      }
      return false;
    }, tabName);
    if (!clicked) throw new Error(`Top tab "${tabName}" not found`);
    await sleep(1200);
  }

  /**
   * 点击子级 tab（全部 / 加密货币 / 股票 ...，仅 永续合约 下出现）。
   * 子级 tab 在顶级 tab 下方第二行（相对 y >= 100px 且 < 200px）。
   */
  async function clickSubTab(page, tabName) {
    const clicked = await page.evaluate((txt) => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      for (const pop of pops) {
        const pr = pop.getBoundingClientRect();
        if (pr.width === 0) continue;
        for (const sp of pop.querySelectorAll('span')) {
          if (sp.textContent?.trim() !== txt) continue;
          const sr = sp.getBoundingClientRect();
          if (sr.width === 0) continue;
          const dy = sr.y - pr.y;
          if (dy >= 100 && dy < 200) {
            sp.click(); return true;
          }
        }
      }
      return false;
    }, tabName);
    if (!clicked) throw new Error(`Sub tab "${tabName}" not found`);
    await sleep(800);
  }

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

  /**
   * 提取弹窗内的代币列表。
   * - 永续 tab 下：单 ticker 如 "BTC", "ETH"
   * - 现货 tab 下：pair 格式如 "BTC/USDC", "HYPE/USDC"
   * 同时收集两种格式，调用方自行根据 mode 过滤。
   */
  async function getTokenList(page) {
    return page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
      if (!pop) return [];
      const tokens = [];
      const ignore = new Set([
        '自选','永续合约','现货','全部',
        '加密货币','股票','贵金属','指数','大宗商品','外汇','预上线',
        '资产','最新价格','24小时涨跌','资金费率','成交量','成交额','合约持仓量','市值',
        '搜索资产','未找到匹配的代币','添加到自选',
      ]);
      const tickerRe = /^[A-Z][A-Z0-9]{1,9}$/;
      const pairRe = /^[A-Z][A-Z0-9]{1,9}\/[A-Z]{2,6}$/;
      for (const sp of pop.querySelectorAll('span')) {
        const t = sp.textContent?.trim();
        if (!t || sp.children.length !== 0 || sp.getBoundingClientRect().width === 0) continue;
        if (ignore.has(t)) continue;
        if ((tickerRe.test(t) || pairRe.test(t)) && !tokens.includes(t)) tokens.push(t);
      }
      return tokens;
    });
  }

  /** 提取 base ticker（去掉 /USDC 等后缀），用于断言「现货搜 BTC 命中 BTC/USDC」之类。 */
  function baseTicker(token) {
    return token.includes('/') ? token.split('/')[0] : token;
  }

  /** 返回当前弹窗的版块 tab 列表（flat 布局：自选 / 永续合约 / 加密货币 / ...）。 */
  async function getSectionTabs(page) {
    return page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
      if (!pop) return [];
      const tabs = [];
      const known = ['自选','永续合约','加密货币','股票','贵金属','指数','大宗商品','外汇','预上线'];
      for (const sp of pop.querySelectorAll('span')) {
        const t = sp.textContent?.trim();
        if (t && known.includes(t) && sp.getBoundingClientRect().width > 0 && !tabs.includes(t)) tabs.push(t);
      }
      return tabs;
    });
  }

  /** 返回当前弹窗的子级 tab 列表（仅在 永续合约 顶级 tab 下出现）。 */
  async function getSubTabs(page) {
    return page.evaluate(() => {
      const pops = document.querySelectorAll('[data-testid="TMPopover-ScrollView"]');
      let pop = null;
      for (const p of pops) { if (p.getBoundingClientRect().width > 0) { pop = p; break; } }
      if (!pop) return [];
      const pr = pop.getBoundingClientRect();
      const tabs = [];
      const known = ['全部','加密货币','股票','贵金属','指数','大宗商品','外汇','预上线'];
      for (const sp of pop.querySelectorAll('span')) {
        const t = sp.textContent?.trim();
        if (!t || !known.includes(t)) continue;
        const sr = sp.getBoundingClientRect();
        if (sr.width === 0) continue;
        const dy = sr.y - pr.y;
        if (dy >= 100 && dy < 200 && !tabs.includes(t)) tabs.push(t);
      }
      return tabs;
    });
  }

  // ── Pre-report state (per-instance) ──────────────────────────

  let _preReport = null;
  function getPreReport() { return _preReport; }

  const ALL_TEST_IDS = tabLayout === 'two-level'
    ? [`${prefix}-001`, `${prefix}-002`, `${prefix}-003`, `${prefix}-004`]
    : [`${prefix}-001`, `${prefix}-002`, `${prefix}-003`];

  // ── Test Cases (Flat layout: Desktop / Extension) ────────────

  /**
   * SEARCH-001: 英文搜索 + 跨 tab 联动（flat 布局）
   */
  async function testFlat001(page) {
    const t = createTracker(`${prefix}-001`, _preReport);

    await clickTab(page, '永续合约');
    await searchAsset(page, 'BT');

    // Assert search results list rendered (skip overlap check — tab bar is intentionally compact)
    const lrSearch = await assertListRendered(page, {
      selector: '[data-testid="TMPopover-ScrollView"] span',
      minCount: 1,
    });
    const countError = lrSearch.errors.find(e => e.includes('count'));
    if (countError) throw new Error(`List render: ${countError}`);

    const perpsTokens = await getTokenList(page);
    t.add('永续合约搜索 BT 有结果', perpsTokens.length > 0 ? 'passed' : 'failed',
      `results: ${perpsTokens.join(', ') || 'none'}`, { dataKey: 'BT' });
    t.add('永续合约搜索 BT 含 BTC', perpsTokens.includes('BTC') ? 'passed' : 'failed',
      `results: ${perpsTokens.join(', ')}`, { dataKey: 'BT' });

    const tabs = await getSectionTabs(page);
    const otherTabs = tabs.filter(tn => tn !== '自选' && tn !== '永续合约');

    for (const tab of otherTabs) {
      await clickTab(page, tab);
      const tokens = await getTokenList(page);
      const empty = await isSearchEmpty(page);

      if (tokens.length > 0) {
        t.add(`${tab} 搜索 BT 有联想`, 'passed',
          `${tokens.length} results: ${tokens.join(', ')}`);
      } else if (empty) {
        t.add(`${tab} 搜索 BT 显示空状态`, 'passed', '未找到匹配的代币');
      } else {
        await screenshot(page, screenshotDir, `${prefix}-001-bt-${tab}-error`);
        t.add(`${tab} 搜索 BT 状态异常`, 'failed', '既无结果也无空状态提示');
      }
    }

    await clearSearch(page);
    await clickTab(page, '永续合约');
    return t.result();
  }

  /**
   * SEARCH-002: 中文关键词搜索（flat 布局）
   */
  async function testFlat002(page) {
    const t = createTracker(`${prefix}-002`, _preReport);

    await clickTab(page, '永续合约');
    await sleep(500);
    await searchAsset(page, '比特');

    const btTokens = await getTokenList(page);
    t.add('搜索「比特」有结果', btTokens.length > 0 ? 'passed' : 'failed',
      `results: ${btTokens.join(', ') || 'none'}`, { dataKey: '比特' });
    t.add('「比特」匹配 BTC', btTokens.includes('BTC') ? 'passed' : 'failed',
      `results: ${btTokens.join(', ')}`, { dataKey: '比特' });

    await clearSearch(page);
    await searchAsset(page, '以太');

    const ethTokens = await getTokenList(page);
    t.add('搜索「以太」有结果', ethTokens.length > 0 ? 'passed' : 'failed',
      `results: ${ethTokens.join(', ') || 'none'}`, { dataKey: '以太' });
    t.add('「以太」匹配 ETH', ethTokens.includes('ETH') ? 'passed' : 'failed',
      `results: ${ethTokens.join(', ')}`, { dataKey: '以太' });

    await clearSearch(page);
    return t.result();
  }

  /**
   * SEARCH-003: 版块 Tab 遍历（flat 布局）
   */
  async function testFlat003(page) {
    const t = createTracker(`${prefix}-003`, _preReport);

    await clearSearch(page);
    const tabs = await getSectionTabs(page);
    t.add('检测到版块 tabs', tabs.length > 0 ? 'passed' : 'failed',
      `tabs: ${tabs.join(', ')}`);

    for (const tab of tabs) {
      if (tab === '自选') continue;

      await clickTab(page, tab);
      const tokens = await getTokenList(page);
      const empty = await isSearchEmpty(page);

      if (tokens.length > 0) {
        const preview = tokens.length > 5
          ? tokens.slice(0, 5).join(', ') + `... (${tokens.length})`
          : tokens.join(', ');
        t.add(`${tab} 有代币`, 'passed', preview);
      } else if (empty) {
        t.add(`${tab} 空状态`, 'passed', '暂无代币');
      } else {
        await screenshot(page, screenshotDir, `${prefix}-003-${tab}-error`);
        t.add(`${tab} 状态异常`, 'failed', '既无代币也无空状态提示');
      }
    }

    return t.result();
  }

  // ── Test Cases (Two-level layout: Web) ───────────────────────

  async function testTwoLevel001(page) {
    const t = createTracker(`${prefix}-001`, _preReport);

    await clickTopTab(page, '永续合约');
    await clickSubTab(page, '全部');

    await searchAsset(page, 'BT');

    const perpsTokens = await getTokenList(page);
    t.add('永续合约/全部 搜索 BT 有结果', perpsTokens.length > 0 ? 'passed' : 'failed',
      `results: ${perpsTokens.join(', ') || 'none'}`, { dataKey: 'BT' });
    t.add('永续合约/全部 搜索 BT 含 BTC', perpsTokens.includes('BTC') ? 'passed' : 'failed',
      `results: ${perpsTokens.join(', ')}`, { dataKey: 'BT' });

    const subTabs = await getSubTabs(page);
    const otherSubTabs = subTabs.filter(s => s !== '全部');

    for (const sub of otherSubTabs) {
      await clickSubTab(page, sub);
      const tokens = await getTokenList(page);
      const empty = await isSearchEmpty(page);

      if (tokens.length > 0) {
        t.add(`${sub} 搜索 BT 有联想`, 'passed',
          `${tokens.length} results: ${tokens.join(', ')}`);
      } else if (empty) {
        t.add(`${sub} 搜索 BT 显示空状态`, 'passed', '未找到匹配的代币');
      } else {
        await screenshot(page, screenshotDir, `${prefix}-001-bt-${sub}-error`);
        t.add(`${sub} 搜索 BT 状态异常`, 'failed', '既无结果也无空状态提示');
      }
    }

    await clearSearch(page);
    await clickSubTab(page, '全部');
    return t.result();
  }

  async function testTwoLevel002(page) {
    const t = createTracker(`${prefix}-002`, _preReport);

    await clickTopTab(page, '永续合约');
    await clickSubTab(page, '全部');

    const searchCases = [
      { query: '比特', expected: 'BTC' },
      { query: '以太', expected: 'ETH' },
      ...extraTwoLevelChineseSearchCases,
    ];

    for (const { query, expected } of searchCases) {
      await clearSearch(page);
      await searchAsset(page, query);

      const tokens = await getTokenList(page);
      t.add(`永续合约/全部 搜索「${query}」有结果`, tokens.length > 0 ? 'passed' : 'failed',
        `results: ${tokens.join(', ') || 'none'}`, { dataKey: query });
      t.add(`「${query}」匹配 ${expected}`, tokens.includes(expected) ? 'passed' : 'failed',
        `results: ${tokens.join(', ')}`, { dataKey: query });
    }

    await clearSearch(page);
    return t.result();
  }

  async function testTwoLevel003(page) {
    const t = createTracker(`${prefix}-003`, _preReport);

    await clickTopTab(page, '永续合约');
    await clearSearch(page);

    const subTabs = await getSubTabs(page);
    t.add('检测到永续合约子 tabs', subTabs.length > 0 ? 'passed' : 'failed',
      `tabs: ${subTabs.join(', ')}`);

    for (const sub of subTabs) {
      await clickSubTab(page, sub);
      const tokens = await getTokenList(page);
      const empty = await isSearchEmpty(page);

      if (tokens.length > 0) {
        const preview = tokens.length > 5
          ? tokens.slice(0, 5).join(', ') + `... (${tokens.length})`
          : tokens.join(', ');
        t.add(`${sub} 有代币`, 'passed', preview);
      } else if (empty) {
        t.add(`${sub} 空状态`, 'passed', '暂无代币');
      } else {
        await screenshot(page, screenshotDir, `${prefix}-003-${sub}-error`);
        t.add(`${sub} 状态异常`, 'failed', '既无代币也无空状态提示');
      }
    }

    await clickSubTab(page, '全部');
    return t.result();
  }

  async function testTwoLevel004(page) {
    const t = createTracker(`${prefix}-004`, _preReport);

    await clickTopTab(page, '现货');
    await clearSearch(page);

    const defaultList = await getTokenList(page);
    const hasPair = defaultList.some(x => /\/USDC$/.test(x));
    t.add('现货默认列表展示 pair', hasPair ? 'passed' : 'failed',
      `default: ${defaultList.slice(0, 5).join(', ')}${defaultList.length > 5 ? '...' : ''}`);

    await searchAsset(page, 'BTC');
    const btcList = await getTokenList(page);
    const btcBases = btcList.map(baseTicker);
    t.add('现货搜索 BTC 有结果', btcList.length > 0 ? 'passed' : 'failed',
      `results: ${btcList.join(', ') || 'none'}`, { dataKey: 'BTC' });
    t.add('现货搜索 BTC 命中 BTC pair', btcBases.includes('BTC') ? 'passed' : 'failed',
      `bases: ${btcBases.join(', ')}`, { dataKey: 'BTC' });
    t.add('现货 BTC 结果仅含 pair 格式',
      btcList.length > 0 && btcList.every(x => /\/[A-Z]{2,6}$/.test(x)) ? 'passed' : 'failed',
      `results: ${btcList.join(', ')}`);

    await clearSearch(page);

    await searchAsset(page, 'HYPE');
    const hypeList = await getTokenList(page);
    const hypeBases = hypeList.map(baseTicker);
    t.add('现货搜索 HYPE 有结果', hypeList.length > 0 ? 'passed' : 'failed',
      `results: ${hypeList.join(', ') || 'none'}`, { dataKey: 'HYPE' });
    t.add('现货搜索 HYPE 命中 HYPE pair', hypeBases.includes('HYPE') ? 'passed' : 'failed',
      `bases: ${hypeBases.join(', ')}`, { dataKey: 'HYPE' });

    await clearSearch(page);
    return t.result();
  }

  // ── Registry ──────────────────────────────────────────────

  const testCases = tabLayout === 'two-level'
    ? [
        { id: `${prefix}-001`, name: `${namePrefix}Perps-搜索-永续合约/全部 英文BT 跨子Tab联动`, fn: testTwoLevel001 },
        { id: `${prefix}-002`, name: `${namePrefix}Perps-搜索-永续合约/全部 中文比特/以太`, fn: testTwoLevel002 },
        { id: `${prefix}-003`, name: `${namePrefix}Perps-搜索-永续合约 子Tab遍历`, fn: testTwoLevel003 },
        { id: `${prefix}-004`, name: `${namePrefix}Perps-搜索-现货 BTC/HYPE`, fn: testTwoLevel004 },
      ]
    : [
        { id: `${prefix}-001`, name: `${namePrefix}Perps-搜索-英文搜索与跨Tab联动`, fn: testFlat001 },
        { id: `${prefix}-002`, name: `${namePrefix}Perps-搜索-中文关键词搜索`, fn: testFlat002 },
        { id: `${prefix}-003`, name: `${namePrefix}Perps-搜索-版块Tab遍历`, fn: testFlat003 },
      ];

  async function setup(page) {
    await goToPerps(page);
    await openPairSelector(page);

    _preReport = await runPreconditions(page, ALL_TEST_IDS);

    await ensurePopoverOpen(page);
  }

  return { testCases, setup, ensurePopoverOpen, dismissPopover, getPreReport };
}
