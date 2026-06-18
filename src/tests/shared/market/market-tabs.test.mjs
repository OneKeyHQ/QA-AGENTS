import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARKET_MAIN_TABS,
  MARKET_WATCHLIST_SUBTABS,
  classifyMarketTabs,
  resolveMarketListEntry,
} from './market-tabs.mjs';

test('Market main tabs match current design and no longer include spot', () => {
  assert.deepEqual(MARKET_MAIN_TABS, ['自选', '热门', '股票', '合约']);
  assert.equal(MARKET_MAIN_TABS.includes('现货'), false);
});

test('Market spot is a watchlist sub-tab, not a main tab', () => {
  assert.deepEqual(MARKET_WATCHLIST_SUBTABS, ['全部', '现货', '合约']);

  const result = classifyMarketTabs('自选 热门 股票 合约 全部 现货 合约 # 名称 价格 涨跌(%) 交易额');
  assert.equal(result.hasCurrentMainTabs, true);
  assert.equal(result.hasLegacySpotMainTab, false);
  assert.deepEqual(result.visibleMainTabs, ['自选', '热门', '股票', '合约']);
  assert.deepEqual(result.visibleWatchlistSubTabs, ['全部', '现货', '合约']);
});

test('Market list entry for token rows uses watchlist spot sub-tab under current UI', () => {
  assert.deepEqual(resolveMarketListEntry('spot'), {
    mainTab: '自选',
    subTab: '现货',
    legacyMainTab: '现货',
  });
});
