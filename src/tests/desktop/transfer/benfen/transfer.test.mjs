// BenFen Transfer Tests (Desktop) — BENFEN-001 ~ BENFEN-006
// Positive cases broadcast by default, then verify history records.

import {
  createDesktopSoftwareWalletTransferRunner,
  runAsMain,
} from '../run-software-wallet-transfer.mjs';

export const displayName = 'BenFen 软件钱包转账';

const runner = createDesktopSoftwareWalletTransferRunner({
  chain: 'benfen',
  prefix: 'BENFEN',
  displayName,
  summaryName: 'benfen-transfer-summary.json',
  screenshotFolder: 'benfen-transfer-screenshots',
});

export const { testCases, setup, run } = runner;

runAsMain(import.meta.url, run);
