// Cosmos Transfer Tests (Desktop) — COSMOS-001 ~ COSMOS-012
// Thin wrapper: test logic lives in src/tests/shared/transfer/cosmos/transfer.mjs
// 11 multi-network parameterized transfers + 1 boundary test.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, RESULTS_DIR, WALLET_PASSWORD,
  dismissErrorDialogs, closeAllModals, goToWalletHome,
  unlockWalletIfNeeded, ensurePrimarySoftwareWallet,
} from '../../../helpers/index.mjs';
import { createCosmosTransferTests } from '../../../shared/transfer/cosmos/transfer.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'cosmos-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(RESULTS_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

async function goToWallet(page) {
  await goToWalletHome(page);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = 'Cosmos 转账';

const { testCases, setup } = createCosmosTransferTests({
  prefix: 'COSMOS',
  namePrefix: '',
  password: WALLET_PASSWORD,
  goToWallet,
  ensureSoftwareWallet: ensurePrimarySoftwareWallet,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

// ── Standalone runner ──────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('COSMOS-'));
  const cases = filter
    ? testCases.filter(c => c.id === filter)
    : testCases;

  if (cases.length === 0) {
    console.error(`No cases matching "${filter}"`);
    console.error('Available:', testCases.map(c => c.id).join(', '));
    return { status: 'error', error: `No match: ${filter}` };
  }

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Cosmos Transfer Tests — ${cases.length} case(s)`);
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);
  await setup(page);

  const results = [];
  for (const tc of cases) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`▶ ${tc.id}: ${tc.name}`);
    console.log('─'.repeat(60));

    try {
      const result = await tc.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        testId: tc.id,
        status: result.status,
        duration,
        steps: result.steps,
        summary: result.summary,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`\n◆ ${tc.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s) — ${r.summary.passed}✓ ${r.summary.failed}✗ ${r.summary.skipped}⊘`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: tc.id,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`\n◆ ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s): ${error.message}`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    try {
      await dismissErrorDialogs(page);
      await closeAllModals(page);
      await goToWalletHome(page);
    } catch (e) {
      console.log(`  Cleanup: ${e.message}`);
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(200);
      }
    }
    await sleep(1000);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'cosmos-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
