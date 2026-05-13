// Currency Switch Test (Desktop) — SETTINGS-002
// Thin wrapper: test logic lives in src/tests/shared/settings/currency-switch.mjs
// Connects via CDP port 9222 (OneKey Electron app).

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { createCurrencySwitchTests } from '../../shared/settings/currency-switch.mjs';
import { openPreferences } from './nav-helpers.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'currency-switch');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ── Platform-specific Navigation ─────────────────────────────

async function openSettings(page) {
  await openPreferences(page);
}

// ── Test Cases (from shared module) ──────────────────────────

export const displayName = '切换法币';

const { testCases, setup } = createCurrencySwitchTests({
  prefix: 'SETTINGS',
  namePrefix: '',
  openSettings,
  screenshotDir: SCREENSHOT_DIR,
});

export { testCases, setup };

// ── Main (CLI Runner) ────────────────────────────────────────

export async function run() {
  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log('  Currency Switch Test — 1 case');
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);
  await setup(page);

  const results = [];
  for (const test of testCases) {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${test.id}] ${test.name}`);
    console.log('─'.repeat(60));

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

    try { await dismissOverlays(page); } catch {}
    await sleep(1000);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
