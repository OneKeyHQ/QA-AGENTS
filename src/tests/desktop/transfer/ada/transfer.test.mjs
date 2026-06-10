// Cardano / ADA Transfer Tests (Desktop) — ADA-001 ~ ADA-004
// Positive cases broadcast by default, then verify history records.

import {
  createDesktopSoftwareWalletTransferRunner,
  runAsMain,
} from '../run-software-wallet-transfer.mjs';

export const displayName = 'Cardano 软件钱包转账';

const runner = createDesktopSoftwareWalletTransferRunner({
  chain: 'ada',
  prefix: 'ADA',
  displayName,
  summaryName: 'ada-transfer-summary.json',
  screenshotFolder: 'ada-transfer-screenshots',
});

export const { testCases, setup, run } = runner;

runAsMain(import.meta.url, run);
