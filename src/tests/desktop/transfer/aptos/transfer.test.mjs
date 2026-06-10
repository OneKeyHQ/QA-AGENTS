// Aptos Transfer Tests (Desktop) — APTOS-001 ~ APTOS-005
// Positive cases broadcast by default, then verify history records.

import {
  createDesktopSoftwareWalletTransferRunner,
  runAsMain,
} from '../run-software-wallet-transfer.mjs';

export const displayName = 'Aptos 软件钱包转账';

const runner = createDesktopSoftwareWalletTransferRunner({
  chain: 'aptos',
  prefix: 'APTOS',
  displayName,
  summaryName: 'aptos-transfer-summary.json',
  screenshotFolder: 'aptos-transfer-screenshots',
});

export const { testCases, setup, run } = runner;

runAsMain(import.meta.url, run);
