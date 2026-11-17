import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreFormBaseline } from '../form-restoration.mjs';

test('shared form restoration never replays a foreign-market intermediate price', async () => {
  const before = { pair: 'SOXLUSDC', mode: '市价单', fields: [{ value: '' }] };
  const calls = [];
  let current = { pair: 'BTCUSDC', mode: '限价单', fields: [{ value: '70.972' }] };
  await restoreFormBaseline(before, async state => {
    calls.push(state);
    // A BTC input rejects the stale SOXL 70.972 price (szDecimals=5).
    if (state.pair === 'BTCUSDC' && state.fields[0].value === '70.972')
      throw Error('Invalid BTC precision');
    assert.deepEqual(state, before);
    current = structuredClone(state);
  }, async () => current);
  assert.deepEqual(calls, [before]);
});

test('original nonempty draft is preserved exactly and restoration failure propagates', async () => {
  const before = { pair: 'BTCUSDC', mode: '限价单', fields: [{ value: '70000' }, { value: '123' }], bbo: false };
  let observed;
  await restoreFormBaseline(before, async value => { observed = value; }, async () => structuredClone(observed));
  assert.strictEqual(observed, before);
  await assert.rejects(restoreFormBaseline(before, async () => { throw Error('readback mismatch'); }), /readback mismatch/);
  await assert.rejects(restoreFormBaseline(before, async () => {}, async () => ({ ...before, bbo: true })), /Original visible form baseline/);
  await assert.rejects(restoreFormBaseline(before, async () => {}, async () => ({ ...before, fields: [{ value: '71000' }, { value: '123' }] })), /Original visible form baseline/);
});
