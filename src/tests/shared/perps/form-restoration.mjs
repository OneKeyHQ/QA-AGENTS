import assert from 'node:assert/strict';
// PerpTradingForm uses one tradingFormAtom. Snapshots taken after changing
// markets/modes describe test intermediates, not independent user drafts.
// Replaying them can attempt a price rejected by the new market's precision.
export async function restoreFormBaseline(before, restore, readback) {
  await restore(before);
  assert.deepEqual(await readback(), before, 'Original visible form baseline restored exactly');
}
