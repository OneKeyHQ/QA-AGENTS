// Perps TV Chart Tests (Desktop) — PERPS-CHART-001 ~ PERPS-CHART-008
// Thin wrapper: test logic lives in src/tests/shared/perps/chart.mjs
// Connects via CDP port 9222 (OneKey Electron app).
//
// Key architecture (K-022):
//   Perps TV chart = Electron <webview> → blob: <iframe>
//   Access: page.evaluate → wv.executeJavaScript → iframe.contentDocument
//   Playwright page.frames() CANNOT access webview — must use executeJavaScript

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { PerpsPage } from '../../helpers/pages/index.mjs';
import { createChartTests } from '../../shared/perps/chart.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'perps-chart');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific TV access (Electron <webview> → iframe) ────

/**
 * Execute JS inside the TV blob: iframe (two-layer traversal).
 * Desktop: webview.executeJavaScript → iframe.contentDocument
 */
async function tvEval(page, jsCode) {
  return page.evaluate(async (code) => {
    const wv = document.querySelector('webview');
    if (!wv) throw new Error('TV webview not found');
    return await wv.executeJavaScript(`
      (() => {
        const iframe = document.querySelector('iframe');
        if (!iframe?.contentDocument) throw new Error('TV iframe not found');
        const doc = iframe.contentDocument;
        ${code}
      })()
    `);
  }, jsCode);
}

// ── Platform-specific Navigation ─────────────────────────────────

async function goToPerps(page) {
  await new PerpsPage(page).navigate();
}

// ── Platform-specific PerpsPage (uses helpers/pages/perps.mjs) ───

function makePerpsPage(page) {
  return new PerpsPage(page);
}

// ── Test Cases (from shared module) ──────────────────────────────

export const displayName = '图表';

const { testCases, setup, ALL_TEST_IDS } = createChartTests({
  prefix: 'PERPS',
  namePrefix: '',
  goToPerps,
  tvEval,
  screenshotDir: SCREENSHOT_DIR,
  makePerpsPage,
  canSwitchAccount: true,
});

export { testCases, setup, ALL_TEST_IDS };

// ── Main (CLI Runner) ────────────────────────────────────────────

export async function run() {
  const selectedIds = process.argv.slice(2).filter(a => a.startsWith('PERPS-CHART-'));
  const toRun = selectedIds.length > 0
    ? testCases.filter(tc => selectedIds.includes(tc.id))
    : testCases;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Perps TV Chart Tests — ${toRun.length} case(s)`);
  console.log(`${'='.repeat(60)}\n`);

  const { browser, page } = await connectCDP();
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);

  const results = {};

  for (const tc of toRun) {
    console.log(`${'─'.repeat(60)}`);
    console.log(`[${tc.id}] ${tc.name}`);
    console.log(`${'─'.repeat(60)}`);

    const start = Date.now();
    try {
      const result = await tc.fn(page);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results[tc.id] = result;
      const summary = result.summary || {};
      const skipInfo = summary.skipped > 0 ? ` (${summary.skipped} skipped)` : '';
      console.log(`>> ${tc.id}: ${result.status.toUpperCase()} (${elapsed}s) — ${summary.passed || 0} passed, ${summary.failed || 0} failed, ${summary.skipped || 0} skipped${skipInfo}`);
      if (result.errors.length > 0) {
        result.errors.forEach(e => console.log(`   ✗ ${e}`));
      }
    } catch (e) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      results[tc.id] = { status: 'failed', steps: [], errors: [e.message] };
      console.log(`>> ${tc.id}: FAILED (${elapsed}s) — ${e.message}`);
    }
    console.log();
  }

  const passed = Object.values(results).filter(r => r.status === 'passed').length;
  const failed = Object.values(results).filter(r => r.status === 'failed').length;
  console.log(`${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${toRun.length} total`);
  console.log(`${'='.repeat(60)}`);

  const resultPath = resolve(RESULTS_DIR, 'perps-chart/results.json');
  writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(`Results saved to ${resultPath}`);

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: toRun.length };
}

const _isDirectRun = process.argv[1] && process.argv[1].endsWith('chart.test.mjs');
if (_isDirectRun) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
