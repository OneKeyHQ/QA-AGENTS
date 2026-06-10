// Stellar Transfer Tests (Desktop) — STELLAR-001 ~ STELLAR-006
// Positive cases broadcast by default, then verify history records.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  closeAllModals,
  clickSidebarTab,
  connectCDP,
  dismissErrorDialogs,
  RESULTS_DIR,
  sleep,
  unlockWalletIfNeeded,
} from '../../../helpers/index.mjs';
import { createSoftwareWalletTransferTests } from '../../../shared/transfer/software-wallet/transfer.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'stellar-transfer-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(RESULTS_DIR, { recursive: true });

export const displayName = 'Stellar 软件钱包转账';

async function goToWallet(page) {
  await clickSidebarTab(page, 'Wallet');
  await sleep(1500);
}

const { testCases, setup } = createSoftwareWalletTransferTests({
  chain: 'stellar',
  prefix: 'STELLAR',
  goToWallet,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

export async function run() {
  const filter = process.argv.slice(2).find((arg) => arg.startsWith('STELLAR-'));
  const cases = filter ? testCases.filter((tc) => tc.id === filter) : testCases;

  if (cases.length === 0) {
    console.error(`No cases matching "${filter}"`);
    console.error('Available:', testCases.map((tc) => tc.id).join(', '));
    return { status: 'error', error: `No match: ${filter}` };
  }

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Stellar Transfer Tests — ${cases.length} case(s)`);
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
      const row = {
        testId: tc.id,
        status: result.status,
        duration,
        steps: result.steps,
        summary: result.summary,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`\n◆ ${tc.id}: ${row.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s) — ${row.summary.passed}✓ ${row.summary.failed}✗ ${row.summary.skipped}⊘`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(row, null, 2));
      results.push(row);
    } catch (error) {
      const duration = Date.now() - startTime;
      const row = {
        testId: tc.id,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`\n◆ ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s): ${error.message}`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(row, null, 2));
      results.push(row);
    }

    try {
      await dismissErrorDialogs(page);
      await closeAllModals(page);
      await goToWallet(page);
    } catch (error) {
      console.log(`  Cleanup: ${error.message}`);
      for (let i = 0; i < 5; i += 1) {
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(200);
      }
    }
    await sleep(1000);
  }

  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'stellar-transfer-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
    .then((result) => process.exit(result.status === 'passed' ? 0 : 1))
    .catch((error) => {
      console.error('Fatal:', error);
      process.exit(2);
    });
}
