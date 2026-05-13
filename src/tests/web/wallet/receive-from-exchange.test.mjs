// Wallet — 从交易所接收 (Web) — WEB-WALLET-RECV-001 ~ WEB-WALLET-RECV-005
// Web has no wallet functionality, so all cases are skipped at setup.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { createReceiveFromExchangeTests } from '../../shared/wallet/receive-from-exchange.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-wallet-receive-from-exchange');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const SKIP_REASON = 'Web 端不提供钱包功能（从交易所接收依赖本地钱包）';

async function goToWallet(/* page */) {
  throw new Error('钱包功能在 Web 端不可用');
}

// ── Test Cases (from shared module, prefixed for Web) ──────

export const displayName = '从交易所接收';

const { testCases } = createReceiveFromExchangeTests({
  prefix: 'WEB-WALLET-RECV',
  namePrefix: 'Web-',
  goToWallet,
});

export { testCases };

export async function setup(/* page */) {
  return `SKIP: ${SKIP_REASON}`;
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  console.log('\n' + '='.repeat(60));
  console.log(`  Wallet Receive from Exchange (Web) — all cases SKIP`);
  console.log(`  Reason: ${SKIP_REASON}`);
  console.log('='.repeat(60));

  const results = [];
  for (const tc of testCases) {
    console.log(`  SKIP  ${tc.id}  ${tc.name}`);
    const skipped = {
      testId: tc.id, status: 'skipped', duration: 0,
      reason: SKIP_REASON,
      timestamp: new Date().toISOString(),
    };
    writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(skipped, null, 2));
    results.push(skipped);
    await sleep(50);
  }

  return { status: 'skipped', passed: 0, failed: 0, total: results.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e); process.exit(2); });
}
