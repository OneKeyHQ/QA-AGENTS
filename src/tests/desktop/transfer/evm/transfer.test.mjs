// EVM Transfer Tests (Desktop) — EVM-001 ~ EVM-016
// Positive cases broadcast by default, then verify history records.

import {
  createDesktopSoftwareWalletTransferRunner,
  runAsMain,
} from '../run-software-wallet-transfer.mjs';

export const displayName = 'EVM 软件钱包转账';

const runner = createDesktopSoftwareWalletTransferRunner({
  chain: 'evm',
  prefix: 'EVM',
  displayName,
  summaryName: 'evm-transfer-summary.json',
  screenshotFolder: 'evm-transfer-screenshots',
});

export const { testCases, setup, run } = runner;

runAsMain(import.meta.url, run);
