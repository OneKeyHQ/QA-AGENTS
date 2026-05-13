// Cosmos Transfer Tests (Web) — WEB-COSMOS-001 ~ WEB-COSMOS-012
// Web has no transfer functionality, so all cases are skipped at setup.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../../helpers/constants.mjs';
import { createCosmosTransferTests } from '../../../shared/transfer/cosmos/transfer.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-cosmos-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const SKIP_REASON = 'Web 端不提供转账功能（依赖本地钱包/签名）';

async function goToWallet(/* page */) {
  throw new Error('钱包功能在 Web 端不可用');
}

// ── Test Cases (from shared module, prefixed for Web) ──────

export const displayName = 'Cosmos 转账';

const { testCases } = createCosmosTransferTests({
  prefix: 'WEB-COSMOS',
  namePrefix: 'Web-',
  password: 'unused',
  goToWallet,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases };

export async function setup(/* page */) {
  return `SKIP: ${SKIP_REASON}`;
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  console.log('\n' + '='.repeat(60));
  console.log(`  Cosmos Transfer (Web) — all cases SKIP`);
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
