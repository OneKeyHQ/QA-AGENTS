const connectCDP = () => connectPlatform('desktop');
import {connectPlatform} from '../../helpers/platform-session.mjs';
import {mustStopAfterResult,summarizeCaseResults} from '../../helpers/execution-policy.mjs';
// Perps Favorites Tests (Desktop) — PERPS-001 ~ PERPS-005
// Thin wrapper: test logic lives in src/tests/shared/perps/favorites.mjs
// Connects via CDP port 9222 (OneKey Electron app).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { PerpsPage } from '../../helpers/pages/index.mjs';
import { createFavoritesTests } from '../../shared/perps/favorites.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'perps-favorites');
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

export const platform = 'desktop';
export const displayName = '收藏';

const { testCases, setup } = createFavoritesTests({
  prefix: 'PERPS',
  namePrefix: '',
  goToPerps,
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const selectedIds = process.argv.slice(2).filter(a => /^PERPS-\d+$/u.test(a));
  const toRun = selectedIds.length > 0
    ? testCases.filter(tc => selectedIds.includes(tc.id))
    : testCases;

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Perps Favorites Tests — ${toRun.length} case(s)`);
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);
  await setup(page);

  const results = [];
  for (const test of toRun) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

    try {
      const result = await test.fn(page);
      const duration = Date.now() - startTime;
      const r = {
        ...result, testId: test.id, status: result.status, duration,
        steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${test.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
      if(mustStopAfterResult(r)) { console.error('恢复失败，停止后续用例；剩余条目未执行'); break; }
    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: test.id, status: 'failed', duration,
        error: error.message, fatalRestore: Boolean(error.fatalRestore), timestamp: new Date().toISOString(),
      };
      console.error(`>> ${test.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${error.message}`);
      await screenshot(page, SCREENSHOT_DIR, `${test.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${test.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
      if(mustStopAfterResult(r)) { console.error('恢复失败，停止后续用例；剩余条目未执行'); break; }
    }

    try { await dismissOverlays(page); } catch {}
  }

  const aggregate = summarizeCaseResults(results, toRun.length);
  const {passed,failed,skipped,notRun} = aggregate;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped, ${notRun} not run, ${results.length} executed`);
  console.log('='.repeat(60));
  results.forEach(r => {
    const icon = r.status === 'passed' ? 'PASS' : r.status === 'skipped' ? 'SKIP' : 'FAIL';
    console.log(`  [${icon}] ${r.testId} (${(r.duration / 1000).toFixed(1)}s)${r.error ? ' — ' + r.error : ''}`);
  });

  const summary = { ...aggregate, timestamp: new Date().toISOString(), results };
  writeFileSync(resolve(RESULTS_DIR, 'perps-favorites-summary.json'), JSON.stringify(summary, null, 2));

  return aggregate;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
