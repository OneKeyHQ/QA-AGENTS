import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createWalletImportTests,
  DEFAULT_IMPORT_MNEMONIC,
} from './import-flows.mjs';

test('desktop nightly wallet import exposes real mnemonic and private-key import cases', () => {
  const { testCases } = createWalletImportTests({
    prefix: 'WALLET-IMPORT',
    password: '1234567890-=',
    goToWallet: async () => {},
    screenshotDir: '/tmp',
  });

  assert.deepEqual(testCases.map((tc) => tc.id), [
    'WALLET-IMPORT-001',
    'WALLET-IMPORT-002',
  ]);
  assert.match(testCases[0].name, /固定助记词导入/);
  assert.match(testCases[1].name, /导出私钥后导入/);
  assert.equal(DEFAULT_IMPORT_MNEMONIC.split(/\s+/).length, 12);
});

