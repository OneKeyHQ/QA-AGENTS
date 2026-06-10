// TON Transfer Tests (Desktop) — TON-001 ~ TON-004
// Positive cases broadcast by default, then verify history records.

import {
  createDesktopSoftwareWalletTransferRunner,
  runAsMain,
} from '../run-software-wallet-transfer.mjs';

export const displayName = 'TON 软件钱包转账';

const runner = createDesktopSoftwareWalletTransferRunner({
  chain: 'ton',
  prefix: 'TON',
  displayName,
  summaryName: 'ton-transfer-summary.json',
  screenshotFolder: 'ton-transfer-screenshots',
});

export const { testCases, setup, run } = runner;

runAsMain(import.meta.url, run);
