// Wallet Creation Test (Web) — WEB-WALLET-001
// Web has no wallet functionality, so all cases are skipped at setup.
// The structure mirrors the Desktop/Extension wrappers to keep the contract
// uniform (Dashboard / CLI can still discover & list these cases).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../helpers/constants.mjs';
import { createCreateMnemonicTests } from '../../shared/wallet/create-mnemonic.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'web-wallet-create');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const SKIP_REASON = 'Web 端不提供钱包创建功能（无 OneKey 钱包栈）';

// Stub navigation — never actually invoked because setup short-circuits.
async function goToWallet(/* page */) {
  throw new Error('钱包功能在 Web 端不可用');
}

// ── Test Cases (from shared module, prefixed for Web) ──────

export const displayName = '钱包创建';

const { testCases } = createCreateMnemonicTests({
  prefix: 'WEB-WALLET',
  namePrefix: 'Web-',
  password: 'unused',
  goToWallet,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases };

// Setup returns a SKIP marker — runner/dashboard checks the string and skips
// every test case in this module without executing fn(page).
export async function setup(/* page */) {
  return `SKIP: ${SKIP_REASON}`;
}

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  console.log('\n' + '='.repeat(60));
  console.log(`  Wallet Create (Web) — all cases SKIP`);
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
