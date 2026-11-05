import test from 'node:test';
import assert from 'node:assert/strict';
import {tradingViewSymbolMatches} from '../trading-view-chart-state.mjs';
test('chart readiness requires canonical current market, including DEX and spot identity', () => {
  assert.equal(tradingViewSymbolMatches('BTC', 'BTC'), true);
  assert.equal(tradingViewSymbolMatches('XYZ:SOXL', 'xyz:SOXL'), true);
  assert.equal(tradingViewSymbolMatches('HYPE/USDC', 'BTC'), false);
  assert.equal(tradingViewSymbolMatches('XYZ:BTC', 'BTC'), false);
  assert.equal(tradingViewSymbolMatches('IO:SNDK', 'xyz:SNDK'), false);
  assert.equal(tradingViewSymbolMatches('@107', '@107'), true);
  assert.equal(tradingViewSymbolMatches('@108', '@107'), false);
  assert.equal(tradingViewSymbolMatches(undefined, 'BTC'), false);
  assert.equal(tradingViewSymbolMatches('', ''), false);
});
