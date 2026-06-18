import test from 'node:test';
import assert from 'node:assert/strict';

import { extractAccountSelectorText } from './nightly-portfolio-all-networks-create-address.test.mjs';

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
