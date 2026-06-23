import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractAccountSelectorText,
  isAllNetworksLabel,
  isWalletHomeForegroundSnapshot,
} from './nightly-portfolio-all-networks-create-address.test.mjs';

test('account selector text uses textContent when innerText is blank', () => {
  const actual = extractAccountSelectorText([
    { innerText: '', textContent: 'piggy🐷' },
  ]);
  assert.equal(actual, 'piggy🐷');
});

test('account selector text ignores blank candidates and normalizes whitespace', () => {
  const actual = extractAccountSelectorText([
    { innerText: '   ', textContent: '' },
    { innerText: '', textContent: '  Account   #12  ' },
  ]);
  assert.equal(actual, 'Account #12');
});

test('all networks label uses current product naming', () => {
  assert.equal(isAllNetworksLabel('所有网络'), true);
  assert.equal(isAllNetworksLabel('All Networks'), true);
  assert.equal(isAllNetworksLabel('投资组合'), false);
});

test('wallet home foreground detection rejects visible Market context', () => {
  assert.equal(isWalletHomeForegroundSnapshot({
    hasHomePage: true,
    hasAccountSelector: true,
    hasPortfolioTab: true,
    hasCopyAddressButton: true,
    activeSidebarTestId: 'market',
    bodyText: '市場 自選 熱門 股票 合約 名稱 價格',
  }), false);

  assert.equal(isWalletHomeForegroundSnapshot({
    hasHomePage: true,
    hasAccountSelector: true,
    hasPortfolioTab: true,
    hasCopyAddressButton: true,
    activeSidebarTestId: 'home',
    bodyText: '錢包 發送 接收 買賣幣 現貨 歷史記錄',
  }), true);
});
