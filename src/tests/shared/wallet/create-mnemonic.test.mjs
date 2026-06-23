import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CREATE_WALLET_ENTRY_LABELS,
} from './create-mnemonic.mjs';

test('create mnemonic flow accepts current Traditional Chinese create-wallet entry', () => {
  assert.equal(CREATE_WALLET_ENTRY_LABELS.includes('創建新錢包'), true);
});
