import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReverseQuantities } from '../desktop-position-boundaries.mjs';
const preview = (side, target, order) => `当前持仓\n${side} 0.5 BTC\n反手后\n${target} 0.5 BTC\n市价单数量\n${order} 1 BTC`;
test('reverse market quantity must have the opposite execution side as well as double size', () => {
  const long = { coin: 'BTC', szi: '0.5' };
  const short = { coin: 'BTC', szi: '-0.5' };
  assert.doesNotThrow(() => assertReverseQuantities(preview('做多','做空','出售'), long));
  assert.doesNotThrow(() => assertReverseQuantities(preview('做空','做多','购买'), short));
  assert.throws(() => assertReverseQuantities(preview('做多','做空','购买'), long));
  assert.throws(() => assertReverseQuantities(preview('做空','做多','出售'), short));
});
