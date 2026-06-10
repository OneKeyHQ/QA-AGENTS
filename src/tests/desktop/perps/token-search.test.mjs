// Token Search Tests (Desktop) — SEARCH-001 ~ SEARCH-004
// Thin wrapper: test logic lives in src/tests/shared/perps/token-search.mjs
// Connects via CDP port 9222 (OneKey Electron app).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { PerpsPage } from '../../helpers/pages/index.mjs';
import { createPerpsTokenSearchTests } from '../../shared/perps/token-search.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'search');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

const _perpsCache = { page: null, pp: null };
function getPerpsPage(page) {
  if (_perpsCache.page !== page) {
    _perpsCache.pp = new PerpsPage(page);
    _perpsCache.page = page;
  }
  return _perpsCache.pp;
}

async function goToPerps(page) {
  await getPerpsPage(page).navigate();
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '代币搜索';

const { testCases, setup, ensurePopoverOpen, dismissPopover, getPreReport } =
  createPerpsTokenSearchTests({
    prefix: 'SEARCH',
    namePrefix: '',
    goToPerps,
    screenshot,
    screenshotDir: SCREENSHOT_DIR,
    tabLayout: 'two-level',
    extraTwoLevelChineseSearchCases: [
      { query: '英伟达', expected: 'NVDA' },
      { query: '苹果', expected: 'AAPL' },
    ],
  });

export { testCases, setup };

// ── Main (CLI) ──────────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('SEARCH-'));
  const casesToRun = filter
    ? testCases.filter(c => c.id === filter)
    : testCases;

  if (casesToRun.length === 0) {
    console.error(`No tests matching "${filter}"`);
    return { status: 'error' };
  }

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Token Search Tests — ${casesToRun.length} case(s)`);
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);
  await setup(page);

  const preReport = getPreReport();
  if (!preReport?.canRun) {
    console.log('\n  Preconditions not met, aborting.');
    return { status: 'failed', error: 'preconditions_failed' };
  }

  const results = [];
  for (const test of casesToRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    if (preReport.shouldSkip(test.id)) {
      const r = { testId: test.id, status: 'skipped', duration: 0,
        reason: 'precondition warned', timestamp: new Date().toISOString() };
      console.log(`>> ${test.id}: SKIPPED (precondition)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
      continue;
    }

    await ensurePopoverOpen(page);

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
  }

  await dismissPopover(page);

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, ${results.length} total`);
  console.log('='.repeat(60));

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, skipped, results };
  writeFileSync(resolve(RESULTS_DIR, 'search-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, skipped, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
