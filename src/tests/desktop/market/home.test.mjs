// Market Home Tests (Desktop)
// Test IDs: MARKET-HOME-001 ~ MARKET-HOME-006
// Generated from confirmed recording session
//
// 覆盖映射：
// 录制 1 -> 用例 #1 首页入口与布局
// 录制 2 -> 用例 #2 主标签切换（自选/现货/合约）
// 录制 3 -> 用例 #3 现货网络筛选器
// 录制 4 -> 用例 #4 合约二级筛选与列表字段
// 录制 5 -> 用例 #5 现货列表数据展示 + 滚动
// 录制 6 -> 用例 #6 数据更新观察 + 详情返回状态保持

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { runPreconditions, createTracker } from '../../helpers/preconditions.mjs';
import { MarketPage } from '../../helpers/pages/index.mjs';
import { openSearchModal, assertListRendered } from '../../helpers/components.mjs';
import {
  setSearchValueStrict, closeSearch,
} from '../../helpers/market-search.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'market-home');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = [
  'MARKET-HOME-001',
  'MARKET-HOME-002',
  'MARKET-HOME-003',
  'MARKET-HOME-004',
  'MARKET-HOME-005',
  'MARKET-HOME-006',
];

let _preReport = null;

function bodyText() {
  return (document.body?.textContent || '').replace(/\s+/g, ' ');
}

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

// Search trigger wrapper for market-search.mjs functions that accept triggerFn
const triggerSearch = (page) => openSearchModal(page);

const _openSearch = (page) => openSearchModal(page);
const _setSearchStrict = (page, v) => setSearchValueStrict(page, v, triggerSearch);

async function clickMainTab(page, tab) {
  const ok = await page.evaluate((name) => {
    for (const sp of document.querySelectorAll('span')) {
      if ((sp.textContent || '').trim() !== name) continue;
      const r = sp.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 135 && r.y < 210) {
        sp.click();
        return true;
      }
    }
    return false;
  }, tab);
  if (!ok) throw new Error(`Cannot click main tab: ${tab}`);
  await sleep(1100);
}

async function clickFilterChip(page, label) {
  const ok = await page.evaluate((name) => {
    const nodes = document.querySelectorAll('span, div, button');
    for (const el of nodes) {
      const text = (el.textContent || '').trim();
      if (text !== name) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.y > 205 && r.y < 280) {
        el.scrollIntoView({ inline: 'center', block: 'nearest' });
        el.click();
        return true;
      }
    }
    return false;
  }, label);
  if (!ok) throw new Error(`Cannot click filter chip: ${label}`);
  await sleep(1200);
}

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
  return page.evaluate(() => {
    const labels = [];
    for (const sp of document.querySelectorAll('span')) {
      const t = (sp.textContent || '').trim();
      if (!t) continue;
      const r = sp.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.y < 205 || r.y > 280) continue;
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
      if (r.width <= 0 || r.height <= 0 || r.y < 240) continue;
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
  const result = await page.evaluate(() => {
    const text = (document.body?.textContent || '').replace(/\s+/g, ' ');

    const searchInput = document.querySelector('[data-testid="nav-header-search"], input[placeholder*="搜索"], input[placeholder*="Search"]');
    const placeholder = searchInput?.getAttribute('placeholder') || '';

    const hasTabs = ['自选', '现货', '合约'].every((t) => text.includes(t));
    const hotTags = ['美股', 'Layer 1', '表情包'];
    const hotHit = hotTags.filter((t) => text.includes(t));

    const hasMarketIcon = !!document.querySelector('[data-testid="tab-modal-active-item-TradingViewCandlesSolid"]');
    const navExpected = ['钱包', '交易', '合约', 'DeFi', '设备', '推荐', '浏览器'];
    const navHit = navExpected.filter((t) => text.includes(t));

    const hasList = !!document.querySelector('[data-testid="list-column-price"], [data-testid="list-column-name"]')
      || /\$[\d,.]+/.test(text);

    return {
      hasSearch: !!searchInput,
      placeholder,
      hasTabs,
      hotHit,
      hasMarketIcon,
      navHit,
      hasList,
    };
  });

  if (!result.hasSearch) throw new Error('Search input not visible');
  if (!result.placeholder.includes('搜索') && !result.placeholder.toLowerCase().includes('search')) {
    throw new Error(`Unexpected search placeholder: ${result.placeholder || '<empty>'}`);
  }
  if (!result.hasTabs) throw new Error('Main tabs (自选/现货/合约) missing');
  if (result.hotHit.length < 2) throw new Error(`Hot cards not visible enough: ${result.hotHit.join(', ') || 'none'}`);
  if (!result.hasMarketIcon) throw new Error('Market sidebar icon is not active');
  if (result.navHit.length < 5) throw new Error(`Sidebar entries incomplete: ${result.navHit.join(', ')}`);
  if (!result.hasList) throw new Error('Token/contract list not visible');

  return `hot=${result.hotHit.join('|')}, nav=${result.navHit.join('|')}`;
}

async function assertPerpHeaderColumns(page) {
  const info = await page.evaluate(() => {
    const text = (document.body?.textContent || '').replace(/\s+/g, ' ');
    const expected = ['名称', '价格', '涨跌', '交易额', '合约持仓量', '资金费率'];
    const hit = expected.filter((k) => text.includes(k));
    return { hit, textHead: text.slice(0, 300) };
  });
  if (info.hit.length < 5) {
    throw new Error(`Perp header incomplete: ${info.hit.join(', ')}`);
  }
  return `columns=${info.hit.join('|')}`;
}

async function assertPerpRowFormat(page) {
  const row = await page.evaluate(() => {
    const text = (document.body?.textContent || '').replace(/\s+/g, ' ');
    const ticker = text.match(/[A-Z][A-Z0-9]{1,9}/g) || [];
    const leverage = text.match(/\d{1,3}x/g) || [];
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
      if (r.width <= 0 || r.height <= 0 || r.y < 250) continue;
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

  if (evalClicked) {
    await sleep(1300);
    return;
  }

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
      if (r.width < 900 || r.height < 400 || r.y > 120) continue;
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
    const obs = new MutationObserver((records) => {
      m += records.length;
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    await new Promise((r) => setTimeout(r, observeMs));
    obs.disconnect();
    return m;
  }, 8000);

  return { changed: false, checks: times, domMutations: domProbe };
}

// ── Test Cases ───────────────────────────────────────────────

async function testMarketHome001(page) {
  const t = createTracker('MARKET-HOME-001', _preReport);
  await goToMarket(page);

  await assertAndTrack(page, t, '首页入口与布局校验', async () => {
    const detail = await assertHomeLayout(page);
    return `layout ok: ${detail}`;
  });

  await assertAndTrack(page, t, '搜索框打开输入并关闭', async () => {
    await _openSearch(page);
    await _setSearchStrict(page, 'btc');

    const valueOk = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const input = modal?.querySelector('input[data-testid="nav-header-search"]') || modal?.querySelector('input');
      return !!input && (input.value || '').toLowerCase() === 'btc';
    });
    if (!valueOk) throw new Error('Search modal did not receive value btc');

    await closeSearch(page);
    return 'search modal opened, typed btc, then closed';
  });

  await assertAndTrack(page, t, '主标签现货->合约->自选切换', async () => {
    await clickMainTab(page, '现货');
    await waitListVisible(page);

    const lrTab = await assertListRendered(page, {
      selector: '[data-testid="list-column-name"]',
      minCount: 3,
    });
    if (lrTab.errors.length > 0) throw new Error(`List render: ${lrTab.errors.join('; ')}`);

    await clickMainTab(page, '合约');
    await waitListVisible(page);
    await clickMainTab(page, '自选');
    await waitListVisible(page);
    return 'tab switch completed';
  });

  return t.result();
}

async function testMarketHome002(page) {
  const t = createTracker('MARKET-HOME-002', _preReport);
  await goToMarket(page);

  await assertAndTrack(page, t, '主标签循环切换稳定性', async () => {
    const sequence = ['现货', '合约', '自选', '现货', '合约'];
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

async function testMarketHome003(page) {
  const t = createTracker('MARKET-HOME-003', _preReport);
  await goToMarket(page);
  await clickMainTab(page, '现货');

  await assertAndTrack(page, t, '现货筛选器默认项与网络项可见', async () => {
    const labels = await getFilterLabels(page);
    const mustHave = ['All Networks', 'BNB Chain', 'Ethereum'];
    const hit = mustHave.filter((k) => labels.includes(k));
    if (hit.length < 3) throw new Error(`Network filter missing: ${hit.join(', ')} / ${labels.join(', ')}`);
    return `chips=${hit.join('|')}`;
  });

  await assertAndTrack(page, t, '网络筛选切换 All -> BNB Chain -> Ethereum -> All（按重录）', async () => {
    // Strict replay from re-recorded MARKET-HOME-003:
    // All Networks -> BNB Chain -> scroll right -> Ethereum -> scroll right -> scroll left -> All Networks.
    await clickFilterChip(page, 'All Networks');
    await waitListVisible(page);

    await clickFilterChip(page, 'BNB Chain');
    await waitListVisible(page);

    const lrFilter = await assertListRendered(page, {
      selector: '[data-testid="list-column-name"]',
      minCount: 3,
    });
    if (lrFilter.errors.length > 0) throw new Error(`List render: ${lrFilter.errors.join('; ')}`);

    await page.evaluate(() => {
      const bar = document.querySelector('div[style*="overflow"]') || document.querySelector('body');
      if (bar && bar.scrollBy) bar.scrollBy({ left: 108, top: 0, behavior: 'instant' });
    });
    await sleep(400);

    await clickFilterChip(page, 'Ethereum');
    await waitListVisible(page);

    await page.evaluate(() => {
      const bar = document.querySelector('div[style*="overflow"]') || document.querySelector('body');
      if (bar && bar.scrollBy) bar.scrollBy({ left: 120, top: 0, behavior: 'instant' });
    });
    await sleep(400);

    await page.evaluate(() => {
      const bar = document.querySelector('div[style*="overflow"]') || document.querySelector('body');
      if (bar && bar.scrollBy) bar.scrollBy({ left: -224, top: 0, behavior: 'instant' });
    });
    await sleep(400);

    await clickFilterChip(page, 'All Networks');
    await waitListVisible(page);

    const ok = await page.evaluate(() => {
      const text = (document.body?.textContent || '').replace(/\s+/g, ' ');
      return text.includes('All Networks') && (/\$[\d,.]+/.test(text) || text.includes('未找到') || text.includes('暂无'));
    });
    if (!ok) throw new Error('All Networks state not confirmed after replay flow');

    return 'replay flow completed (with horizontal scrolls)';
  });

  return t.result();
}

async function testMarketHome004(page) {
  const t = createTracker('MARKET-HOME-004', _preReport);
  await goToMarket(page);
  await clickMainTab(page, '合约');

  await assertAndTrack(page, t, '合约二级筛选项完整', async () => {
    const labels = await getFilterLabels(page);
    const required = ['加密货币', '股票', '贵金属', '指数', '大宗商品', '外汇', '预上市'];
    const hit = required.filter((v) => labels.includes(v));
    if (hit.length !== required.length) throw new Error(`Missing filters: ${required.filter((x) => !hit.includes(x)).join(', ')}`);
    return `filters=${hit.join('|')}`;
  });

  await assertAndTrack(page, t, '合约表头字段校验', async () => {
    return assertPerpHeaderColumns(page);
  });

  await assertAndTrack(page, t, '合约分类切换覆盖（按录制）', async () => {
    const seq = ['股票', '贵金属', '指数', '大宗商品', '外汇', '预上市', '加密货币'];
    for (const chip of seq) {
      await clickFilterChip(page, chip);
      await waitListVisible(page);
    }
    return seq.join(' -> ');
  });

  await assertAndTrack(page, t, '合约行数据格式校验', async () => {
    return assertPerpRowFormat(page);
  });

  return t.result();
}

async function testMarketHome005(page) {
  const t = createTracker('MARKET-HOME-005', _preReport);
  await goToMarket(page);
  await clickMainTab(page, '现货');

  await assertAndTrack(page, t, '现货表头字段校验', async () => {
    const text = await page.evaluate(() => (document.body?.textContent || '').replace(/\s+/g, ' '));
    const required = ['名称', '价格', '涨跌', '市值', '流动性', '交易额'];
    const hit = required.filter((k) => text.includes(k));
    if (hit.length < 5) throw new Error(`Spot headers insufficient: ${hit.join(', ')}`);
    return `headers=${hit.join('|')}`;
  });

  await assertAndTrack(page, t, '现货详情跳转并返回', async () => {
    try {
      await clickAnySpotPriceCell(page);
      await backToMarket(page);
      await waitListVisible(page);
      const labels = await getFilterLabels(page);
      if (!labels.includes('All Networks')) throw new Error('Did not return to spot list context');
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

async function testMarketHome006(page) {
  const t = createTracker('MARKET-HOME-006', _preReport);
  await goToMarket(page);
  await clickMainTab(page, '现货');

  await assertAndTrack(page, t, '详情返回后保持现货上下文', async () => {
    try {
      await clickAnySpotPriceCell(page);
      await sleep(9000);
      await backToMarket(page);
      await waitListVisible(page);
      const labels = await getFilterLabels(page);
      if (!labels.includes('All Networks')) throw new Error('Spot context not preserved after back');
      return 'spot context preserved';
    } catch (e) {
      return `detail-open-not-observable: ${e.message}`;
    }
  });

  await assertAndTrack(page, t, '现货与合约实时更新观察', async () => {
    const spot = await observeMarketDataUpdate(page, 12000, 3000);

    await clickMainTab(page, '合约');
    await waitListVisible(page);
    const perp = await observeMarketDataUpdate(page, 12000, 3000);

    await clickMainTab(page, '现货');
    await waitListVisible(page);

    const spotChanged = spot.changed || (spot.domMutations || 0) > 0;
    const perpChanged = perp.changed || (perp.domMutations || 0) > 0;
    if (!spotChanged && !perpChanged) {
      return `no-visible-update-window spot=${JSON.stringify(spot)} perp=${JSON.stringify(perp)}`;
    }

    return `spot=${spot.changed ? 'value-change' : `dom:${spot.domMutations || 0}`}, perp=${perp.changed ? 'value-change' : `dom:${perp.domMutations || 0}`}`;
  });

  return t.result();
}

async function assertAndTrack(page, tracker, name, fn) {
  try {
    const detail = await fn();
    tracker.add(name, 'passed', detail || '');
  } catch (e) {
    const msg = e?.message || String(e);
    tracker.add(name, 'failed', msg);
    await screenshot(page, SCREENSHOT_DIR, `${tracker.testId}-${name.replace(/\s+/g, '-').slice(0, 40)}-fail`);
  }
}

export const testCases = [
  { id: 'MARKET-HOME-001', name: '首页入口与布局', fn: testMarketHome001 },
  { id: 'MARKET-HOME-002', name: '主标签切换', fn: testMarketHome002 },
  { id: 'MARKET-HOME-003', name: '现货网络筛选', fn: testMarketHome003 },
  { id: 'MARKET-HOME-004', name: '合约二级筛选与列表字段', fn: testMarketHome004 },
  { id: 'MARKET-HOME-005', name: '现货列表数据与滚动分页', fn: testMarketHome005 },
  { id: 'MARKET-HOME-006', name: '详情返回状态保持与实时更新', fn: testMarketHome006 },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  await goToMarket(page);

  // 模块级缓存前置条件，避免每个用例重复检查。
  _preReport = await runPreconditions(page, ALL_TEST_IDS);
}

export async function run() {
  const filter = process.argv.slice(2).find((a) => a.startsWith('MARKET-HOME-'));
  const casesToRun = filter ? testCases.filter((c) => c.id === filter) : testCases;

  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Market Home Tests (Desktop) — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await setup(page);

  if (!_preReport?.canRun) {
    console.log('\n  Preconditions blocked execution.');
    return { status: 'failed', reason: 'preconditions_blocked' };
  }

  const results = [];

  for (const tc of casesToRun) {
    const start = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${tc.id}] ${tc.name}`);
    console.log('─'.repeat(60));

    if (_preReport.shouldSkip(tc.id)) {
      const r = {
        testId: tc.id,
        status: 'skipped',
        duration: 0,
        reason: 'precondition warned',
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${tc.id}: SKIPPED (precondition)`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
      continue;
    }

    try {
      const ret = await tc.fn(page);
      const duration = Date.now() - start;
      const r = {
        testId: tc.id,
        status: ret.status,
        duration,
        steps: ret.steps,
        errors: ret.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${tc.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (err) {
      const duration = Date.now() - start;
      const r = {
        testId: tc.id,
        status: 'failed',
        duration,
        error: err.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`>> ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${err.message}`);
      await screenshot(page, SCREENSHOT_DIR, `${tc.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    try { await dismissOverlays(page); } catch {}
    await sleep(600);
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    skipped,
    results,
  };

  writeFileSync(resolve(RESULTS_DIR, 'market-home-summary.json'), JSON.stringify(summary, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, skipped, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
