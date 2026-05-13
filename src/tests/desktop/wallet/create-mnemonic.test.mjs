// Wallet Creation Test (Desktop) — WALLET-001
// Thin wrapper: test logic lives in src/tests/shared/wallet/create-mnemonic.mjs
// Connects via CDP port 9222 (OneKey Electron app).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR, WALLET_PASSWORD,
  closeAllModals, goToWalletHome, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { createCreateMnemonicTests } from '../../shared/wallet/create-mnemonic.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'wallet-create');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

async function goToWallet(page) {
  await closeAllModals(page).catch(() => {});
  await goToWalletHome(page);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '钱包创建';

const { testCases, setup } = createCreateMnemonicTests({
  prefix: 'WALLET',
  namePrefix: '',
  password: WALLET_PASSWORD,
  goToWallet,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log('  WALLET-001: Create Mnemonic Wallet');
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);
  await setup(page);

  const results = [];
  for (const test of testCases) {
    const startTime = Date.now();
    try {
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: result.status, duration,
        steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: 'failed', duration,
        error: error.message, timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      await screenshot(page, SCREENSHOT_DIR, `${test.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
    await sleep(800);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;
  console.log(`\nSUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
