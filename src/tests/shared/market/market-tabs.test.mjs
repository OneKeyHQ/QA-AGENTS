import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARKET_MAIN_TABS,
  MARKET_WATCHLIST_SUBTABS,
  classifyMarketTabs,
  countMarketLabelHits,
  marketTextIncludesLabel,
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

test('Market tab classification accepts Traditional Chinese labels', () => {
  const result = classifyMarketTabs('自選 熱門 股票 合約 全部 現貨 合約 # 名稱 價格 漲跌(%) 交易額');
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

test('Market shared assertions accept Traditional Chinese headers and filters', () => {
  const text = '自選 熱門 股票 合約 1h 全部 名稱 價格 更改(%) 市值 流動性 交易額 交易數 交易地址數 持幣地址 建立時間';

  assert.equal(marketTextIncludesLabel(text, '名称'), true);
  assert.equal(marketTextIncludesLabel(text, '涨跌'), true);
  assert.equal(marketTextIncludesLabel(text, '流动性'), true);
  assert.equal(marketTextIncludesLabel(text, '创建时间'), true);

  assert.equal(countMarketLabelHits(text, ['名称', '价格', '涨跌', '市值', '流动性', '交易额', '创建时间']), 7);
});
