import test from 'node:test';
import assert from 'node:assert/strict';

import {
  choosePasswordSubmitPoint,
  findVisiblePasswordInputSnapshot,
  isLockScreenState,
  waitForPasswordStateToClear,
} from './components.mjs';

test('findVisiblePasswordInputSnapshot ignores hidden stale inputs', () => {
  const input = findVisiblePasswordInputSnapshot([
    { visible: false, rect: { x: 1, y: 1, w: 100, h: 40 } },
    { visible: true, rect: { x: 437, y: 400, w: 230, h: 44 } },
  ]);

  assert.deepEqual(input.rect, { x: 437, y: 400, w: 230, h: 44 });
});

test('choosePasswordSubmitPoint prefers visible verifying control near the input', () => {
  const point = choosePasswordSubmitPoint(
    { rect: { x: 437, y: 400, w: 230, h: 44 } },
    [
      { visible: true, testid: null, rect: { x: 1141, y: 7, w: 38, h: 38 } },
      { visible: true, testid: 'verifying-password', rect: { x: 711, y: 400, w: 44, h: 44 } },
    ],
  );

  assert.deepEqual(point, { x: 733, y: 422, reason: 'visible verifying-password' });
});

test('choosePasswordSubmitPoint falls back to in-field arrow area', () => {
  const point = choosePasswordSubmitPoint(
    { rect: { x: 437, y: 400, w: 230, h: 44 } },
    [{ visible: true, testid: null, rect: { x: 1141, y: 7, w: 38, h: 38 } }],
  );

  assert.deepEqual(point, { x: 639, y: 422, reason: 'input arrow fallback' });
});

test('isLockScreenState requires lock text or visible password input', () => {
  assert.equal(isLockScreenState({ hasWelcome: true, visiblePasswordInputs: 0 }), true);
  assert.equal(isLockScreenState({ hasWelcome: false, visiblePasswordInputs: 1 }), true);
  assert.equal(isLockScreenState({ hasWelcome: false, visiblePasswordInputs: 0 }), false);
});

test('waitForPasswordStateToClear tolerates slow unlock completion', async () => {
  const states = [
    { hasWelcome: true, visiblePasswordInputs: 1, hasPasswordError: false },
    { hasWelcome: true, visiblePasswordInputs: 1, hasPasswordError: false },
    { hasWelcome: false, visiblePasswordInputs: 0, hasPasswordError: false },
  ];
  const page = {
    evaluate: async () => states.shift() ?? states.at(-1),
  };

  const finalState = await waitForPasswordStateToClear(page, { timeout: 200, interval: 1 });

  assert.equal(isLockScreenState(finalState), false);
});
